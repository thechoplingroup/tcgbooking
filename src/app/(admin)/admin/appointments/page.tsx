"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";

interface AppointmentRow {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  created_at: string;
  client_notes?: string | null;
  reschedule_preferred_time?: string | null;
  reschedule_note?: string | null;
  client: { id: string; full_name: string | null } | null;
  service: { id: string; name: string; duration_minutes: number; internal_price_cents?: number } | null;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
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

function groupByDate(appointments: AppointmentRow[]): Record<string, AppointmentRow[]> {
  const groups: Record<string, AppointmentRow[]> = {};
  for (const appt of appointments) {
    const key = new Date(appt.start_at).toLocaleDateString([], {
      weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
    });
    if (!groups[key]) groups[key] = [];
    groups[key]!.push(appt);
  }
  return groups;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending: { label: "Pending", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-400" },
  confirmed: { label: "Confirmed", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-400" },
  cancelled: { label: "Cancelled", bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-300" },
  reschedule_requested: { label: "Reschedule Req.", bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-400" },
};

function Skeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-2xl border border-[#e8e2dc] p-5 animate-pulse">
          <div className="flex gap-4">
            <div className="w-14 text-center">
              <div className="h-5 bg-[#f0ebe6] rounded w-10 mx-auto mb-1" />
              <div className="h-3 bg-[#f0ebe6] rounded w-8 mx-auto" />
            </div>
            <div className="flex-1">
              <div className="h-4 bg-[#f0ebe6] rounded w-32 mb-2" />
              <div className="h-3 bg-[#f0ebe6] rounded w-24 mb-3" />
              <div className="flex gap-2">
                <div className="h-8 bg-[#f0ebe6] rounded-full w-20" />
                <div className="h-8 bg-[#f0ebe6] rounded-full w-20" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"upcoming" | "all" | "cancelled">("upcoming");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const { toast } = useToast();

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

  async function updateStatus(id: string, status: string) {
    const prev = appointments.find((a) => a.id === id);

    // Optimistic update
    if (status === "cancelled" && filter === "upcoming") {
      setAppointments((list) => list.filter((a) => a.id !== id));
    } else {
      setAppointments((list) => list.map((a) => (a.id === id ? { ...a, status } : a)));
    }
    if (expanded === id && status === "cancelled") setExpanded(null);

    const label = status === "confirmed" ? "Confirmed ✓" : "Declined";
    toast(label, status === "confirmed" ? "success" : "info");

    try {
      const res = await fetch(`/api/admin/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      // Revert
      if (prev) {
        setAppointments((list) => {
          if (list.find((a) => a.id === id)) return list.map((a) => (a.id === id ? prev : a));
          const origIdx = appointments.findIndex((a) => a.id === id);
          const next = [...list];
          next.splice(Math.max(0, origIdx), 0, prev);
          return next;
        });
      }
      toast("Action failed — please try again.", "error");
      setErrors((e) => ({ ...e, [id]: "Failed" }));
      setTimeout(() => setErrors((e) => { const n = { ...e }; delete n[id]; return n; }), 4000);
    }
  }

  const pending = appointments.filter((a) => a.status === "pending" || a.status === "reschedule_requested");
  const grouped = groupByDate(appointments);

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-[#1a1714]">Appointments</h1>
        <p className="text-[#8a7e78] text-sm mt-1">Confirm or decline client requests.</p>
      </div>

      {/* Pending banner */}
      {filter === "upcoming" && pending.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 mb-6 flex items-start gap-3">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse mt-1 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800 mb-0.5">
              {pending.length} pending {pending.length === 1 ? "request" : "requests"}
            </p>
            <p className="text-xs text-amber-700">These clients are waiting for your confirmation.</p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 bg-[#f5f0eb] p-1 rounded-xl w-fit">
        {(["upcoming", "all", "cancelled"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-sm px-4 py-2 rounded-lg transition-colors font-medium min-h-[44px] ${
              filter === f ? "bg-white text-[#1a1714] shadow-sm" : "text-[#8a7e78] hover:text-[#5c4a42]"
            }`}
          >
            {f === "upcoming" ? "Upcoming" : f === "all" ? "All" : "Cancelled"}
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton />
      ) : appointments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#e8e2dc] text-center py-16">
          <div className="w-12 h-12 rounded-full bg-[#f5ede8] flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#9b6f6f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="font-display text-lg text-[#1a1714] mb-1">No appointments</p>
          <p className="text-sm text-[#8a7e78]">{filter === "upcoming" ? "You're all caught up! 🎉" : "Nothing here yet."}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([dateLabel, dayAppts]) => (
            <div key={dateLabel}>
              <div className="flex items-center gap-3 mb-3">
                <p className="text-xs font-semibold text-[#8a7e78] uppercase tracking-widest">{dateLabel}</p>
                <div className="flex-1 h-px bg-[#e8e2dc]" />
                <span className="text-xs text-[#8a7e78]">{dayAppts.length} appt{dayAppts.length > 1 ? "s" : ""}</span>
              </div>

              <div className="bg-white rounded-2xl border border-[#e8e2dc] overflow-hidden divide-y divide-[#f5f0eb]">
                {dayAppts.map((appt) => {
                  const status = STATUS_CONFIG[appt.status];
                  const isPending = appt.status === "pending" || appt.status === "reschedule_requested";
                  const isExpanded = expanded === appt.id;

                  return (
                    <div key={appt.id} className={`${isPending ? "bg-amber-50/30" : ""}`}>
                      {/* Tap-to-expand row */}
                      <button
                        onClick={() => setExpanded(isExpanded ? null : appt.id)}
                        className="w-full text-left p-4 sm:p-5 min-h-[72px]"
                      >
                        <div className="flex items-start gap-3 sm:gap-4">
                          <div className="flex-shrink-0 text-center min-w-[56px]">
                            <p className="text-sm font-bold text-[#1a1714]">{formatTime(appt.start_at)}</p>
                            <p className="text-[10px] text-[#8a7e78] mt-0.5">{appt.service ? formatDuration(appt.service.duration_minutes) : ""}</p>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-[#1a1714] text-sm">{appt.client?.full_name ?? "Guest"}</p>
                                <p className="text-xs text-[#8a7e78] mt-0.5">{appt.service?.name ?? "Service"}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {appt.service?.internal_price_cents != null && appt.service.internal_price_cents > 0 && (
                                  <span className="text-xs font-semibold text-[#4a7c59]">
                                    {centsToDisplay(appt.service.internal_price_cents)}
                                  </span>
                                )}
                                <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${status.bg} ${status.text}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${status.dot} ${isPending ? "animate-pulse" : ""}`} />
                                  {status.label}
                                </span>
                                <svg
                                  className={`w-4 h-4 text-[#8a7e78] transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-[#f5f0eb] bg-[#faf9f7]">
                          <div className="pt-4 space-y-2 mb-4">
                            {appt.status === "reschedule_requested" && appt.reschedule_preferred_time && (
                              <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3">
                                <p className="text-xs font-semibold text-purple-700 mb-1">Reschedule Request</p>
                                <p className="text-sm text-purple-800">
                                  Wants to move to: <strong>{appt.reschedule_preferred_time}</strong>
                                  {appt.reschedule_note && <span className="block mt-1 italic">{appt.reschedule_note}</span>}
                                </p>
                              </div>
                            )}
                            {appt.client_notes && (
                              <div className="bg-[#fffbeb] border border-[#fcd34d] rounded-xl px-4 py-3">
                                <p className="text-xs font-semibold text-amber-700 mb-1">Client Note</p>
                                <p className="text-sm text-amber-800 italic">&ldquo;{appt.client_notes}&rdquo;</p>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                              {[
                                { label: "Service", value: appt.service?.name ?? "—" },
                                { label: "Duration", value: appt.service ? formatDuration(appt.service.duration_minutes) : "—" },
                                { label: "Time", value: formatTime(appt.start_at) },
                                { label: "Status", value: status.label },
                              ].map((row) => (
                                <div key={row.label}>
                                  <p className="text-[10px] text-[#8a7e78] uppercase tracking-wide">{row.label}</p>
                                  <p className="text-sm font-medium text-[#1a1714]">{row.value}</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          {errors[appt.id] && (
                            <p className="text-xs text-red-600 mb-3">{errors[appt.id]}</p>
                          )}

                          {appt.status !== "cancelled" && (
                            <div className="flex items-center gap-2">
                              {appt.status === "pending" && (
                                <button
                                  onClick={() => updateStatus(appt.id, "confirmed")}
                                  className="flex items-center gap-1.5 px-4 py-2.5 bg-[#9b6f6f] text-white text-sm font-semibold rounded-full hover:bg-[#8a5f5f] active:scale-95 transition-all min-h-[44px]"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Confirm
                                </button>
                              )}
                              {appt.status === "reschedule_requested" && (
                                <button
                                  onClick={() => updateStatus(appt.id, "confirmed")}
                                  className="flex items-center gap-1.5 px-4 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-full hover:bg-purple-700 active:scale-95 transition-all min-h-[44px]"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  Mark Rescheduled
                                </button>
                              )}
                              <button
                                onClick={() => updateStatus(appt.id, "cancelled")}
                                className="flex items-center gap-1.5 px-4 py-2.5 border border-[#e8e2dc] text-[#8a7e78] text-sm font-semibold rounded-full hover:border-red-200 hover:text-red-600 hover:bg-red-50 active:scale-95 transition-all min-h-[44px]"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                {appt.status === "confirmed" ? "Cancel" : "Decline"}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
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
