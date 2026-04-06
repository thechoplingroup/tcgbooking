import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import {
  parseTime,
  generateSlots,
  filterAvailableSlots,
  formatSlot,
} from "@/lib/availability";
import {
  studioDayStartUtcIso,
  studioDayEndUtcIso,
  studioMinutesFromMidnight,
  studioDateString,
} from "@/lib/time";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date"); // YYYY-MM-DD
  const serviceId = searchParams.get("serviceId");
  const serviceIds = searchParams.get("serviceIds"); // comma-separated

  if (!dateStr || (!serviceId && !serviceIds)) {
    return NextResponse.json(
      { error: "date and serviceId (or serviceIds) are required" },
      { status: 400 }
    );
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }

  const supabase = await createClient();

  // Get service duration(s)
  let duration: number;

  if (serviceIds) {
    const ids = serviceIds.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({ error: "serviceIds must not be empty" }, { status: 400 });
    }
    const { data: services, error: svcErr } = await supabase
      .from("services")
      .select("id, duration_minutes, is_active")
      .in("id", ids)
      .eq("stylist_id", params.id);

    if (svcErr || !services || services.length !== ids.length) {
      return NextResponse.json({ error: "One or more services not found" }, { status: 404 });
    }
    if (services.some((s) => !s.is_active)) {
      return NextResponse.json({ error: "One or more services are inactive" }, { status: 400 });
    }
    duration = services.reduce((sum, s) => sum + (s.duration_minutes as number), 0);
  } else {
    const { data: service, error: svcErr } = await supabase
      .from("services")
      .select("id, duration_minutes, is_active")
      .eq("id", serviceId!)
      .eq("stylist_id", params.id)
      .single();

    if (svcErr || !service || !service.is_active) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }
    duration = service.duration_minutes as number;
  }

  // Day of week (studio-local): 0 = Sunday
  const dateParts = dateStr.split("-").map(Number);
  const dayOfWeek = new Date(
    Date.UTC(dateParts[0]!, dateParts[1]! - 1, dateParts[2]!),
  ).getUTCDay();

  // ── 1. Default operational hours for the day ──────────────────────────────
  const { data: defaultHours } = await supabase
    .from("operational_hours")
    .select("open_time, close_time")
    .eq("stylist_id", params.id)
    .eq("day_of_week", dayOfWeek)
    .single();

  // ── 2. Fetch overrides covering this date + day_of_week ───────────────────
  // An override applies if:
  //   effective_from <= dateStr <= effective_until
  //   AND (day_of_week = requested day OR day_of_week IS NULL)
  const { data: overrideRows } = await supabase
    .from("operational_hours_overrides")
    .select("*")
    .eq("stylist_id", params.id)
    .lte("effective_from", dateStr)
    .gte("effective_until", dateStr)
    .or(`day_of_week.eq.${dayOfWeek},day_of_week.is.null`);

  // Pick the most specific override (day_of_week match wins over null/all-days)
  let activeOverride: {
    is_closed: boolean;
    open_time: string | null;
    close_time: string | null;
  } | null = null;

  if (overrideRows && overrideRows.length > 0) {
    // Prefer a day-specific override; fall back to all-day override
    const specific = overrideRows.find(
      (r) => r.day_of_week === dayOfWeek
    );
    activeOverride = specific ?? overrideRows[0]!;
  }

  // ── 3. Resolve effective hours ────────────────────────────────────────────
  let openMin: number;
  let closeMin: number;

  if (activeOverride) {
    if (activeOverride.is_closed || !activeOverride.open_time || !activeOverride.close_time) {
      // Closed by override
      return NextResponse.json({ slots: [] });
    }
    openMin = parseTime(activeOverride.open_time);
    closeMin = parseTime(activeOverride.close_time);
  } else if (defaultHours) {
    openMin = parseTime(defaultHours.open_time as string);
    closeMin = parseTime(defaultHours.close_time as string);
  } else {
    // No hours defined at all
    return NextResponse.json({ slots: [] });
  }

  // Generate candidate slots (every 30 min)
  const candidates = generateSlots(openMin, closeMin, duration, 30);

  if (candidates.length === 0) {
    return NextResponse.json({ slots: [] });
  }

  // Fetch existing appointments for this day — window is studio-local midnight
  // expressed as real UTC ISO instants.
  const dayStart = studioDayStartUtcIso(dateStr);
  const dayEnd = studioDayEndUtcIso(dateStr);

  const { data: appointments } = await supabase
    .from("appointments")
    .select("start_at, end_at")
    .eq("stylist_id", params.id)
    .in("status", ["pending", "confirmed"])
    .lt("start_at", dayEnd)
    .gt("end_at", dayStart);

  // Fetch blocked_times overlapping this day
  const { data: blocked } = await supabase
    .from("blocked_times")
    .select("start_at, end_at")
    .eq("stylist_id", params.id)
    .lt("start_at", dayEnd)
    .gt("end_at", dayStart);

  // Convert busy ranges to minute-offsets from studio-local midnight.
  // Ranges that straddle midnight are clamped to [0, 1440].
  function toStudioMinutes(isoStr: string, anchorDayStartIso: string): number {
    const t = new Date(isoStr).getTime();
    const dayStartMs = new Date(anchorDayStartIso).getTime();
    const raw = Math.round((t - dayStartMs) / 60000);
    // Fall back to studio clock conversion if the value isn't within today.
    if (raw < 0) return 0;
    if (raw > 1440) return 1440;
    return raw;
  }

  const busyRanges = [
    ...(appointments ?? []).map((a) => ({
      start: toStudioMinutes(a.start_at as string, dayStart),
      end: toStudioMinutes(a.end_at as string, dayStart),
    })),
    ...(blocked ?? []).map((b) => ({
      start: toStudioMinutes(b.start_at as string, dayStart),
      end: toStudioMinutes(b.end_at as string, dayStart),
    })),
  ];

  // Also skip slots in the past (if today in studio-local calendar).
  const now = new Date();
  const studioToday = studioDateString(now);
  const isToday = dateStr === studioToday;
  const nowMinutes = isToday ? studioMinutesFromMidnight(now) : -1;

  const available = filterAvailableSlots(candidates, busyRanges, isToday, nowMinutes);

  // Format as ISO strings for the given date
  const slots = available.map(({ startMin, endMin }) =>
    formatSlot(dateStr, startMin, endMin)
  );

  return NextResponse.json(
    { slots },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
