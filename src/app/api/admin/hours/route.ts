import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

// ─── Zod validation ──────────────────────────────────────────────────────────

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const PostHoursSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  open_time: z.string().regex(timeRegex, "open_time must be in HH:MM format"),
  close_time: z.string().regex(timeRegex, "close_time must be in HH:MM format"),
});

async function getStylistId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("stylists")
    .select("id")
    .eq("user_id", userId)
    .single();
  return data?.id ?? null;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stylistId = await getStylistId(supabase, user.id);
  if (!stylistId) {
    return NextResponse.json({ hours: [], overrides: [] });
  }

  const [hoursResult, overridesResult] = await Promise.all([
    supabase
      .from("operational_hours")
      .select("*")
      .eq("stylist_id", stylistId)
      .order("day_of_week"),
    supabase
      .from("operational_hours_overrides")
      .select("*")
      .eq("stylist_id", stylistId)
      .order("effective_from"),
  ]);

  if (hoursResult.error) {
    console.error("[api/admin/hours GET]", { error: hoursResult.error.message, userId: user.id });
    return NextResponse.json({ error: hoursResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    hours: hoursResult.data,
    overrides: overridesResult.data ?? [],
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stylistId = await getStylistId(supabase, user.id);
  if (!stylistId) {
    return NextResponse.json(
      { error: "Create your profile before setting hours." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = PostHoursSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", details: parsed.error.issues.map((e) => ({ path: e.path.join("."), message: e.message })) },
      { status: 400 }
    );
  }

  const { day_of_week, open_time, close_time } = parsed.data;

  // Upsert — one row per stylist+day
  const { data, error } = await supabase
    .from("operational_hours")
    .upsert(
      { stylist_id: stylistId, day_of_week, open_time, close_time },
      { onConflict: "stylist_id,day_of_week" }
    )
    .select()
    .single();

  if (error) {
    console.error("[api/admin/hours POST]", { error: error.message, userId: user.id, day_of_week });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ hour: data });
}
