import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Parse "HH:MM:SS" into total minutes
function parseTime(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function overlaps(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date"); // YYYY-MM-DD
  const serviceId = searchParams.get("serviceId");

  if (!dateStr || !serviceId) {
    return NextResponse.json(
      { error: "date and serviceId are required" },
      { status: 400 }
    );
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }

  const supabase = await createClient();

  // Get service duration (no price exposed)
  const { data: service, error: svcErr } = await supabase
    .from("services")
    .select("id, duration_minutes, is_active")
    .eq("id", serviceId)
    .eq("stylist_id", params.id)
    .single();

  if (svcErr || !service || !service.is_active) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  const duration = service.duration_minutes as number;

  // Day of week: 0 = Sunday
  const dateParts = dateStr.split("-").map(Number);
  const dateObj = new Date(Date.UTC(dateParts[0]!, dateParts[1]! - 1, dateParts[2]!));
  const dayOfWeek = dateObj.getUTCDay();

  // Operational hours for that day
  const { data: hours } = await supabase
    .from("operational_hours")
    .select("open_time, close_time")
    .eq("stylist_id", params.id)
    .eq("day_of_week", dayOfWeek)
    .single();

  if (!hours) {
    return NextResponse.json({ slots: [] });
  }

  const openMin = parseTime(hours.open_time as string);
  const closeMin = parseTime(hours.close_time as string);

  // Generate candidate slots (every 30 min)
  const slotInterval = 30;
  const candidates: Array<{ startMin: number; endMin: number }> = [];
  for (let start = openMin; start + duration <= closeMin; start += slotInterval) {
    candidates.push({ startMin: start, endMin: start + duration });
  }

  if (candidates.length === 0) {
    return NextResponse.json({ slots: [] });
  }

  // Fetch existing appointments for this day
  const dayStart = `${dateStr}T00:00:00+00:00`;
  const dayEnd = `${dateStr}T23:59:59+00:00`;

  const { data: appointments } = await supabase
    .from("appointments")
    .select("start_at, end_at")
    .eq("stylist_id", params.id)
    .in("status", ["pending", "confirmed"])
    .lte("start_at", dayEnd)
    .gte("end_at", dayStart);

  // Fetch blocked_times overlapping this day
  const { data: blocked } = await supabase
    .from("blocked_times")
    .select("start_at, end_at")
    .eq("stylist_id", params.id)
    .lte("start_at", dayEnd)
    .gte("end_at", dayStart);

  // Convert appointments and blocked times to minute-offsets from midnight UTC
  function toMinutesFromMidnight(isoStr: string): number {
    const d = new Date(isoStr);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  }

  const busyRanges = [
    ...(appointments ?? []).map((a) => ({
      start: toMinutesFromMidnight(a.start_at as string),
      end: toMinutesFromMidnight(a.end_at as string),
    })),
    ...(blocked ?? []).map((b) => ({
      start: toMinutesFromMidnight(b.start_at as string),
      end: toMinutesFromMidnight(b.end_at as string),
    })),
  ];

  // Also skip slots in the past (if today)
  const now = new Date();
  const todayUTC = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  const isToday = dateStr === todayUTC;
  const nowMinutes = isToday ? now.getUTCHours() * 60 + now.getUTCMinutes() : -1;

  const available = candidates.filter(({ startMin, endMin }) => {
    if (isToday && startMin <= nowMinutes) return false;
    return !busyRanges.some((r) => overlaps(startMin, endMin, r.start, r.end));
  });

  // Format as ISO strings for the given date
  const slots = available.map(({ startMin, endMin }) => {
    const sh = String(Math.floor(startMin / 60)).padStart(2, "0");
    const sm = String(startMin % 60).padStart(2, "0");
    const eh = String(Math.floor(endMin / 60)).padStart(2, "0");
    const em = String(endMin % 60).padStart(2, "0");
    return {
      start_at: `${dateStr}T${sh}:${sm}:00Z`,
      end_at: `${dateStr}T${eh}:${em}:00Z`,
    };
  });

  return NextResponse.json({ slots });
}
