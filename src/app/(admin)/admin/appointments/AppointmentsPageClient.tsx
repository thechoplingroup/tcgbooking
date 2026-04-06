"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import ErrorBoundary from "@/components/ErrorBoundary";
import AdminCalendar from "@/components/AdminCalendar";
import { STUDIO } from "@/config/studio";
import {
  studioWallClockToUtcIso,
  formatStudioDateTimeLocal,
  studioDateTimeLocalToUtcIso,
} from "@/lib/time";

interface ServiceInfo {
  id: string;
  name: string;
  duration_minutes: number;
  internal_price_cents?: number;
}

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
  walk_in: { id: string; full_name: string | null } | null;
  service: ServiceInfo | null;
  appointment_services?: Array<{ service_id: string; service: ServiceInfo | null }> | null;
}

function clientName(appt: AppointmentRow): string {
  return appt.client?.full_name ?? appt.walk_in?.full_name ?? "Guest";
}

/** Get all services for an appointment: prefer appointment_services, fall back to service */
function getAllServices(appt: AppointmentRow): ServiceInfo[] {
  if (appt.appointment_services && appt.appointment_services.length > 0) {
    return appt.appointment_services.map((as) => as.service).filter((s): s is ServiceInfo => s !== null);
  }
  return appt.service ? [appt.service] : [];
}

function serviceNames(appt: AppointmentRow): string {
  const svcs = getAllServices(appt);
  return svcs.length > 0 ? svcs.map((s) => s.name).join(", ") : "Service";
}

function totalDuration(appt: AppointmentRow): number {
  const svcs = getAllServices(appt);
  return svcs.reduce((sum, s) => sum + s.duration_minutes, 0);
}

function totalPriceCents(appt: AppointmentRow): number {
  const svcs = getAllServices(appt);
  return svcs.reduce((sum, s) => sum + (s.internal_price_cents ?? 0), 0);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: STUDIO.timezone,
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

function groupByDate(appointments: AppointmentRow[]): Record<string, AppointmentRow[]> {
  const groups: Record<string, AppointmentRow[]> = {};
  for (const appt of appointments) {
    const key = new Date(appt.start_at).toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: STUDIO.timezone,
    });
    if (!groups[key]) groups[key] = [];
    groups[key]!.push(appt);
  }
  // Sort pending/reschedule_requested first within each date group
  const pendingStatuses = new Set(["pending", "reschedule_requested"]);
  for (const key of Object.keys(groups)) {
    groups[key]!.sort((a, b) => {
      const aP = pendingStatuses.has(a.status) ? 0 : 1;
      const bP = pendingStatuses.has(b.status) ? 0 : 1;
      if (aP !== bP) return aP - bP;
      return new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
    });
  }
  return groups;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending: { label: "Pending", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-400" },
  confirmed: { label: "Confirmed", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-400" },
  cancelled: { label: "Cancelled", bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-300" },
  no_show: { label: "No Show", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-400" },
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

interface EditState {
  id: string;
  start_at: string;
  end_at: string;
  service_id: string;
  client_notes: string;
}

interface AppointmentsPageClientProps {
  initialAppointments: AppointmentRow[];
}

export default function AppointmentsPageClient({
  initialAppointments,
}: AppointmentsPageClientProps) {
  const [appointments, setAppointments] = useState<AppointmentRow[]>(initialAppointments);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState<"upcoming" | "all" | "cancelled" | "no_show">("upcoming");
  const [showCreate, setShowCreate] = useState(searchParams.get("action") === "create");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editAppt, setEditAppt] = useState<EditState | null>(null);
  const [deleteAppt, setDeleteAppt] = useState<AppointmentRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [blockedTimes, setBlockedTimes] = useState<Array<{ id: string; start_at: string; end_at: string; reason?: string }>>([]);
  const { toast } = useToast();
  const router = useRouter();
  const [waitlistPrompt, setWaitlistPrompt] = useState<{ count: number; date: string } | null>(null);

  // Load services once on mount
  useEffect(() => {
    fetch("/api/admin/services").then(r => r.json()).then(d => setServices(d.services ?? []));
  }, []);

  // Load blocked times when calendar view is active
  useEffect(() => {
    if (viewMode !== "calendar") return;
    fetch("/api/admin/blocked-times")
      .then((r) => r.json())
      .then((d) => setBlockedTimes(d.blocked_times ?? []))
      .catch(() => {});
  }, [viewMode]);

  const loadAppointments = useCallback(async (filterValue: "upcoming" | "all" | "cancelled" | "no_show") => {
    setLoading(true);
    let url = "/api/admin/appointments";
    if (filterValue === "cancelled") url += "?status=cancelled";
    else if (filterValue === "all") url += "?status=all";
    else if (filterValue === "no_show") url += "?status=no_show";
    const res = await fetch(url);
    const data = await res.json();
    setAppointments(data.appointments ?? []);
    setLoading(false);
  }, []);

  // Load appointments when filter changes (skip initial 'upcoming' since we have server data)
  useEffect(() => {
    if (filter !== "upcoming") {
      loadAppointments(filter);
    }
  }, [filter, loadAppointments]);

  // When switching back to upcoming and we've changed filters before, refetch
  const handleFilterChange = useCallback((newFilter: "upcoming" | "all" | "cancelled" | "no_show") => {
    if (newFilter === filter) return;
    setFilter(newFilter);
    if (newFilter !== "upcoming") {
      // Will be handled by useEffect
    } else {
      // Refetch upcoming data
      loadAppointments("upcoming");
    }
  }, [filter, loadAppointments]);

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

      // Check for waitlist matches on cancellation
      if (status === "cancelled") {
        const json = await res.json();
        if (json.waitlist_count > 0) {
          const apptDate = prev?.start_at?.split("T")[0] ?? "";
          setWaitlistPrompt({ count: json.waitlist_count, date: apptDate });
        }
      }
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

  async function saveEdit() {
    if (!editAppt) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/appointments/${editAppt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_at: studioDateTimeLocalToUtcIso(editAppt.start_at),
          end_at: studioDateTimeLocalToUtcIso(editAppt.end_at),
          service_id: editAppt.service_id || undefined,
          client_notes: editAppt.client_notes,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const { appointment } = await res.json();
      setAppointments(list => list.map(a => a.id === editAppt.id ? { ...a, ...appointment } : a));
      setEditAppt(null);
      toast("Appointment updated", "success");
    } catch {
      toast("Failed to update — please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAppointment() {
    if (!deleteAppt) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/appointments/${deleteAppt.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setAppointments(list => list.filter(a => a.id !== deleteAppt.id));
      setDeleteAppt(null);
      if (expanded === deleteAppt.id) setExpanded(null);
      toast("Appointment deleted", "info");
    } catch {
      toast("Failed to delete — please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(appt: AppointmentRow) {
    const svc = getAllServices(appt)[0];
    // Render the stored UTC instant as a studio-local datetime-local value.
    setEditAppt({
      id: appt.id,
      start_at: formatStudioDateTimeLocal(appt.start_at),
      end_at: formatStudioDateTimeLocal(appt.end_at),
      service_id: svc?.id ?? "",
      client_notes: appt.client_notes ?? "",
    });
  }

  const pending = appointments.filter((a) => a.status === "pending" || a.status === "reschedule_requested");
  const grouped = groupByDate(appointments);

  return (
    <ErrorBoundary>
    <div className={viewMode === "calendar" ? "max-w-6xl" : "max-w-3xl"}>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-[#1a1714]">Appointments</h1>
          <p className="text-[#8a7e78] text-sm mt-1">Confirm or decline client requests.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#9b6f6f] text-white text-sm font-semibold rounded-full hover:bg-[#8a5f5f] active:scale-95 transition-all min-h-[44px] flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">Add Appointment</span>
        </button>
      </div>

      {/* View toggle + Filter tabs row */}
      <div className="flex items-center gap-3 mb-6">
        {/* Filter tabs */}
        <div className="flex gap-1 bg-[#f5f0eb] p-1 rounded-xl overflow-x-auto">
          {(["upcoming", "all", "cancelled", "no_show"] as const).map((f) => (
            <button
              key={f}
              onClick={() => handleFilterChange(f)}
              className={`text-sm px-3 sm:px-4 py-2 rounded-lg transition-colors font-medium min-h-[44px] whitespace-nowrap ${
                filter === f ? "bg-white text-[#1a1714] shadow-sm" : "text-[#8a7e78] hover:text-[#5c4a42]"
              }`}
            >
              {f === "upcoming" ? "Upcoming" : f === "all" ? "All" : f === "cancelled" ? "Cancelled" : "No Show"}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* List / Calendar toggle */}
        <div className="flex bg-[#f5f0eb] p-1 rounded-xl flex-shrink-0">
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === "list"
                ? "bg-white text-[#9b6f6f] shadow-sm"
                : "text-[#8a7e78] hover:text-[#5c4a42]"
            }`}
            aria-label="List view"
            title="List view"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode("calendar")}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === "calendar"
                ? "bg-white text-[#9b6f6f] shadow-sm"
                : "text-[#8a7e78] hover:text-[#5c4a42]"
            }`}
            aria-label="Calendar view"
            title="Calendar view"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
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

      {viewMode === "calendar" ? (
        <AdminCalendar
          appointments={appointments}
          blockedTimes={blockedTimes}
          onAppointmentClick={(id) => setExpanded(id)}
        />
      ) : loading ? (
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
          <p className="text-sm text-[#8a7e78]">{filter === "upcoming" ? "You're all caught up!" : "Nothing here yet."}</p>
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
                            <p className="text-[10px] text-[#8a7e78] mt-0.5">{totalDuration(appt) > 0 ? formatDuration(totalDuration(appt)) : ""}</p>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-[#1a1714] text-sm">{clientName(appt)}</p>
                                <p className="text-xs text-[#8a7e78] mt-0.5">{serviceNames(appt)}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {totalPriceCents(appt) > 0 && (
                                  <span className="text-xs font-semibold text-[#4a7c59]">
                                    {centsToDisplay(totalPriceCents(appt))}
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
                                { label: getAllServices(appt).length > 1 ? "Services" : "Service", value: serviceNames(appt) },
                                { label: "Duration", value: totalDuration(appt) > 0 ? formatDuration(totalDuration(appt)) : "—" },
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

                          <div className="flex flex-wrap items-center gap-2">
                              {appt.status !== "cancelled" && appt.status !== "no_show" && (
                                <>
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
                                  {appt.status === "confirmed" && new Date(appt.start_at) < new Date() && (
                                    <button
                                      onClick={() => updateStatus(appt.id, "no_show")}
                                      className="flex items-center gap-1.5 px-4 py-2.5 bg-red-500 text-white text-sm font-semibold rounded-full hover:bg-red-600 active:scale-95 transition-all min-h-[44px]"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                      </svg>
                                      No Show
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
                                </>
                              )}
                              {/* Edit + Delete always available */}
                              <button
                                onClick={() => openEdit(appt)}
                                className="flex items-center gap-1.5 px-4 py-2.5 border border-[#e8e2dc] text-[#8a7e78] text-sm font-semibold rounded-full hover:border-[#c9a96e] hover:text-[#c9a96e] hover:bg-[#fdf8f0] active:scale-95 transition-all min-h-[44px]"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit
                              </button>
                              <button
                                onClick={() => setDeleteAppt(appt)}
                                className="flex items-center gap-1.5 px-4 py-2.5 border border-[#e8e2dc] text-[#8a7e78] text-sm font-semibold rounded-full hover:border-red-200 hover:text-red-600 hover:bg-red-50 active:scale-95 transition-all min-h-[44px]"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete
                              </button>
                            </div>
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

      {/* Edit Modal */}
      {editAppt && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setEditAppt(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 pb-24 lg:pb-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="font-display text-xl text-[#1a1714]">Edit Appointment</h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#8a7e78] uppercase tracking-wide">Service</label>
                <select
                  value={editAppt.service_id}
                  onChange={e => setEditAppt(s => s ? { ...s, service_id: e.target.value } : s)}
                  className="mt-1 w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f]"
                  style={{ fontSize: 16 }}
                >
                  <option value="">— No service —</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-[#8a7e78] uppercase tracking-wide">Date</label>
                  <input
                    type="date"
                    value={editAppt.start_at.split("T")[0] ?? ""}
                    onChange={e => setEditAppt(s => s ? {
                      ...s,
                      start_at: e.target.value + "T" + (s.start_at.split("T")[1] ?? "09:00"),
                      end_at: e.target.value + "T" + (s.end_at.split("T")[1] ?? "10:00"),
                    } : s)}
                    className="mt-1 w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-white"
                    style={{ fontSize: 16 }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-[#8a7e78] uppercase tracking-wide">Start time</label>
                    <input
                      type="time"
                      value={editAppt.start_at.split("T")[1] ?? ""}
                      onChange={e => setEditAppt(s => s ? { ...s, start_at: (s.start_at.split("T")[0] ?? "") + "T" + e.target.value } : s)}
                      className="mt-1 w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-white"
                      style={{ fontSize: 16 }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#8a7e78] uppercase tracking-wide">End time</label>
                    <input
                      type="time"
                      value={editAppt.end_at.split("T")[1] ?? ""}
                      onChange={e => setEditAppt(s => s ? { ...s, end_at: (s.end_at.split("T")[0] ?? "") + "T" + e.target.value } : s)}
                      className="mt-1 w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-white"
                      style={{ fontSize: 16 }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[#8a7e78] uppercase tracking-wide">Client Notes</label>
                <textarea
                  value={editAppt.client_notes}
                  onChange={e => setEditAppt(s => s ? { ...s, client_notes: e.target.value } : s)}
                  rows={3}
                  placeholder="Any notes about this appointment…"
                  className="mt-1 w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] resize-none"
                  style={{ fontSize: 16 }}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setEditAppt(null)}
                className="flex-1 py-3 border border-[#e8e2dc] rounded-xl text-sm font-semibold text-[#8a7e78] hover:bg-[#f5f0eb] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 py-3 bg-[#9b6f6f] text-white rounded-xl text-sm font-semibold hover:bg-[#8a5f5f] disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteAppt && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setDeleteAppt(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 pb-24 lg:pb-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div className="text-center">
              <h2 className="font-display text-lg text-[#1a1714]">Delete Appointment?</h2>
              <p className="text-sm text-[#8a7e78] mt-1">
                {clientName(deleteAppt)} · {serviceNames(deleteAppt)}<br />
                {new Date(deleteAppt.start_at).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} at {formatTime(deleteAppt.start_at)}
              </p>
              <p className="text-xs text-red-600 mt-2">This cannot be undone.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteAppt(null)}
                className="flex-1 py-3 border border-[#e8e2dc] rounded-xl text-sm font-semibold text-[#8a7e78] hover:bg-[#f5f0eb] transition-colors"
              >
                Keep It
              </button>
              <button
                onClick={deleteAppointment}
                disabled={saving}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {saving ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Appointment Modal */}
      {showCreate && (
        <CreateAppointmentModal
          services={services}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            loadAppointments(filter);
            toast("Appointment created", "success");
          }}
        />
      )}

      {/* Waitlist notification prompt */}
      {waitlistPrompt && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30" onClick={() => setWaitlistPrompt(null)}>
          <div className="bg-white rounded-2xl border border-[#e8e2dc] shadow-xl p-5 pb-24 lg:pb-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-10 h-10 rounded-full bg-[#f5ede8] flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-[#9b6f6f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-display text-lg text-[#1a1714] font-semibold">Waitlist Match</h3>
              <p className="text-sm text-[#8a7e78] mt-1">
                {waitlistPrompt.count} client{waitlistPrompt.count !== 1 ? "s are" : " is"} on the waitlist
                {waitlistPrompt.date ? ` for ${new Date(waitlistPrompt.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}.
                Notify them about this opening?
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setWaitlistPrompt(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-[#8a7e78] bg-[#f5f0eb] rounded-xl hover:bg-[#ebe4dd] transition-colors"
              >
                Dismiss
              </button>
              <button
                onClick={() => {
                  setWaitlistPrompt(null);
                  router.push("/admin/waitlist");
                }}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-[#9b6f6f] rounded-xl hover:bg-[#8a5f5f] transition-colors"
              >
                View Waitlist
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
}

// ─── Create Appointment Modal ────────────────────────────────────────────────

interface ClientOption {
  id: string;
  full_name: string | null;
  type: "auth" | "walkin";
}

interface SelectedService {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number; // editable override
  isCustom?: boolean;
}

function CreateAppointmentModal({
  services,
  onClose,
  onCreated,
}: {
  services: ServiceInfo[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<ClientOption[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);

  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [showCustomService, setShowCustomService] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customDuration, setCustomDuration] = useState("60");
  const [customPrice, setCustomPrice] = useState("");

  const [date, setDate] = useState(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const [time, setTime] = useState("10:00");
  const [status, setStatus] = useState<"confirmed" | "pending" | "cancelled" | "no_show">("confirmed");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isPast = new Date(studioDateTimeLocalToUtcIso(`${date}T${time}`)) < new Date();

  // Search clients
  useEffect(() => {
    if (clientSearch.length < 2) { setClientResults([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/clients?q=${encodeURIComponent(clientSearch)}&limit=10`, { signal: controller.signal });
        const data = await res.json();
        setClientResults((data.clients ?? []).map((c: { id: string; full_name: string | null; clientType: string }) => ({
          id: c.id, full_name: c.full_name,
          type: c.clientType === "walkin" ? "walkin" as const : "auth" as const,
        })));
      } catch { /* aborted */ }
    }, 300);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [clientSearch]);

  async function createNewClient() {
    if (!newClientName.trim()) return;
    setCreatingClient(true);
    try {
      const res = await fetch("/api/admin/walk-in-clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: newClientName.trim(), phone: newClientPhone.trim() || null }),
      });
      const data = await res.json();
      if (res.ok && data.client) {
        setSelectedClient({ id: data.client.id, full_name: data.client.full_name, type: "walkin" });
        setShowNewClient(false);
        setNewClientName("");
        setNewClientPhone("");
        setClientSearch("");
      }
    } finally { setCreatingClient(false); }
  }

  // Toggle service selection with price override
  function toggleService(svc: ServiceInfo) {
    setSelectedServices((prev) => {
      const exists = prev.find((s) => s.id === svc.id);
      if (exists) return prev.filter((s) => s.id !== svc.id);
      return [...prev, { id: svc.id, name: svc.name, duration_minutes: svc.duration_minutes, price_cents: svc.internal_price_cents ?? 0 }];
    });
  }

  function updateServicePrice(id: string, cents: number) {
    setSelectedServices((prev) => prev.map((s) => s.id === id ? { ...s, price_cents: cents } : s));
  }

  function removeService(id: string) {
    setSelectedServices((prev) => prev.filter((s) => s.id !== id));
  }

  function addCustomService() {
    if (!customName.trim()) return;
    const id = `custom_${Date.now()}`;
    setSelectedServices((prev) => [...prev, {
      id, name: customName.trim(),
      duration_minutes: parseInt(customDuration) || 60,
      price_cents: Math.round(parseFloat(customPrice || "0") * 100),
      isCustom: true,
    }]);
    setCustomName("");
    setCustomDuration("60");
    setCustomPrice("");
    setShowCustomService(false);
  }

  const totalDur = selectedServices.reduce((sum, s) => sum + s.duration_minutes, 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price_cents, 0);

  function computeEndIso(): string {
    // Add the service duration to the studio-local start time, then convert
    // the resulting wall clock to a real UTC instant.
    const [h, m] = time.split(":").map(Number);
    const startMin = (h ?? 0) * 60 + (m ?? 0);
    const endMin = startMin + (totalDur || 60);
    const eh = Math.floor(endMin / 60) % 24;
    const em = endMin % 60;
    return studioWallClockToUtcIso(date, eh, em);
  }

  async function handleSubmit() {
    if (selectedServices.length === 0) { setError("Select at least one service"); return; }
    setSaving(true);
    setError("");

    const startIso = studioDateTimeLocalToUtcIso(`${date}T${time}`);
    const endIso = computeEndIso();

    // Only send real service IDs (not custom ones)
    const realServiceIds = selectedServices.filter((s) => !s.isCustom).map((s) => s.id);
    // If no real services, use the first service from the catalog as a placeholder
    const serviceIds = realServiceIds.length > 0 ? realServiceIds : [services[0]?.id].filter(Boolean);

    if (serviceIds.length === 0) { setError("No services available"); setSaving(false); return; }

    // Custom service names for notes
    const customNames = selectedServices.filter((s) => s.isCustom).map((s) => s.name);
    const allNotes = [notes.trim(), customNames.length > 0 ? `Custom: ${customNames.join(", ")}` : ""].filter(Boolean).join(" | ");

    try {
      const res = await fetch("/api/admin/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClient?.type === "auth" ? selectedClient.id : null,
          walk_in_client_id: selectedClient?.type === "walkin" ? selectedClient.id : null,
          service_ids: serviceIds,
          start_at: startIso,
          end_at: endIso,
          status,
          client_notes: allNotes || undefined,
          final_price_cents: totalPrice,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create appointment");
        setSaving(false);
        return;
      }
      onCreated();
    } catch {
      setError("Something went wrong");
      setSaving(false);
    }
  }

  const statusOptions = isPast
    ? [{ value: "confirmed", label: "Confirmed" }, { value: "no_show", label: "No Show" }, { value: "cancelled", label: "Cancelled" }]
    : [{ value: "confirmed", label: "Confirmed" }, { value: "pending", label: "Pending" }];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90dvh] overflow-y-auto p-6 pb-24 lg:pb-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl text-[#1a1714]">Add Appointment</h2>

        {/* Client */}
        <div>
          <label className="text-xs font-medium text-[#8a7e78] uppercase tracking-wide">Client</label>
          {selectedClient ? (
            <div className="mt-1 flex items-center gap-2 border border-[#e8e2dc] rounded-xl px-3 py-2.5">
              <span className="text-sm text-[#1a1714] flex-1">{selectedClient.full_name || "Guest"}</span>
              <span className="text-[10px] text-[#8a7e78] px-1.5 py-0.5 rounded bg-[#f5f0eb]">
                {selectedClient.type === "walkin" ? "Walk-in" : "Client"}
              </span>
              <button onClick={() => { setSelectedClient(null); setClientSearch(""); }} className="text-[#8a7e78] hover:text-red-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ) : showNewClient ? (
            <div className="mt-1 space-y-2 border border-[#e8e2dc] rounded-xl p-3 bg-[#faf9f7]">
              <input type="text" value={newClientName} onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Client name" className="w-full border border-[#e8e2dc] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f]" style={{ fontSize: 16 }} />
              <input type="tel" value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)}
                placeholder="Phone (optional)" className="w-full border border-[#e8e2dc] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f]" style={{ fontSize: 16 }} />
              <div className="flex gap-2">
                <button onClick={() => setShowNewClient(false)} className="flex-1 py-2 border border-[#e8e2dc] rounded-lg text-xs font-semibold text-[#8a7e78]">Cancel</button>
                <button onClick={createNewClient} disabled={creatingClient || !newClientName.trim()}
                  className="flex-1 py-2 bg-[#9b6f6f] text-white rounded-lg text-xs font-semibold disabled:opacity-50">
                  {creatingClient ? "Adding…" : "Add Client"}
                </button>
              </div>
            </div>
          ) : (
            <div className="relative mt-1">
              <input type="text" value={clientSearch} onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f]" style={{ fontSize: 16 }} />
              {(clientResults.length > 0 || clientSearch.length >= 2) && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e8e2dc] rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                  {clientResults.map((c) => (
                    <button key={`${c.type}-${c.id}`}
                      onClick={() => { setSelectedClient(c); setClientSearch(""); setClientResults([]); }}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-[#f5f0eb] flex items-center justify-between">
                      <span>{c.full_name || "Guest"}</span>
                      <span className="text-[10px] text-[#8a7e78]">{c.type === "walkin" ? "Walk-in" : "Client"}</span>
                    </button>
                  ))}
                  <button onClick={() => { setShowNewClient(true); setNewClientName(clientSearch); setClientResults([]); }}
                    className="w-full text-left px-3 py-2.5 text-sm text-[#9b6f6f] font-semibold hover:bg-[#f5f0eb] border-t border-[#f5f0eb] flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    New client &ldquo;{clientSearch}&rdquo;
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Services */}
        <div>
          <label className="text-xs font-medium text-[#8a7e78] uppercase tracking-wide">Services</label>
          {/* Service list to pick from */}
          <div className="mt-1 space-y-1 max-h-32 overflow-y-auto border border-[#e8e2dc] rounded-xl p-2">
            {services.filter((s) => s.duration_minutes > 0).map((s) => {
              const isSelected = selectedServices.some((ss) => ss.id === s.id);
              return (
                <button key={s.id} onClick={() => toggleService(s)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${
                    isSelected ? "bg-[#9b6f6f]/10 text-[#9b6f6f] font-semibold" : "hover:bg-[#f5f0eb] text-[#1a1714]"
                  }`}>
                  <span>{s.name}</span>
                  <span className="text-xs text-[#8a7e78]">{s.duration_minutes}m · ${((s.internal_price_cents ?? 0) / 100).toFixed(0)}</span>
                </button>
              );
            })}
          </div>

          {/* Selected services with editable prices */}
          {selectedServices.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {selectedServices.map((s) => (
                <div key={s.id} className="flex items-center gap-2 bg-[#f5f0eb] rounded-lg px-3 py-1.5">
                  <span className="text-xs text-[#1a1714] flex-1 truncate">{s.name}</span>
                  <span className="text-[10px] text-[#8a7e78]">{s.duration_minutes}m</span>
                  <div className="relative w-20">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-[#8a7e78]">$</span>
                    <input type="number" value={(s.price_cents / 100).toFixed(0)}
                      onChange={(e) => updateServicePrice(s.id, Math.round(parseFloat(e.target.value || "0") * 100))}
                      className="w-full pl-5 pr-1 py-1 text-xs text-right border border-[#e8e2dc] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#9b6f6f] bg-white"
                      style={{ fontSize: 14 }} />
                  </div>
                  <button onClick={() => removeService(s.id)} className="text-[#8a7e78] hover:text-red-500 p-0.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add custom service */}
          {showCustomService ? (
            <div className="mt-2 border border-[#e8e2dc] rounded-xl p-3 bg-[#faf9f7] space-y-2">
              <input type="text" value={customName} onChange={(e) => setCustomName(e.target.value)}
                placeholder="Service name" className="w-full border border-[#e8e2dc] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f]" style={{ fontSize: 16 }} />
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <input type="number" value={customDuration} onChange={(e) => setCustomDuration(e.target.value)}
                    className="w-full border border-[#e8e2dc] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f]" style={{ fontSize: 16 }} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8a7e78]">min</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8a7e78]">$</span>
                  <input type="number" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)}
                    placeholder="0" step="0.01"
                    className="w-full border border-[#e8e2dc] rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f]" style={{ fontSize: 16 }} />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowCustomService(false)} className="flex-1 py-2 border border-[#e8e2dc] rounded-lg text-xs font-semibold text-[#8a7e78]">Cancel</button>
                <button onClick={addCustomService} disabled={!customName.trim()}
                  className="flex-1 py-2 bg-[#c9a96e] text-white rounded-lg text-xs font-semibold disabled:opacity-50">Add</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowCustomService(true)}
              className="mt-2 text-xs text-[#9b6f6f] font-semibold hover:underline flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add custom service
            </button>
          )}

          {selectedServices.length > 0 && (
            <p className="text-xs text-[#8a7e78] mt-1">
              Total: {totalDur}m · ${(totalPrice / 100).toFixed(0)}
            </p>
          )}
        </div>

        {/* Date + Time */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-[#8a7e78] uppercase tracking-wide">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f]" style={{ fontSize: 16 }} />
          </div>
          <div>
            <label className="text-xs font-medium text-[#8a7e78] uppercase tracking-wide">Start Time</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
              className="mt-1 w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f]" style={{ fontSize: 16 }} />
          </div>
        </div>
        {isPast && <p className="text-xs text-amber-600 -mt-2">This date is in the past — creating for record-keeping</p>}

        {/* Status */}
        <div>
          <label className="text-xs font-medium text-[#8a7e78] uppercase tracking-wide">Status</label>
          <div className="flex gap-2 mt-1">
            {statusOptions.map((opt) => (
              <button key={opt.value} onClick={() => setStatus(opt.value as typeof status)}
                className={`flex-1 text-sm py-2 rounded-xl font-medium transition-colors ${
                  status === opt.value
                    ? opt.value === "no_show" ? "bg-red-500 text-white" : opt.value === "cancelled" ? "bg-gray-500 text-white" : "bg-[#9b6f6f] text-white"
                    : "border border-[#e8e2dc] text-[#8a7e78] hover:bg-[#f5f0eb]"
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-medium text-[#8a7e78] uppercase tracking-wide">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional notes…"
            className="mt-1 w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] resize-none" style={{ fontSize: 16 }} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-3 border border-[#e8e2dc] rounded-xl text-sm font-semibold text-[#8a7e78] hover:bg-[#f5f0eb] transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={saving || selectedServices.length === 0}
            className="flex-1 py-3 bg-[#9b6f6f] text-white rounded-xl text-sm font-semibold hover:bg-[#8a5f5f] disabled:opacity-50 transition-colors">
            {saving ? "Creating…" : "Add Appointment"}
          </button>
        </div>
      </div>
    </div>
  );
}
