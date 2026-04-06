"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/components/Toast";
import { STUDIO } from "@/config/studio";

interface ServiceInfo {
  id: string;
  name: string;
  duration_minutes: number;
  internal_price_cents?: number;
}

interface RequestRow {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  created_at: string;
  client_notes?: string | null;
  reschedule_preferred_time?: string | null;
  reschedule_note?: string | null;
  client: { id: string; full_name: string | null } | null;
  service: ServiceInfo | null;
  appointment_services?: Array<{ service_id: string; service: ServiceInfo | null }> | null;
}

function getAllServices(appt: RequestRow): ServiceInfo[] {
  if (appt.appointment_services && appt.appointment_services.length > 0) {
    return appt.appointment_services.map((as) => as.service).filter((s): s is ServiceInfo => s !== null);
  }
  return appt.service ? [appt.service] : [];
}

function serviceNames(appt: RequestRow): string {
  const svcs = getAllServices(appt);
  return svcs.length > 0 ? svcs.map((s) => s.name).join(", ") : "Service";
}

function totalDuration(appt: RequestRow): number {
  return getAllServices(appt).reduce((sum, s) => sum + s.duration_minutes, 0);
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: STUDIO.timezone,
  });
}

interface RequestsPageClientProps {
  initialRequests: RequestRow[];
}

export default function RequestsPageClient({ initialRequests }: RequestsPageClientProps) {
  const [requests, setRequests] = useState<RequestRow[]>(initialRequests);
  const [filter, setFilter] = useState<"all" | "pending" | "reschedule">("all");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadRequests = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/appointments?status=requests");
    const data = await res.json();
    setRequests(data.appointments ?? []);
    setLoading(false);
  }, []);

  // Refresh periodically
  useEffect(() => {
    const interval = setInterval(loadRequests, 30000);
    return () => clearInterval(interval);
  }, [loadRequests]);

  async function updateStatus(id: string, status: string) {
    const prev = requests.find((a) => a.id === id);

    // Optimistic removal
    setRequests((list) => list.filter((a) => a.id !== id));
    toast(status === "confirmed" ? "Approved" : "Declined", status === "confirmed" ? "success" : "info");

    try {
      const res = await fetch(`/api/admin/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      if (prev) setRequests((list) => [...list, prev].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()));
      toast("Action failed — please try again.", "error");
    }
  }

  const filtered = requests.filter((r) => {
    if (filter === "pending") return r.status === "pending";
    if (filter === "reschedule") return r.status === "reschedule_requested";
    return true;
  });

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const rescheduleCount = requests.filter((r) => r.status === "reschedule_requested").length;

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-[#1a1714]">Requests</h1>
        <p className="text-[#8a7e78] text-sm mt-1">Pending bookings and reschedule requests.</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 bg-[#f5f0eb] p-1 rounded-xl w-fit">
        {([
          { key: "all" as const, label: "All", count: requests.length },
          { key: "pending" as const, label: "Pending", count: pendingCount },
          { key: "reschedule" as const, label: "Reschedule", count: rescheduleCount },
        ]).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-sm px-3 sm:px-4 py-2 rounded-lg transition-colors font-medium min-h-[44px] whitespace-nowrap flex items-center gap-1.5 ${
              filter === f.key ? "bg-white text-[#1a1714] shadow-sm" : "text-[#8a7e78] hover:text-[#5c4a42]"
            }`}
          >
            {f.label}
            {f.count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                filter === f.key ? "bg-amber-100 text-amber-700" : "bg-[#e8e2dc] text-[#8a7e78]"
              }`}>
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && requests.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#e8e2dc] p-5 animate-pulse">
              <div className="h-4 bg-[#f0ebe6] rounded w-32 mb-2" />
              <div className="h-3 bg-[#f0ebe6] rounded w-48" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#e8e2dc] text-center py-16">
          <div className="w-12 h-12 rounded-full bg-[#f5ede8] flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#9b6f6f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="font-display text-lg text-[#1a1714] mb-1">No pending requests</p>
          <p className="text-sm text-[#8a7e78]">You&apos;re all caught up!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => {
            const isReschedule = req.status === "reschedule_requested";

            return (
              <div
                key={req.id}
                className={`bg-white rounded-2xl border overflow-hidden ${
                  isReschedule ? "border-purple-200" : "border-amber-200"
                }`}
              >
                <div className="p-4 sm:p-5">
                  {/* Status tag */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      isReschedule ? "bg-purple-50 text-purple-700" : "bg-amber-50 text-amber-700"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                        isReschedule ? "bg-purple-400" : "bg-amber-400"
                      }`} />
                      {isReschedule ? "Reschedule Request" : "New Booking"}
                    </span>
                    <span className="text-[10px] text-[#8a7e78]">
                      {new Date(req.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                    </span>
                  </div>

                  {/* Client + Service */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-shrink-0 text-center min-w-[56px]">
                      <p className="text-sm font-bold text-[#1a1714]">{formatTime(req.start_at)}</p>
                      <p className="text-[10px] text-[#8a7e78] mt-0.5">
                        {totalDuration(req) > 0 ? formatDuration(totalDuration(req)) : ""}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#1a1714] text-sm">{req.client?.full_name ?? "Guest"}</p>
                      <p className="text-xs text-[#8a7e78] mt-0.5">{serviceNames(req)}</p>
                      <p className="text-xs text-[#8a7e78]">{formatDate(req.start_at)}</p>
                    </div>
                  </div>

                  {/* Client notes */}
                  {req.client_notes && (
                    <div className="bg-[#fffbeb] border border-[#fcd34d] rounded-xl px-3 py-2.5 mb-3">
                      <p className="text-xs text-amber-800 italic">&ldquo;{req.client_notes}&rdquo;</p>
                    </div>
                  )}

                  {/* Reschedule details */}
                  {isReschedule && req.reschedule_preferred_time && (
                    <div className="bg-purple-50 border border-purple-200 rounded-xl px-3 py-2.5 mb-3">
                      <p className="text-xs font-semibold text-purple-700 mb-0.5">Wants to move to:</p>
                      <p className="text-sm text-purple-800 font-medium">{req.reschedule_preferred_time}</p>
                      {req.reschedule_note && (
                        <p className="text-xs text-purple-700 mt-1 italic">{req.reschedule_note}</p>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateStatus(req.id, "confirmed")}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#9b6f6f] text-white text-sm font-semibold rounded-full hover:bg-[#8a5f5f] active:scale-95 transition-all min-h-[44px]"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {isReschedule ? "Approve" : "Confirm"}
                    </button>
                    <button
                      onClick={() => updateStatus(req.id, "cancelled")}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-[#e8e2dc] text-[#8a7e78] text-sm font-semibold rounded-full hover:border-red-200 hover:text-red-600 hover:bg-red-50 active:scale-95 transition-all min-h-[44px]"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Decline
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
