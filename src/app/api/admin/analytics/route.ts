import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: stylist } = await supabase
    .from("stylists")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!stylist) {
    return NextResponse.json({ error: "No stylist profile" }, { status: 400 });
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  // 6 months ago for trend
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();

  // Fetch all appointments for this month (with details)
  const { data: monthAppts } = await supabase
    .from("appointments")
    .select("*, service:services!service_id(id, name, duration_minutes, internal_price_cents)")
    .eq("stylist_id", stylist.id)
    .gte("start_at", monthStart)
    .lte("start_at", monthEnd);

  const appointments = monthAppts ?? [];

  // Total appointments this month
  const totalThisMonth = appointments.length;

  // Revenue: sum of service prices for confirmed appointments
  const confirmedAppts = appointments.filter((a) => a.status === "confirmed");
  const revenueCents = confirmedAppts.reduce((sum: number, a: { service?: { internal_price_cents: number } | { internal_price_cents: number }[] | null }) => {
    const svc = Array.isArray(a.service) ? a.service[0] : a.service;
    const price = svc?.internal_price_cents ?? 0;
    return sum + price;
  }, 0);

  // Completion rate: confirmed / (total - cancelled)
  const cancelled = appointments.filter((a) => a.status === "cancelled").length;
  const nonCancelled = totalThisMonth - cancelled;
  const completionRate = nonCancelled > 0 ? Math.round((confirmedAppts.length / nonCancelled) * 100) : 0;

  // New clients: clients whose first appointment (confirmed) was this month
  const clientIds = Array.from(new Set(appointments.filter((a) => a.client_id).map((a) => a.client_id)));
  let newClients = 0;
  if (clientIds.length > 0) {
    // For each client, check if they have any appointment before this month
    const { data: priorAppts } = await supabase
      .from("appointments")
      .select("client_id")
      .eq("stylist_id", stylist.id)
      .in("client_id", clientIds)
      .lt("start_at", monthStart)
      .in("status", ["confirmed", "pending"]);

    const priorClientIds = new Set((priorAppts ?? []).map((a) => a.client_id));
    newClients = clientIds.filter((id) => !priorClientIds.has(id)).length;
  }

  // Busiest days of week (all time recent 6 months)
  const { data: recentAppts } = await supabase
    .from("appointments")
    .select("start_at, status, service_id")
    .eq("stylist_id", stylist.id)
    .gte("start_at", sixMonthsAgo)
    .in("status", ["confirmed", "pending"]);

  const allRecent = recentAppts ?? [];

  // Day of week counts
  const dayOfWeekCounts: number[] = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
  allRecent.forEach((a) => {
    const dow = new Date(a.start_at).getDay();
    dayOfWeekCounts[dow]++;
  });

  // Top 5 services
  const { data: sixMonthAppts } = await supabase
    .from("appointments")
    .select("service:services!service_id(id, name)")
    .eq("stylist_id", stylist.id)
    .gte("start_at", sixMonthsAgo)
    .in("status", ["confirmed", "pending"]);

  const serviceCounts: Record<string, { name: string; count: number }> = {};
  (sixMonthAppts ?? []).forEach((a: { service?: { id: string; name: string } | { id: string; name: string }[] | null }) => {
    const svc = Array.isArray(a.service) ? a.service[0] : a.service;
    const name = svc?.name;
    if (name) {
      if (!serviceCounts[name]) serviceCounts[name] = { name, count: 0 };
      serviceCounts[name].count++;
    }
  });
  const topServices = Object.values(serviceCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Monthly trend (last 6 months)
  const monthlyTrend: { month: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    const mStart = d.toISOString();
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const count = allRecent.filter((a) => a.start_at >= mStart && a.start_at <= mEnd).length;
    monthlyTrend.push({ month: label, count });
  }

  // Recent 10 appointments
  const { data: recentTen } = await supabase
    .from("appointments")
    .select("*, client:profiles!client_id(id, full_name), service:services!service_id(id, name)")
    .eq("stylist_id", stylist.id)
    .order("start_at", { ascending: false })
    .limit(10);

  return NextResponse.json({
    totalThisMonth,
    revenueCents,
    newClients,
    completionRate,
    dayOfWeekCounts,
    topServices,
    monthlyTrend,
    recentAppointments: recentTen ?? [],
  });
}
