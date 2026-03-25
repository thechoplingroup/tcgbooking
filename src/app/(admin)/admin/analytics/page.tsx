import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import AnalyticsPageClient from "./AnalyticsPageClient";

// Normalize Supabase join results (arrays to single objects)
function normalizeFirst<T>(val: T | T[] | null | undefined): T | null {
  if (Array.isArray(val)) return val[0] ?? null;
  return val ?? null;
}

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: stylist } = await supabase
    .from("stylists")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!stylist) {
    return <AnalyticsPageClient initialData={null} error="No stylist profile found" />;
  }

  const serviceClient = createServiceClient();
  const stylistId = stylist.id;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();

  // Run all independent queries in parallel (appointments + service logs)
  const [monthApptsResult, recentApptsResult, recentTenResult, monthLogsResult, allLogsResult] = await Promise.all([
    // This month's appointments with service details
    serviceClient
      .from("appointments")
      .select("*, service:services!service_id(id, name, duration_minutes, internal_price_cents)")
      .eq("stylist_id", stylistId)
      .gte("start_at", monthStart)
      .lte("start_at", monthEnd),
    // Last 6 months for trends + top services
    serviceClient
      .from("appointments")
      .select("start_at, status, service:services!service_id(id, name)")
      .eq("stylist_id", stylistId)
      .gte("start_at", sixMonthsAgo)
      .in("status", ["confirmed", "pending"]),
    // Recent 10 appointments
    serviceClient
      .from("appointments")
      .select("id, start_at, status, client:profiles!client_id(id, full_name), service:services!service_id(id, name)")
      .eq("stylist_id", stylistId)
      .order("start_at", { ascending: false })
      .limit(10),
    // This month's service logs
    serviceClient
      .from("client_service_log")
      .select("*")
      .eq("stylist_id", stylistId)
      .gte("visit_date", monthStart.slice(0, 10))
      .lte("visit_date", monthEnd.slice(0, 10)),
    // Last 6 months of service logs for trends
    serviceClient
      .from("client_service_log")
      .select("visit_date, service_name, price_cents")
      .eq("stylist_id", stylistId)
      .gte("visit_date", sixMonthsAgo.slice(0, 10)),
  ]);

  const appointments = monthApptsResult.data ?? [];
  const allRecent = recentApptsResult.data ?? [];
  const monthLogs = monthLogsResult.data ?? [];
  const allLogs = allLogsResult.data ?? [];

  // Total this month: appointments + service logs
  const totalThisMonth = appointments.length + monthLogs.length;

  // Revenue: confirmed appointment service prices + service log prices
  const confirmedAppts = appointments.filter((a) => a.status === "confirmed");
  const apptRevenueCents = confirmedAppts.reduce((sum: number, a: { service?: { internal_price_cents: number } | { internal_price_cents: number }[] | null }) => {
    const svc = Array.isArray(a.service) ? a.service[0] : a.service;
    const price = svc?.internal_price_cents ?? 0;
    return sum + price;
  }, 0);
  const logRevenueCents = monthLogs.reduce((sum: number, l: { price_cents: number }) => sum + (l.price_cents ?? 0), 0);
  const revenueCents = apptRevenueCents + logRevenueCents;

  // Completion rate: confirmed / (total - cancelled)
  const cancelled = appointments.filter((a) => a.status === "cancelled").length;
  const nonCancelled = totalThisMonth - cancelled;
  const completionRate = nonCancelled > 0 ? Math.round((confirmedAppts.length / nonCancelled) * 100) : 0;

  // New clients: clients whose first appointment (confirmed) was this month
  const clientIds = Array.from(new Set(appointments.filter((a) => a.client_id).map((a) => a.client_id)));
  let newClients = 0;
  if (clientIds.length > 0) {
    const { data: priorAppts } = await serviceClient
      .from("appointments")
      .select("client_id")
      .eq("stylist_id", stylistId)
      .in("client_id", clientIds)
      .lt("start_at", monthStart)
      .in("status", ["confirmed", "pending"]);

    const priorClientIds = new Set((priorAppts ?? []).map((a) => a.client_id));
    newClients = clientIds.filter((id) => !priorClientIds.has(id)).length;
  }

  // Day of week counts (appointments + service logs)
  const dayOfWeekCounts: number[] = [0, 0, 0, 0, 0, 0, 0];
  allRecent.forEach((a) => {
    const dow = new Date(a.start_at).getDay();
    dayOfWeekCounts[dow]++;
  });
  allLogs.forEach((l: { visit_date: string }) => {
    const dow = new Date(l.visit_date + "T12:00:00").getDay();
    dayOfWeekCounts[dow]++;
  });

  // Top 5 services (appointments + service logs)
  const serviceCounts: Record<string, { name: string; count: number }> = {};
  allRecent.forEach((a: { service?: { id: string; name: string } | { id: string; name: string }[] | null }) => {
    const svc = Array.isArray(a.service) ? a.service[0] : a.service;
    const name = svc?.name;
    if (name) {
      if (!serviceCounts[name]) serviceCounts[name] = { name, count: 0 };
      serviceCounts[name].count++;
    }
  });
  allLogs.forEach((l: { service_name: string }) => {
    const name = l.service_name;
    if (name) {
      if (!serviceCounts[name]) serviceCounts[name] = { name, count: 0 };
      serviceCounts[name].count++;
    }
  });
  const topServices = Object.values(serviceCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Monthly trend (last 6 months — appointments + service logs)
  const monthlyTrend: { month: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    const mStart = d.toISOString();
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const mStartDate = mStart.slice(0, 10);
    const mEndDate = mEnd.slice(0, 10);
    const apptCount = allRecent.filter((a) => a.start_at >= mStart && a.start_at <= mEnd).length;
    const logCount = allLogs.filter((l: { visit_date: string }) => l.visit_date >= mStartDate && l.visit_date <= mEndDate).length;
    monthlyTrend.push({ month: label, count: apptCount + logCount });
  }

  // Combine recent appointments + service logs, sorted by date
  const recentFromAppts = (recentTenResult.data ?? []).map((appt) => ({
    id: appt.id,
    start_at: appt.start_at,
    status: appt.status,
    client: normalizeFirst(appt.client),
    service: normalizeFirst(appt.service),
  }));

  // Fetch recent service logs with client info
  const { data: recentLogData } = await serviceClient
    .from("client_service_log")
    .select("id, visit_date, service_name, price_cents, client_id, walk_in_client_id")
    .eq("stylist_id", stylistId)
    .order("visit_date", { ascending: false })
    .limit(10);

  const recentFromLogs = (recentLogData ?? []).map((log) => ({
    id: log.id,
    start_at: log.visit_date + "T00:00:00Z",
    status: "logged" as string,
    client: null as { id: string; full_name: string | null } | null,
    service: { id: "", name: log.service_name } as { id: string; name: string },
  }));

  const recentAppointments = [...recentFromAppts, ...recentFromLogs]
    .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime())
    .slice(0, 10);

  return (
    <AnalyticsPageClient
      initialData={{
        totalThisMonth,
        revenueCents,
        newClients,
        completionRate,
        dayOfWeekCounts,
        topServices,
        monthlyTrend,
        recentAppointments,
      }}
    />
  );
}
