import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import AdminAppointmentActions from "@/components/AdminAppointmentActions";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function centsToDisplay(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

function getDayRange(offset: number = 0): { start: string; end: string } {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset));
  const start = d.toISOString().split("T")[0]! + "T00:00:00.000Z";
  const end = d.toISOString().split("T")[0]! + "T23:59:59.999Z";
  return { start, end };
}

function getWeekRange(): { start: string; end: string } {
  const now = new Date();
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayOfWeek = monday.getUTCDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  monday.setUTCDate(monday.getUTCDate() + diff);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    start: monday.toISOString().split("T")[0]! + "T00:00:00.000Z",
    end: sunday.toISOString().split("T")[0]! + "T23:59:59.999Z",
  };
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
        <h1 className="font-display text-2xl text-[#1a1714] mb-2">Welcome!</h1>
        <p className="text-[#8a7e78] text-sm mb-6">
          Let&apos;s set up your profile to start accepting bookings.
        </p>
        <Link
          href="/admin/profile"
          className="inline-flex items-center px-6 py-2.5 bg-[#9b6f6f] text-white text-sm font-medium rounded-full hover:bg-[#8a5f5f] transition-colors"
        >
          Create Profile
        </Link>
      </div>
    );
  }

  // Fetch data in parallel
  const today = getDayRange(0);
  const tomorrow = getDayRange(1);
  const week = getWeekRange();

  const [
    { data: todayAppts },
    { data: tomorrowAppts },
    { count: weekCount },
    { count: pendingCount },
    { data: weekRevAppts },
    { data: upcomingAppts },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select(`*, client:profiles!client_id(id, full_name), service:services!service_id(id, name, duration_minutes, internal_price_cents)`)
      .eq("stylist_id", stylist.id)
      .in("status", ["pending", "confirmed"])
      .gte("start_at", today.start)
      .lte("start_at", today.end)
      .order("start_at"),
    supabase
      .from("appointments")
      .select("id, start_at, service:services!service_id(name)")
      .eq("stylist_id", stylist.id)
      .in("status", ["pending", "confirmed"])
      .gte("start_at", tomorrow.start)
      .lte("start_at", tomorrow.end)
      .order("start_at"),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("stylist_id", stylist.id)
      .in("status", ["pending", "confirmed"])
      .gte("start_at", week.start)
      .lte("start_at", week.end),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("stylist_id", stylist.id)
      .eq("status", "pending")
      .gte("start_at", new Date().toISOString()),
    supabase
      .from("appointments")
      .select(`service:services!service_id(internal_price_cents)`)
      .eq("stylist_id", stylist.id)
      .eq("status", "confirmed")
      .gte("start_at", week.start)
      .lte("start_at", week.end),
    supabase
      .from("appointments")
      .select(`*, client:profiles!client_id(id, full_name), service:services!service_id(id, name, duration_minutes, internal_price_cents)`)
      .eq("stylist_id", stylist.id)
      .in("status", ["pending", "confirmed"])
      .gte("start_at", new Date().toISOString())
      .order("start_at")
      .limit(5),
  ]);

  // Calculate weekly revenue
  const weeklyRevenue = (weekRevAppts ?? []).reduce((sum, a) => {
    const price = (a.service as { internal_price_cents?: number } | null)?.internal_price_cents ?? 0;
    return sum + price;
  }, 0);

  const todayList = todayAppts ?? [];
  const tomorrowList = tomorrowAppts ?? [];
  const upcomingList = upcomingAppts ?? [];

  const now = new Date();
  const todayDate = now.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs text-[#c9a96e] uppercase tracking-widest font-medium mb-1">{todayDate}</p>
        <h1 className="font-display text-3xl sm:text-4xl text-[#1a1714]">
          Good day, {stylist.name.split(" ")[0]}
        </h1>
        <p className="text-[#8a7e78] text-sm mt-1">
          Here&apos;s what&apos;s happening at your studio today.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {[
          {
            label: "Today",
            value: todayList.length,
            sub: "appointments",
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            ),
            accent: "#9b6f6f",
            bg: "#f5ede8",
          },
          {
            label: "This Week",
            value: weekCount ?? 0,
            sub: "total booked",
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            ),
            accent: "#c9a96e",
            bg: "#fdf6ec",
          },
          {
            label: "Pending",
            value: pendingCount ?? 0,
            sub: "need confirmation",
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            ),
            accent: (pendingCount ?? 0) > 0 ? "#d97706" : "#9b6f6f",
            bg: (pendingCount ?? 0) > 0 ? "#fffbeb" : "#f5ede8",
          },
          {
            label: "Est. Revenue",
            value: centsToDisplay(weeklyRevenue),
            sub: "this week (confirmed)",
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
            accent: "#4a7c59",
            bg: "#f0faf4",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-2xl border border-[#e8e2dc] p-4 sm:p-5"
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
              style={{ background: stat.bg, color: stat.accent }}
            >
              {stat.icon}
            </div>
            <p
              className="text-2xl sm:text-3xl font-bold"
              style={{ color: stat.accent }}
            >
              {stat.value}
            </p>
            <p className="text-xs text-[#8a7e78] mt-0.5">{stat.sub}</p>
            <p className="text-xs font-medium text-[#5c4a42] mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Schedule — takes 2 cols */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-[#e8e2dc] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e8e2dc]">
              <div>
                <h2 className="font-display text-lg text-[#1a1714]">Today&apos;s Schedule</h2>
                <p className="text-xs text-[#8a7e78] mt-0.5">
                  {todayList.length === 0
                    ? "No appointments today"
                    : `${todayList.length} appointment${todayList.length > 1 ? "s" : ""}`}
                </p>
              </div>
              <Link
                href="/admin/appointments"
                className="text-xs text-[#9b6f6f] hover:text-[#8a5f5f] font-medium"
              >
                View all →
              </Link>
            </div>

            {todayList.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <div className="w-12 h-12 rounded-full bg-[#f5ede8] flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-[#c9a96e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                </div>
                <p className="text-sm text-[#1a1714] font-medium">Enjoy your day off!</p>
                <p className="text-xs text-[#8a7e78] mt-1">No appointments scheduled for today.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#f5f0eb]">
                {todayList.map((appt) => {
                  const service = appt.service as { id: string; name: string; duration_minutes: number; internal_price_cents: number } | null;
                  const client = appt.client as { id: string; full_name: string | null } | null;
                  const isPending = appt.status === "pending";
                  const isNext = (() => {
                    const start = new Date(appt.start_at);
                    return start > now;
                  })();

                  return (
                    <div key={appt.id} className={`px-5 py-4 flex items-start gap-4 ${isNext && isPending ? "bg-amber-50/40" : ""}`}>
                      {/* Time */}
                      <div className="flex-shrink-0 w-14 text-center">
                        <p className="text-sm font-semibold text-[#1a1714]">
                          {formatTime(appt.start_at)}
                        </p>
                        <p className="text-[10px] text-[#8a7e78]">
                          {service ? formatDuration(service.duration_minutes) : ""}
                        </p>
                      </div>

                      {/* Divider */}
                      <div className="flex-shrink-0 flex flex-col items-center self-stretch py-1">
                        <div className="w-2 h-2 rounded-full bg-[#9b6f6f] flex-shrink-0 mt-0.5" />
                        <div className="w-px flex-1 bg-[#e8e2dc] mt-1" />
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-[#1a1714]">
                              {client?.full_name ?? "Guest"}
                            </p>
                            <p className="text-xs text-[#8a7e78] mt-0.5">
                              {service?.name ?? "Service"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {service?.internal_price_cents && (
                              <span className="text-xs font-medium text-[#4a7c59]">
                                {centsToDisplay(service.internal_price_cents)}
                              </span>
                            )}
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              appt.status === "confirmed"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            }`}>
                              {appt.status === "confirmed" ? "Confirmed" : "Pending"}
                            </span>
                          </div>
                        </div>
                        {isPending && (
                          <AdminAppointmentActions
                            appointmentId={appt.id}
                            inline
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Pending actions */}
          {(pendingCount ?? 0) > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <p className="text-sm font-semibold text-amber-800">
                  {pendingCount} pending {pendingCount === 1 ? "request" : "requests"}
                </p>
              </div>
              <p className="text-xs text-amber-700 mb-4">
                Clients are waiting for confirmation. Confirm or cancel to notify them.
              </p>
              <Link
                href="/admin/appointments"
                className="block w-full text-center py-2 bg-amber-600 text-white text-xs font-semibold rounded-xl hover:bg-amber-700 transition-colors"
              >
                Review Now →
              </Link>
            </div>
          )}

          {/* Tomorrow preview */}
          <div className="bg-white rounded-2xl border border-[#e8e2dc] p-5">
            <h3 className="text-sm font-semibold text-[#1a1714] mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-[#c9a96e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                  d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
              Tomorrow
            </h3>
            {tomorrowList.length === 0 ? (
              <p className="text-xs text-[#8a7e78]">Nothing scheduled yet.</p>
            ) : (
              <div className="space-y-2">
                {tomorrowList.slice(0, 4).map((appt) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const svcObj = Array.isArray(appt.service) ? (appt.service[0] as { name: string } | undefined) : (appt.service as { name: string } | null);
                  return (
                    <div key={appt.id} className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[#9b6f6f] w-14 flex-shrink-0">
                        {formatTime(appt.start_at)}
                      </span>
                      <span className="text-xs text-[#5c4a42] truncate">{svcObj?.name ?? "Service"}</span>
                    </div>
                  );
                })}
                {tomorrowList.length > 4 && (
                  <p className="text-xs text-[#8a7e78]">+{tomorrowList.length - 4} more</p>
                )}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="bg-white rounded-2xl border border-[#e8e2dc] p-5">
            <h3 className="text-sm font-semibold text-[#1a1714] mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { href: "/admin/blocked-times", label: "Block Time Off", icon: "🚫" },
                { href: "/admin/services", label: "Edit Services", icon: "✂️" },
                { href: "/admin/hours", label: "Manage Hours", icon: "🕘" },
                { href: "/book", label: "Share Booking Link", icon: "🔗", external: true },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  target={action.external ? "_blank" : undefined}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[#f5ede8] transition-colors group"
                >
                  <span className="text-base">{action.icon}</span>
                  <span className="text-sm text-[#5c4a42] group-hover:text-[#9b6f6f] transition-colors font-medium">
                    {action.label}
                  </span>
                  <svg className="w-3.5 h-3.5 text-[#c9a96e] ml-auto opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>

          {/* Upcoming next 5 */}
          {upcomingList.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#e8e2dc] p-5">
              <h3 className="text-sm font-semibold text-[#1a1714] mb-3">Coming Up</h3>
              <div className="space-y-3">
                {upcomingList.map((appt) => {
                  const svc = appt.service as { name: string; duration_minutes: number } | null;
                  const client = appt.client as { full_name: string | null } | null;
                  const d = new Date(appt.start_at);
                  return (
                    <div key={appt.id} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#f5ede8] flex-shrink-0 flex flex-col items-center justify-center">
                        <span className="text-[9px] font-bold text-[#c9a96e] uppercase leading-none">
                          {d.toLocaleDateString([], { weekday: "short", timeZone: "UTC" })}
                        </span>
                        <span className="text-sm font-bold text-[#9b6f6f] leading-none">
                          {d.toLocaleDateString([], { day: "numeric", timeZone: "UTC" })}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-[#1a1714] leading-tight truncate">
                          {client?.full_name ?? "Guest"}
                        </p>
                        <p className="text-[10px] text-[#8a7e78] truncate">{svc?.name}</p>
                        <p className="text-[10px] text-[#c9a96e]">{formatTime(appt.start_at)}</p>
                      </div>
                      <span className={`flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                        appt.status === "confirmed"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}>
                        {appt.status === "confirmed" ? "✓" : "?"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
