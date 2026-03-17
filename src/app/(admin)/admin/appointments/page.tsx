"use client";

import { useEffect, useState } from "react";
import type { AppointmentStatus } from "@/lib/supabase/types";

interface AppointmentRow {
  id: string;
  start_at: string;
  end_at: string;
  status: AppointmentStatus;
  created_at: string;
  client: { id: string; full_name: string | null } | null;
  service: { id: string; name: string; duration_minutes: number; internal_price_cents?: number } | null;
}

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

// Group appointments by date
function groupByDate(appointments: AppointmentRow[]): Record<string, AppointmentRow[]> {
  const groups: Record<string, AppointmentRow[]> = {};
  for (const appt of appointments) {
    const key = new Date(appt.start_at).toLocaleDateString([], {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
    if (!groups[key]) groups[key] = [];
    groups[key]!.push(appt);
  }
  return groups;
}

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; bg: string; text: string; dot: string }> = {
  pending: { label: "Pending", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-400" },
  confirmed: { label: "Confirmed", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-400" },
  cancelled: { label: "Cancelled", bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-300" },
};

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"upcoming" | "all" | "cancelled">("upcoming");
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    loadAppointments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function loadAppointments() {
    setLoading(true);
    let url = "/api/admin/appointments";
    if (filter === "cancelled") url += "?status=cancelled";
    else if (filter === "all") url += "?status=all";
    const res = await fetch(url);
    const data = await res.json();
    setAppointments(data.appointments ?? []);
    setLoading(false);
  }

  async function updateStatus(id: string, status: AppointmentStatus) {
    setUpdating(id);
    const res = await fetch(`/api/admin/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (res.ok) {
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: data.appointment.status } : a))
      );
    }
    setUpdating(null);
  }

  const pending = appointments.filter((a) => a.status === "pending");
  const grouped = groupByDate(appointments);

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl text-[#1a1714]">Appointments</h1>
        <p className="text-[#8a7e78] text-sm mt-1">
          Manage your client bookings — confirm or decline requests here.
        </p>
      </div>

      {/* Pending banner */}
      {filter === "upcoming" && pending.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 mb-6 flex items-start gap-3">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse mt-1 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800 mb-0.5">
              {pending.length} pending {pending.length === 1 ? "request" : "requests"}
            </p>
            <p className="text-xs text-amber-700">
              These clients are waiting for your confirmation.
            </p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 bg-[#f5f0eb] p-1 rounded-xl w-fit">
        {(["upcoming", "all", "cancelled"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-sm px-4 py-2 rounded-lg transition-colors font-medium ${
              filter === f
                ? "bg-white text-[#1a1714] shadow-sm"
                : "text-[#8a7e78] hover:text-[#5c4a42]"
            }`}
          >
            {f === "upcoming" ? "Upcoming" : f === "all" ? "All" : "Cancelled"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-[#9b6f6f] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : appointments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#e8e2dc] text-center py-16">
          <div className="w-12 h-12 rounded-full bg-[#f5ede8] flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#9b6f6f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="font-display text-lg text-[#1a1714] mb-1">No appointments</p>
          <p className="text-sm text-[#8a7e78]">
            {filter === "upcoming" ? "You're all caught up! 🎉" : "Nothing here yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([dateLabel, dayAppts]) => (
            <div key={dateLabel}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3">
                <p className="text-xs font-semibold text-[#8a7e78] uppercase tracking-widest">{dateLabel}</p>
                <div className="flex-1 h-px bg-[#e8e2dc]" />
                <span className="text-xs text-[#8a7e78]">
                  {dayAppts.length} appt{dayAppts.length > 1 ? "s" : ""}
                </span>
              </div>

              <div className="bg-white rounded-2xl border border-[#e8e2dc] overflow-hidden divide-y divide-[#f5f0eb]">
                {dayAppts.map((appt) => {
                  const status = STATUS_CONFIG[appt.status];
                  const isPending = appt.status === "pending";

                  return (
                    <div
                      key={appt.id}
                      className={`p-4 sm:p-5 ${isPending ? "bg-amber-50/30" : ""}`}
                    >
                      <div className="flex items-start gap-3 sm:gap-4">
                        {/* Time column */}
                        <div className="flex-shrink-0 text-center min-w-[56px]">
                          <p className="text-sm font-bold text-[#1a1714]">
                            {formatTime(appt.start_at)}
                          </p>
                          <p className="text-[10px] text-[#8a7e78] mt-0.5">
                            {appt.service ? formatDuration(appt.service.duration_minutes) : ""}
                          </p>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div>
                              <p className="font-semibold text-[#1a1714] text-sm">
                                {appt.client?.full_name ?? "Guest"}
                              </p>
                              <p className="text-xs text-[#8a7e78] mt-0.5">
                                {appt.service?.name ?? "Service"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {appt.service?.internal_price_cents && (
                                <span className="text-xs font-semibold text-[#4a7c59]">
                                  {centsToDisplay(appt.service.internal_price_cents)}
                                </span>
                              )}
                              <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${status.bg} ${status.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                                {status.label}
                              </span>
                            </div>
                          </div>

                          {/* Actions */}
                          {appt.status !== "cancelled" && (
                            <div className="flex items-center gap-2 mt-2.5">
                              {isPending && (
                                <button
                                  onClick={() => updateStatus(appt.id, "confirmed")}
                                  disabled={updating === appt.id}
                                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#9b6f6f] text-white text-xs font-semibold rounded-full hover:bg-[#8a5f5f] disabled:opacity-50 transition-colors"
                                >
                                  {updating === appt.id ? (
                                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                  Confirm
                                </button>
                              )}
                              <button
                                onClick={() => updateStatus(appt.id, "cancelled")}
                                disabled={updating === appt.id}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 border border-[#e8e2dc] text-[#8a7e78] text-xs font-semibold rounded-full hover:border-red-200 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                {appt.status === "confirmed" ? "Cancel" : "Decline"}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
