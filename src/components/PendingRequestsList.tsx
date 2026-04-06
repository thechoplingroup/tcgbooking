"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { STUDIO } from "@/config/studio";

interface ServiceInfo {
  id: string;
  name: string;
  duration_minutes: number;
}

interface PendingAppt {
  id: string;
  start_at: string;
  client: { id: string; full_name: string | null } | null;
  service: ServiceInfo | null;
  appointment_services?: Array<{ service_id: string; service: ServiceInfo | null }> | null;
  client_notes?: string | null;
}

function getAllServices(appt: PendingAppt): ServiceInfo[] {
  if (appt.appointment_services && appt.appointment_services.length > 0) {
    return appt.appointment_services.map((as) => as.service).filter((s): s is ServiceInfo => s !== null);
  }
  return appt.service ? [appt.service] : [];
}

function allServiceNames(appt: PendingAppt): string {
  const svcs = getAllServices(appt);
  return svcs.length > 0 ? svcs.map((s) => s.name).join(", ") : "Service";
}

function allServiceDuration(appt: PendingAppt): number {
  return getAllServices(appt).reduce((sum, s) => sum + s.duration_minutes, 0);
}

interface Props {
  initialAppts: PendingAppt[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: STUDIO.timezone,
  });
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

interface CardProps {
  appt: PendingAppt;
  onAction: (id: string, action: "confirmed" | "cancelled") => void;
  error?: string;
  confirmingDecline?: boolean;
  onRequestDecline: (id: string) => void;
  onCancelDecline: () => void;
}

function SwipeableCard({ appt, onAction, error, confirmingDecline, onRequestDecline, onCancelDecline }: CardProps) {
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [swipeIntent, setSwipeIntent] = useState<"approve" | "decline" | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const SWIPE_THRESHOLD = 80;

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]!.clientX;
    touchStartY.current = e.touches[0]!.clientY;
    setSwiping(false);
    setSwipeX(0);
  }

  function onTouchMove(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.touches[0]!.clientX - touchStartX.current;
    const dy = e.touches[0]!.clientY - touchStartY.current;

    // Only track horizontal swipes (ignore vertical scrolling)
    if (!swiping && Math.abs(dy) > Math.abs(dx)) return;

    setSwiping(true);
    const clamped = Math.max(-140, Math.min(140, dx));
    setSwipeX(clamped);
    setSwipeIntent(clamped > 30 ? "approve" : clamped < -30 ? "decline" : null);
  }

  function onTouchEnd() {
    if (swipeX > SWIPE_THRESHOLD) {
      onAction(appt.id, "confirmed");
    } else if (swipeX < -SWIPE_THRESHOLD) {
      onRequestDecline(appt.id);
    }
    setSwipeX(0);
    setSwiping(false);
    setSwipeIntent(null);
    touchStartX.current = null;
    touchStartY.current = null;
  }

  return (
    <div className="relative overflow-hidden">
      {/* Swipe hint backgrounds */}
      <div
        className={`absolute inset-0 flex items-center px-5 transition-opacity duration-150 ${swipeIntent === "approve" ? "opacity-100" : "opacity-0"}`}
        style={{ background: "#d1fae5" }}
      >
        <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
        <span className="ml-2 text-emerald-700 font-semibold text-sm">Approve</span>
      </div>
      <div
        className={`absolute inset-0 flex items-center justify-end px-5 transition-opacity duration-150 ${swipeIntent === "decline" ? "opacity-100" : "opacity-0"}`}
        style={{ background: "#fee2e2" }}
      >
        <span className="mr-2 text-red-600 font-semibold text-sm">Decline</span>
        <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>

      {/* Card */}
      <div
        ref={cardRef}
        className="relative bg-white px-4 py-4 touch-pan-y"
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: swiping ? "none" : "transform 0.25s ease-out",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Client name + service */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-[#1a1714] text-base leading-tight truncate">
              {appt.client?.full_name ?? "Guest"}
            </p>
            <p className="text-sm text-[#5c4a42] mt-0.5">{allServiceNames(appt)}</p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-sm font-semibold text-[#c9a96e]">{formatDate(appt.start_at)}</p>
            <p className="text-xs text-[#8a7e78] mt-0.5">
              {formatTime(appt.start_at)}
              {allServiceDuration(appt) > 0 ? ` · ${formatDuration(allServiceDuration(appt))}` : ""}
            </p>
          </div>
        </div>

        {/* Client notes */}
        {appt.client_notes && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mt-2 mb-3">
            <p className="text-xs font-semibold text-amber-700 mb-0.5">Client note</p>
            <p className="text-sm text-amber-800 italic leading-snug">&ldquo;{appt.client_notes}&rdquo;</p>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-600 mt-1 mb-2">{error} — please try again.</p>
        )}

        {/* Action buttons */}
        {!confirmingDecline ? (
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => onAction(appt.id, "confirmed")}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-emerald-600 text-white text-sm font-semibold rounded-xl active:bg-emerald-700 active:scale-[0.98] transition-all min-h-[48px]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Approve
            </button>
            <button
              onClick={() => onRequestDecline(appt.id)}
              className="flex items-center justify-center gap-1.5 px-5 py-3 bg-red-50 border-2 border-red-200 text-red-600 text-sm font-semibold rounded-xl active:bg-red-100 active:border-red-300 active:scale-[0.98] transition-all min-h-[48px]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Decline
            </button>
          </div>
        ) : (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-sm font-semibold text-red-700 mb-2">Decline this request?</p>
            <p className="text-xs text-red-600 mb-3">The client will receive an email and a link to rebook.</p>
            <div className="flex gap-2">
              <button
                onClick={() => onAction(appt.id, "cancelled")}
                className="flex-1 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-lg active:bg-red-700 transition-colors min-h-[44px]"
              >
                Yes, decline
              </button>
              <button
                onClick={onCancelDecline}
                className="flex-1 py-2.5 border border-[#e8e2dc] text-[#5c4a42] text-sm font-semibold rounded-lg hover:bg-white active:bg-white transition-colors min-h-[44px]"
              >
                Keep
              </button>
            </div>
          </div>
        )}

        {/* Swipe hint (first card only, subtle) */}
        <div className="flex items-center justify-center gap-3 mt-2 opacity-30 pointer-events-none select-none">
          <span className="text-[9px] text-[#8a7e78] flex items-center gap-1">
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            decline
          </span>
          <span className="w-px h-3 bg-[#e8e2dc]" />
          <span className="text-[9px] text-[#8a7e78] flex items-center gap-1">
            approve
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function PendingRequestsList({ initialAppts }: Props) {
  const [appts, setAppts] = useState<PendingAppt[]>(initialAppts);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmingDecline, setConfirmingDecline] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const act = useCallback(
    async (id: string, status: "confirmed" | "cancelled") => {
      // Optimistic remove
      setAppts((prev) => prev.filter((a) => a.id !== id));
      setConfirmingDecline(null);
      setErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });

      const label = status === "confirmed" ? "Approved ✓" : "Declined";
      toast(label, status === "confirmed" ? "success" : "info");

      try {
        const res = await fetch(`/api/admin/appointments/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) throw new Error("Failed");
        router.refresh();
      } catch {
        // Revert
        setAppts((prev) => {
          const original = initialAppts.find((a) => a.id === id);
          if (!original || prev.find((a) => a.id === id)) return prev;
          const idx = initialAppts.findIndex((a) => a.id === id);
          const next = [...prev];
          next.splice(idx, 0, original);
          return next;
        });
        setErrors((prev) => ({ ...prev, [id]: "Action failed" }));
        toast("Something went wrong — try again", "error");
        setTimeout(() => {
          setErrors((p) => { const n = { ...p }; delete n[id]; return n; });
        }, 5000);
      }
    },
    [initialAppts, router, toast]
  );

  if (appts.length === 0) {
    return (
      <div className="px-5 py-8 text-center">
        <p className="text-sm text-[#8a7e78]">No pending requests — you&apos;re all caught up ✨</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-[#fef3c7]">
      {appts.map((appt) => (
        <SwipeableCard
          key={appt.id}
          appt={appt}
          onAction={act}
          error={errors[appt.id]}
          confirmingDecline={confirmingDecline === appt.id}
          onRequestDecline={(id) => setConfirmingDecline(id)}
          onCancelDecline={() => setConfirmingDecline(null)}
        />
      ))}
    </div>
  );
}
