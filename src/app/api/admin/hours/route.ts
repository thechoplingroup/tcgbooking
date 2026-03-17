import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

  const body = await request.json();
  const { day_of_week, open_time, close_time } = body as {
    day_of_week: number;
    open_time: string;
    close_time: string;
  };

  if (day_of_week < 0 || day_of_week > 6) {
    return NextResponse.json({ error: "Invalid day_of_week" }, { status: 400 });
  }
  if (!open_time || !close_time) {
    return NextResponse.json({ error: "open_time and close_time are required" }, { status: 400 });
  }

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ hour: data });
}
