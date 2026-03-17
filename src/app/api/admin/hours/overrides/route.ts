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
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stylistId = await getStylistId(supabase, user.id);
  if (!stylistId) {
    return NextResponse.json({ overrides: [] });
  }

  const { data, error } = await supabase
    .from("operational_hours_overrides")
    .select("*")
    .eq("stylist_id", stylistId)
    .order("effective_from");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ overrides: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stylistId = await getStylistId(supabase, user.id);
  if (!stylistId) {
    return NextResponse.json(
      { error: "Create your profile before setting overrides." },
      { status: 400 }
    );
  }

  const body = await request.json() as {
    label?: string;
    effective_from: string;
    effective_until: string;
    day_of_week?: number | null;
    open_time?: string | null;
    close_time?: string | null;
    is_closed?: boolean;
    note?: string | null;
  };

  const { label, effective_from, effective_until, day_of_week, open_time, close_time, is_closed } = body;

  if (!effective_from || !effective_until) {
    return NextResponse.json({ error: "effective_from and effective_until are required" }, { status: 400 });
  }

  if (new Date(effective_from) > new Date(effective_until)) {
    return NextResponse.json({ error: "effective_from must be before effective_until" }, { status: 400 });
  }

  const closed = is_closed ?? false;

  if (!closed && (!open_time || !close_time)) {
    return NextResponse.json({ error: "open_time and close_time are required unless is_closed is true" }, { status: 400 });
  }

  // For single-day overrides (from=until, day_of_week=null), upsert to prevent duplicates
  const isSingleDay = effective_from === effective_until && (day_of_week === null || day_of_week === undefined);

  let data, error;

  if (isSingleDay) {
    // Delete any existing override for this exact single day, then insert fresh
    await supabase
      .from("operational_hours_overrides")
      .delete()
      .eq("stylist_id", stylistId)
      .eq("effective_from", effective_from)
      .eq("effective_until", effective_until)
      .is("day_of_week", null);

    ({ data, error } = await supabase
      .from("operational_hours_overrides")
      .insert({
        stylist_id: stylistId,
        label: label ?? null,
        effective_from,
        effective_until,
        day_of_week: null,
        open_time: closed ? null : (open_time ?? null),
        close_time: closed ? null : (close_time ?? null),
        is_closed: closed,
        ...(body.note !== undefined ? { note: body.note ?? null } : {}),
      })
      .select()
      .single());
  } else {
    ({ data, error } = await supabase
      .from("operational_hours_overrides")
      .insert({
        stylist_id: stylistId,
        label: label ?? null,
        effective_from,
        effective_until,
        day_of_week: day_of_week ?? null,
        open_time: closed ? null : (open_time ?? null),
        close_time: closed ? null : (close_time ?? null),
        is_closed: closed,
        ...(body.note !== undefined ? { note: body.note ?? null } : {}),
      })
      .select()
      .single());
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ override: data }, { status: 201 });
}
