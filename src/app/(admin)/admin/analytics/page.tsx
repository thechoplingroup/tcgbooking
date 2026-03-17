"use client";

import { useEffect, useState } from "react";

interface AnalyticsData {
  totalThisMonth: number;
  revenueCents: number;
  newClients: number;
  completionRate: number;
  dayOfWeekCounts: number[];
  topServices: { name: string; count: number }[];
  monthlyTrend: { month: string; count: number }[];
  recentAppointments: {
    id: string;
    start_at: string;
    status: string;
    client?: { id: string; full_name: string | null } | null;
    service?: { id: string; name: string } | null;
  }[];
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function HorizontalBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 mb-2">
      <span className="text-xs text-[#5c4a42] w-12 text-right flex-shrink-0">{label}</span>
      <div className="flex-1 h-7 bg-[#f5f0eb] rounded-lg overflow-hidden relative">
        <div
          className="h-full bg-[#9b6f6f] rounded-lg transition-all duration-500"
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-[#5c4a42]">
          {value}
        </span>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((res) => res.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("Failed to load analytics"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-[#9b6f6f] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-16">
        <p className="text-red-600 text-sm">{error ?? "Something went wrong"}</p>
      </div>
    );
  }

  const maxDow = Math.max(...data.dayOfWeekCounts, 1);
  const maxService = Math.max(...data.topServices.map((s) => s.count), 1);
  const maxMonthly = Math.max(...data.monthlyTrend.map((m) => m.count), 1);

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-[#1a1714]">Analytics</h1>
        <p className="text-[#8a7e78] text-sm mt-1">This month&apos;s overview and trends.</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-[#e8e2dc] p-4">
          <p className="text-xs text-[#8a7e78] font-medium uppercase tracking-wide">Appointments</p>
          <p className="font-display text-2xl text-[#1a1714] mt-1">{data.totalThisMonth}</p>
          <p className="text-[10px] text-[#8a7e78] mt-0.5">this month</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8e2dc] p-4">
          <p className="text-xs text-[#8a7e78] font-medium uppercase tracking-wide">Revenue</p>
          <p className="font-display text-2xl text-[#1a1714] mt-1">{formatCents(data.revenueCents)}</p>
          <p className="text-[10px] text-[#8a7e78] mt-0.5">confirmed this month</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8e2dc] p-4">
          <p className="text-xs text-[#8a7e78] font-medium uppercase tracking-wide">New Clients</p>
          <p className="font-display text-2xl text-[#1a1714] mt-1">{data.newClients}</p>
          <p className="text-[10px] text-[#8a7e78] mt-0.5">first visit this month</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8e2dc] p-4">
          <p className="text-xs text-[#8a7e78] font-medium uppercase tracking-wide">Completion Rate</p>
          <p className="font-display text-2xl text-[#1a1714] mt-1">{data.completionRate}%</p>
          <p className="text-[10px] text-[#8a7e78] mt-0.5">confirmed / non-cancelled</p>
        </div>
      </div>

      {/* Busiest days */}
      <div className="bg-white rounded-2xl border border-[#e8e2dc] p-5 mb-4">
        <h2 className="font-display text-lg text-[#1a1714] mb-4">Busiest Days</h2>
        {DAY_LABELS.map((label, i) => (
          <HorizontalBar key={label} label={label} value={data.dayOfWeekCounts[i]} max={maxDow} />
        ))}
      </div>

      {/* Top services */}
      {data.topServices.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#e8e2dc] p-5 mb-4">
          <h2 className="font-display text-lg text-[#1a1714] mb-4">Top Services</h2>
          {data.topServices.map((s) => (
            <HorizontalBar key={s.name} label={s.name} value={s.count} max={maxService} />
          ))}
        </div>
      )}

      {/* Monthly trend */}
      <div className="bg-white rounded-2xl border border-[#e8e2dc] p-5 mb-4">
        <h2 className="font-display text-lg text-[#1a1714] mb-4">Monthly Trend</h2>
        <div className="flex items-end gap-2 h-32">
          {data.monthlyTrend.map((m) => {
            const pct = maxMonthly > 0 ? (m.count / maxMonthly) * 100 : 0;
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-medium text-[#5c4a42]">{m.count}</span>
                <div className="w-full bg-[#f5f0eb] rounded-t-lg relative" style={{ height: "100px" }}>
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-[#9b6f6f] rounded-t-lg transition-all duration-500"
                    style={{ height: `${Math.max(pct, 3)}%` }}
                  />
                </div>
                <span className="text-[10px] text-[#8a7e78]">{m.month}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-2xl border border-[#e8e2dc] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#f5f0eb]">
          <h2 className="font-display text-lg text-[#1a1714]">Recent Activity</h2>
        </div>
        {data.recentAppointments.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-[#8a7e78]">
            No appointments yet.
          </div>
        ) : (
          <div className="divide-y divide-[#f5f0eb]">
            {data.recentAppointments.map((appt) => (
              <div key={appt.id} className="px-5 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#1a1714] truncate">
                    {appt.client?.full_name ?? "Walk-in"}
                  </p>
                  <p className="text-xs text-[#8a7e78] mt-0.5">
                    {appt.service?.name ?? "—"} · {new Date(appt.start_at).toLocaleDateString([], {
                      month: "short", day: "numeric",
                    })}
                  </p>
                </div>
                <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full border ${STATUS_STYLES[appt.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                  {appt.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
