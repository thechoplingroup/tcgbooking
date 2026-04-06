"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/components/Toast";
import type { BlockedTime } from "@/lib/supabase/types";
import { STUDIO } from "@/config/studio";
import {
  studioWallClockToUtcIso,
  studioDateString,
  studioDateTimeLocalToUtcIso,
} from "@/lib/time";

function formatRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  // Stored as real UTC; render in the studio timezone.
  const startDay = studioDateString(start);
  const endDay = studioDateString(end);
  const sameDay = startDay === endDay;
  const thisYear = new Date().getFullYear();
  const startYear = parseInt(startDay.slice(0, 4), 10);
  const dateStr = start.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: startYear !== thisYear ? "numeric" : undefined,
    timeZone: STUDIO.timezone,
  });
  const startTime = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: STUDIO.timezone,
  });
  const endTime = end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: STUDIO.timezone,
  });
  if (sameDay) return `${dateStr} · ${startTime} – ${endTime}`;
  const endDateStr = end.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: STUDIO.timezone,
  });
  return `${dateStr} – ${endDateStr}`;
}

// Generate 30-min slots from 7:00 to 20:00 (26 slots)
function generateSlots(): { hour: number; minute: number; label: string }[] {
  const slots: { hour: number; minute: number; label: string }[] = [];
  for (let h = 7; h < 20; h++) {
    for (const m of [0, 30]) {
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const label = `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
      slots.push({ hour: h, minute: m, label });
    }
  }
  return slots;
}

const SLOTS = generateSlots();

function isSlotBlocked(
  slotDate: string,
  hour: number,
  minute: number,
  blockedTimes: BlockedTime[]
): BlockedTime | null {
  // slotDate + (hour, minute) is a studio-local wall clock → real UTC instant.
  const slotStart = new Date(studioWallClockToUtcIso(slotDate, hour, minute));
  const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);

  for (const bt of blockedTimes) {
    const btStart = new Date(bt.start_at);
    const btEnd = new Date(bt.end_at);
    // Overlap: slot starts before block ends AND slot ends after block starts
    if (slotStart < btEnd && slotEnd > btStart) {
      return bt;
    }
  }
  return null;
}

export default function BlockedTimesPage() {
  const { toast } = useToast();
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(studioDateString(new Date()));
  const [togglingSlot, setTogglingSlot] = useState<string | null>(null);

  // Form state for manual add
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = studioDateString(tomorrow);
  const [startAt, setStartAt] = useState(`${defaultDate}T09:00`);
  const [endAt, setEndAt] = useState(`${defaultDate}T18:00`);
  const [reason, setReason] = useState("");

  const loadBlockedTimes = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/blocked-times");
    const data = await res.json();
    setBlockedTimes(
      (data.blocked_times ?? []).sort(
        (a: BlockedTime, b: BlockedTime) =>
          new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
      )
    );
    setLoading(false);
  }, []);

  useEffect(() => { loadBlockedTimes(); }, [loadBlockedTimes]);

  async function toggleSlot(hour: number, minute: number) {
    const slotKey = `${hour}:${minute}`;
    if (togglingSlot === slotKey) return;
    setTogglingSlot(slotKey);

    const existing = isSlotBlocked(selectedDate, hour, minute, blockedTimes);

    if (existing) {
      // Optimistic: remove it
      setBlockedTimes((prev) => prev.filter((b) => b.id !== existing.id));
      const res = await fetch(`/api/admin/blocked-times/${existing.id}`, { method: "DELETE" });
      if (!res.ok) {
        // Revert
        setBlockedTimes((prev) =>
          [...prev, existing].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
        );
        toast("Failed to unblock slot", "error");
      } else {
        toast("Slot unblocked", "success");
      }
    } else {
      // Create a 30-min block in studio-local time, persisted as real UTC.
      const startIso = studioWallClockToUtcIso(selectedDate, hour, minute);
      const endIso = new Date(new Date(startIso).getTime() + 30 * 60 * 1000).toISOString();

      // Optimistic: add a temp entry
      const tempId = `temp-${Date.now()}`;
      const tempBlock: BlockedTime = { id: tempId, stylist_id: "", start_at: startIso, end_at: endIso, reason: null };
      setBlockedTimes((prev) =>
        [...prev, tempBlock].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
      );

      const res = await fetch("/api/admin/blocked-times", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_at: startIso, end_at: endIso }),
      });
      const data = await res.json();

      if (!res.ok) {
        setBlockedTimes((prev) => prev.filter((b) => b.id !== tempId));
        toast("Failed to block slot", "error");
      } else {
        // Replace temp with real
        setBlockedTimes((prev) =>
          prev.map((b) => (b.id === tempId ? data.blocked_time : b))
        );
        toast("Slot blocked", "success");
      }
    }
    setTogglingSlot(null);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/blocked-times", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_at: studioDateTimeLocalToUtcIso(startAt),
          end_at: studioDateTimeLocalToUtcIso(endAt),
          reason: reason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Failed to save", "error");
      } else {
        setBlockedTimes((prev) =>
          [...prev, data.blocked_time].sort(
            (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
          )
        );
        setReason("");
        setShowForm(false);
        toast("Time block added", "success");
      }
    } catch {
      toast("Network error", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this blocked time?")) return;
    const res = await fetch(`/api/admin/blocked-times/${id}`, { method: "DELETE" });
    if (res.ok) {
      setBlockedTimes((prev) => prev.filter((b) => b.id !== id));
      toast("Block removed", "success");
    }
  }

  // Filter blocked times relevant to the selected studio-local date.
  const dayStart = new Date(studioWallClockToUtcIso(selectedDate, 0, 0));
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const dayBlocks = blockedTimes.filter((bt) => {
    const s = new Date(bt.start_at);
    const e = new Date(bt.end_at);
    return s < dayEnd && e > dayStart;
  });

  const blockedCount = SLOTS.filter((s) => isSlotBlocked(selectedDate, s.hour, s.minute, dayBlocks)).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-[#9b6f6f] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-[#1a1714]">Blocked Times</h1>
          <p className="text-[#8a7e78] text-sm mt-1">
            Tap slots to block/unblock, or add custom ranges below.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#9b6f6f] text-white text-sm font-medium rounded-full hover:bg-[#8a5f5f] transition-all active:scale-95 flex-shrink-0 ml-4 min-h-[44px]"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Block Range
        </button>
      </div>

      {/* Date picker */}
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => {
            const d = new Date(selectedDate + "T12:00:00Z");
            d.setDate(d.getDate() - 1);
            setSelectedDate(studioDateString(d));
          }}
          className="w-11 h-11 flex items-center justify-center rounded-full border border-[#e8e2dc] hover:bg-[#f5ede8] transition-all active:scale-95"
        >
          <svg className="w-4 h-4 text-[#5c4a42]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border border-[#e8e2dc] rounded-xl px-3 py-2 text-base font-medium text-[#1a1714] bg-white focus:outline-none focus:ring-2 focus:ring-[#9b6f6f]"
        />
        <button
          onClick={() => {
            const d = new Date(selectedDate + "T12:00:00Z");
            d.setDate(d.getDate() + 1);
            setSelectedDate(studioDateString(d));
          }}
          className="w-11 h-11 flex items-center justify-center rounded-full border border-[#e8e2dc] hover:bg-[#f5ede8] transition-all active:scale-95"
        >
          <svg className="w-4 h-4 text-[#5c4a42]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <span className="text-xs text-[#8a7e78] ml-1">
          {blockedCount}/{SLOTS.length} blocked
        </span>
      </div>

      {/* Visual time grid */}
      <div className="bg-white rounded-2xl border border-[#e8e2dc] overflow-hidden mb-6">
        <div className="grid grid-cols-2 gap-px bg-[#e8e2dc]">
          {SLOTS.map((slot) => {
            const blocked = isSlotBlocked(selectedDate, slot.hour, slot.minute, dayBlocks);
            const slotKey = `${slot.hour}:${slot.minute}`;
            const isToggling = togglingSlot === slotKey;

            return (
              <button
                key={slotKey}
                onClick={() => toggleSlot(slot.hour, slot.minute)}
                disabled={isToggling}
                className={`
                  flex items-center justify-between px-4 min-h-[44px] text-sm font-medium transition-all
                  ${blocked
                    ? "bg-red-50 text-red-700 hover:bg-red-100"
                    : "bg-white text-[#5c4a42] hover:bg-[#f5ede8]"
                  }
                  ${isToggling ? "opacity-50" : ""}
                  active:scale-[0.98]
                `}
              >
                <span>{slot.label}</span>
                {blocked ? (
                  <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-[#c9beb7] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M12 6v6l4 2" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Add form (custom range) */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-[#e8e2dc] p-5 mb-6">
          <h2 className="font-display text-lg text-[#1a1714] mb-4">Block Custom Range</h2>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">Start</label>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                required
                className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">End</label>
              <input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                required
                className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">
              Reason <span className="text-[#8a7e78] font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Vacation, Personal day, Staff meeting…"
              className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-[#9b6f6f] text-white text-sm font-medium rounded-full hover:bg-[#8a5f5f] disabled:opacity-50 transition-all active:scale-95 min-h-[44px]"
            >
              {submitting ? "Adding…" : "Block This Time"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-5 py-2.5 border border-[#e8e2dc] text-sm text-[#8a7e78] font-medium rounded-full hover:bg-[#f5ede8] transition-all active:scale-95 min-h-[44px]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Existing block list */}
      <div className="mb-2">
        <h2 className="font-display text-lg text-[#1a1714]">All Upcoming Blocks</h2>
        <p className="text-xs text-[#8a7e78] mt-0.5">Custom ranges and grid blocks</p>
      </div>
      {blockedTimes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-[#e8e2dc]">
          <div className="w-12 h-12 rounded-full bg-[#f5ede8] flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-[#9b6f6f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <p className="font-display text-lg text-[#1a1714] mb-1">All clear</p>
          <p className="text-sm text-[#8a7e78]">No blocked times scheduled.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#e8e2dc] divide-y divide-[#f5f0eb] overflow-hidden">
          {blockedTimes.map((b) => (
            <div key={b.id} className="flex items-start justify-between px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1a1714]">
                    {formatRange(b.start_at, b.end_at)}
                  </p>
                  {b.reason && (
                    <p className="text-xs text-[#8a7e78] mt-0.5">{b.reason}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDelete(b.id)}
                className="text-xs text-[#8a7e78] hover:text-red-600 transition-colors ml-4 flex-shrink-0 min-h-[44px] flex items-center"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
