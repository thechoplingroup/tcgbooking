import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import Link from "next/link";
import PendingRequestsList from "@/components/PendingRequestsList";
import DashboardQuickActions from "@/components/DashboardQuickActions";
import ErrorBoundary from "@/components/ErrorBoundary";
import { STUDIO } from "@/config/studio";
import { formatTime, formatDuration, formatDateShort } from "@/lib/formatters";
import { studioDateString, studioDayStartUtcIso, studioDayEndUtcIso } from "@/lib/time";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: `Dashboard · ${STUDIO.name}`,
};

/** Shift a studio-local date string by N days. */
function shiftStudioDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const next = new Date(Date.UTC(y!, m! - 1, d! + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

function getTodayRange(): { start: string; end: string } {
  const today = studioDateString(new Date());
  return {
    start: studioDayStartUtcIso(today),
    end: studioDayEndUtcIso(today),
  };
}

function getWeekRange(): { start: string; end: string } {
  const today = studioDateString(new Date());
  const [y, m, d] = today.split("-").map(Number);
  const dow = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  const monday = shiftStudioDate(today, diff);
  const sunday = shiftStudioDate(monday, 6);
  return {
    start: studioDayStartUtcIso(monday),
    end: studioDayEndUtcIso(sunday),
  };
}

function getUpcomingRange(): { start: string; end: string } {
  const today = studioDateString(new Date());
  const tomorrow = shiftStudioDate(today, 1);
  const endDate = shiftStudioDate(tomorrow, 6);
  return {
    start: studioDayStartUtcIso(tomorrow),
    end: studioDayEndUtcIso(endDate),
  };
}

function getGreeting(): string {
  const hour = new Date().toLocaleString("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: STUDIO.timezone,
  });
  const h = parseInt(hour, 10);
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  return "Good evening";
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="text-center py-16">
        <p className="text-[#8a7e78]">Please sign in to view your dashboard.</p>
        <Link href="/login" className="text-[#9b6f6f] text-sm mt-2 block hover:underline">
          Sign in →
        </Link>
      </div>
    );
  }

  const { data: stylist } = await supabase
    .from("stylists").select("id, name, bio, avatar_url").eq("user_id", user.id).single();

  if (!stylist) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <div className="w-16 h-16 rounded-full bg-[#f5ede8] flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-[#9b6f6f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <h1 className="font-display text-2xl text-[#1a1714] mb-2">Welcome, {STUDIO.ownerName}!</h1>
        <p className="text-[#8a7e78] text-sm mb-6">Let&apos;s set up your profile to start accepting bookings.</p>
        <Link
          href="/admin/profile"
          className="inline-flex items-center px-6 py-3 bg-[#9b6f6f] text-white text-sm font-semibold rounded-full hover:bg-[#8a5f5f] transition-colors min-h-[48px]"
        >
          Create Profile
        </Link>
      </div>
    );
  }

  const today = getTodayRange();
  const week = getWeekRange();
  const upcoming = getUpcomingRange();
  const svc = createServiceClient();

  const [
    { data: todayAppts },
    { count: weekCount },
    { count: pendingCount },
    { data: pendingAppts },
    { data: upcomingAppts },
  ] = await Promise.all([
    svc
      .from("appointments")
      .select(`*, client:profiles!client_id(id, full_name), walk_in:walk_in_clients!walk_in_client_id(id, full_name), service:services!service_id(id, name, duration_minutes, internal_price_cents), appointment_services(service_id, service:services(id, name, duration_minutes))`)
      .eq("stylist_id", stylist.id)
      .eq("status", "confirmed")
      .gte("start_at", today.start)
      .lte("start_at", today.end)
      .order("start_at"),
    svc
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("stylist_id", stylist.id)
      .in("status", ["pending", "confirmed"])
      .gte("start_at", week.start)
      .lte("start_at", week.end),
    svc
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("stylist_id", stylist.id)
      .eq("status", "pending")
      .gte("start_at", new Date().toISOString()),
    svc
      .from("appointments")
      .select(`*, client:profiles!client_id(id, full_name), walk_in:walk_in_clients!walk_in_client_id(id, full_name), service:services!service_id(id, name, duration_minutes), appointment_services(service_id, service:services(id, name, duration_minutes))`)
      .eq("stylist_id", stylist.id)
      .eq("status", "pending")
      .gte("start_at", new Date().toISOString())
      .order("start_at")
      .limit(10),
    svc
      .from("appointments")
      .select(`*, client:profiles!client_id(id, full_name), walk_in:walk_in_clients!walk_in_client_id(id, full_name), service:services!service_id(id, name, duration_minutes), appointment_services(service_id, service:services(id, name, duration_minutes))`)
      .eq("stylist_id", stylist.id)
      .in("status", ["pending", "confirmed"])
      .gte("start_at", upcoming.start)
      .lte("start_at", upcoming.end)
      .order("start_at")
      .limit(20),
  ]);

  const todayList = todayAppts ?? [];
  const pendingList = pendingAppts ?? [];
  const upcomingList = upcomingAppts ?? [];

  // Resolve emails for auth clients whose full_name is null
  const allAppts = [...todayList, ...pendingList, ...upcomingList];
  const nullNameClientIds: string[] = [];
  for (const a of allAppts) {
    const raw = a.client;
    const client = Array.isArray(raw) ? raw[0] : raw;
    if (client && !client.full_name) nullNameClientIds.push(client.id);
  }

  let clientEmailMap = new Map<string, string>();
  if (nullNameClientIds.length > 0) {
    const { resolveEmails } = await import("@/lib/supabase/resolve-emails");
    clientEmailMap = await resolveEmails(Array.from(new Set(nullNameClientIds)));
  }

  /** Normalize client — service client may return array instead of object from join */
  function normalizeClient(raw: unknown): { id: string; full_name: string | null } | null {
    if (!raw) return null;
    if (Array.isArray(raw)) return raw[0] ?? null;
    return raw as { id: string; full_name: string | null };
  }

  /** Get display name: auth full_name → email prefix → walk-in full_name → name */
  function getClientName(appt: unknown): string {
    const a = appt as { client?: unknown; walk_in?: unknown } | null;
    const client = normalizeClient(a?.client);
    if (client?.full_name) return client.full_name;
    if (client) {
      const email = clientEmailMap.get(client.id);
      if (email) return email.split("@")[0]!;
    }
    const walkIn = normalizeClient(a?.walk_in);
    if (walkIn?.full_name) return walkIn.full_name;
    return "Unknown";
  }

  const now = new Date();
  const todayDate = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: STUDIO.timezone,
  });

  const greeting = getGreeting();

  return (
    <ErrorBoundary>
    <div className="max-w-lg mx-auto">
      {/* Greeting */}
      <div className="mb-6">
        <p className="text-xs text-[#c9a96e] uppercase tracking-widest font-medium mb-1">{todayDate}</p>
        <h1 className="font-display text-3xl text-[#1a1714]">{greeting}, {STUDIO.ownerName}</h1>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="bg-white rounded-2xl border border-[#e8e2dc] p-3 sm:p-4 text-center">
          <p className="text-2xl font-bold text-[#9b6f6f]">{todayList.length}</p>
          <p className="text-[10px] text-[#8a7e78] mt-0.5 uppercase tracking-wide">Today</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8e2dc] p-3 sm:p-4 text-center">
          <p className="text-2xl font-bold text-[#c9a96e]">{weekCount ?? 0}</p>
          <p className="text-[10px] text-[#8a7e78] mt-0.5 uppercase tracking-wide">This Week</p>
        </div>
        <div className={`rounded-2xl border p-3 sm:p-4 text-center ${(pendingCount ?? 0) > 0 ? "bg-[#fffbeb] border-[#fcd34d]" : "bg-white border-[#e8e2dc]"}`}>
          <p className={`text-2xl font-bold ${(pendingCount ?? 0) > 0 ? "text-[#d97706]" : "text-[#8a7e78]"}`}>
            {pendingCount ?? 0}
          </p>
          <p className="text-[10px] text-[#8a7e78] mt-0.5 uppercase tracking-wide">Pending</p>
        </div>
      </div>

      {/* Quick actions */}
      <DashboardQuickActions />

      {/* PENDING REQUESTS */}
      <div className={`rounded-2xl border mb-5 overflow-hidden ${(pendingCount ?? 0) > 0 ? "border-[#fcd34d] bg-[#fffbeb]" : "border-[#e8e2dc] bg-white"}`}>
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#f3e8c8]">
          <div className="flex items-center gap-2.5">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full font-bold text-xs ${(pendingCount ?? 0) > 0 ? "bg-[#d97706] text-white" : "bg-[#e8e2dc] text-[#8a7e78]"}`}>
              {(pendingCount ?? 0) > 0 ? (
                <span className="flex items-center">
                  {pendingCount}
                </span>
              ) : "0"}
            </div>
            <div>
              <h2 className="font-display text-lg text-[#1a1714] leading-none">Pending Requests</h2>
              {(pendingCount ?? 0) > 0 && (
                <p className="text-xs text-[#d97706] mt-0.5">Clients waiting for confirmation</p>
              )}
            </div>
          </div>
          {(pendingCount ?? 0) > 0 && (
            <Link href="/admin/appointments" className="text-xs text-[#d97706] font-semibold min-h-[44px] flex items-center">
              View all →
            </Link>
          )}
        </div>

        <PendingRequestsList
          initialAppts={(pendingList ?? []).map((appt) => ({
            id: appt.id as string,
            start_at: appt.start_at as string,
            client: appt.client as { id: string; full_name: string | null } | null,
            service: appt.service as { id: string; name: string; duration_minutes: number } | null,
            appointment_services: (appt as { appointment_services?: Array<{ service_id: string; service: { id: string; name: string; duration_minutes: number } | null }> }).appointment_services ?? null,
            client_notes: (appt as { client_notes?: string | null }).client_notes ?? null,
          }))}
        />
      </div>

      {/* TODAY'S SCHEDULE */}
      <div className="bg-white rounded-2xl border border-[#e8e2dc] overflow-hidden mb-5">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#e8e2dc]">
          <h2 className="font-display text-lg text-[#1a1714]">Today&apos;s Schedule</h2>
          <Link href="/admin/appointments" className="text-xs text-[#9b6f6f] font-medium min-h-[44px] flex items-center">
            View all →
          </Link>
        </div>

        {todayList.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="w-10 h-10 rounded-full bg-[#f5ede8] flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-[#c9a96e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            </div>
            <p className="text-sm text-[#1a1714] font-medium">No confirmed appointments today</p>
            <p className="text-xs text-[#8a7e78] mt-1">Enjoy your day ✨</p>
          </div>
        ) : (
          <div className="divide-y divide-[#f5f0eb]">
            {todayList.map((appt) => {
              const service = appt.service as { id: string; name: string; duration_minutes: number } | null;
              const apptServices = (appt as { appointment_services?: Array<{ service_id: string; service: { id: string; name: string; duration_minutes: number } | null }> }).appointment_services;
              // Prefer appointment_services, fall back to primary service
              const allSvcs = apptServices && apptServices.length > 0
                ? apptServices.map((as_row) => as_row.service).filter((s): s is { id: string; name: string; duration_minutes: number } => s !== null)
                : service ? [service] : [];
              const svcNames = allSvcs.map((s) => s.name).join(", ") || "Service";
              const svcDuration = allSvcs.reduce((sum, s) => sum + s.duration_minutes, 0);

              return (
                <div key={appt.id} className="px-4 py-3.5 flex items-center gap-3">
                  <div className="flex-shrink-0 text-center min-w-[56px]">
                    <p className="text-sm font-bold text-[#1a1714]">{formatTime(appt.start_at as string)}</p>
                    <p className="text-[10px] text-[#8a7e78]">{svcDuration > 0 ? formatDuration(svcDuration) : ""}</p>
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-center self-stretch py-1">
                    <div className="w-2 h-2 rounded-full bg-[#9b6f6f] flex-shrink-0 mt-0.5" />
                    <div className="w-px flex-1 bg-[#e8e2dc] mt-1" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1a1714] truncate">
                      {getClientName(appt)}
                    </p>
                    <p className="text-xs text-[#8a7e78] mt-0.5 truncate">{svcNames}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 flex-shrink-0">
                    Confirmed
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* UPCOMING SCHEDULE */}
      <div className="bg-white rounded-2xl border border-[#e8e2dc] overflow-hidden mb-5">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#e8e2dc]">
          <h2 className="font-display text-lg text-[#1a1714]">Upcoming Schedule</h2>
          <Link href="/admin/appointments" className="text-xs text-[#9b6f6f] font-medium min-h-[44px] flex items-center">
            View all →
          </Link>
        </div>

        {upcomingList.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="w-10 h-10 rounded-full bg-[#f5ede8] flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-[#c9a96e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm text-[#1a1714] font-medium">No upcoming appointments</p>
            <p className="text-xs text-[#8a7e78] mt-1">Your next 7 days are clear</p>
          </div>
        ) : (
          <div className="divide-y divide-[#f5f0eb]">
            {(() => {
              let lastDate = "";
              return upcomingList.map((appt) => {
                const service = appt.service as { id: string; name: string; duration_minutes: number } | null;
                const apptServices = (appt as { appointment_services?: Array<{ service_id: string; service: { id: string; name: string; duration_minutes: number } | null }> }).appointment_services;
                const status = appt.status as string;

                const allSvcs = apptServices && apptServices.length > 0
                  ? apptServices.map((as_row) => as_row.service).filter((s): s is { id: string; name: string; duration_minutes: number } => s !== null)
                  : service ? [service] : [];
                const svcNames = allSvcs.map((s) => s.name).join(", ") || "Service";
                const svcDuration = allSvcs.reduce((sum, s) => sum + s.duration_minutes, 0);

                const dateStr = formatDateShort(appt.start_at as string);
                const showDate = dateStr !== lastDate;
                lastDate = dateStr;

                return (
                  <div key={appt.id}>
                    {showDate && (
                      <div className="px-4 pt-3 pb-1">
                        <p className="text-[10px] font-semibold text-[#c9a96e] uppercase tracking-widest">{dateStr}</p>
                      </div>
                    )}
                    <div className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-shrink-0 text-center min-w-[56px]">
                        <p className="text-sm font-bold text-[#1a1714]">{formatTime(appt.start_at as string)}</p>
                        <p className="text-[10px] text-[#8a7e78]">{svcDuration > 0 ? formatDuration(svcDuration) : ""}</p>
                      </div>
                      <div className="flex-shrink-0 flex flex-col items-center self-stretch py-1">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-0.5 ${status === "confirmed" ? "bg-[#9b6f6f]" : "bg-[#d97706]"}`} />
                        <div className="w-px flex-1 bg-[#e8e2dc] mt-1" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#1a1714] truncate">
                          {getClientName(appt)}
                        </p>
                        <p className="text-xs text-[#8a7e78] mt-0.5 truncate">{svcNames}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${status === "confirmed" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {status === "confirmed" ? "Confirmed" : "Pending"}
                      </span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>
    </div>
    </ErrorBoundary>
  );
}
