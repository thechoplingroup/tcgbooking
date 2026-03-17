"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";

interface Props {
  onBlocked?: () => void;
}

function todayLocalStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

function tomorrowLocalStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

export default function QuickBlockSheet({ onBlocked }: Props) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<"today" | "tomorrow">("today");
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("13:00");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  function getDateStr() {
    return date === "today" ? todayLocalStr() : tomorrowLocalStr();
  }

  async function handleSave() {
    const dateStr = getDateStr();
    const start_at = `${dateStr}T${startTime}:00Z`;
    const end_at   = `${dateStr}T${endTime}:00Z`;

    if (endTime <= startTime) {
      toast("End time must be after start time", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/blocked-times", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_at, end_at, reason: note.trim() || null }),
      });
      if (res.ok) {
        toast(`Blocked ${startTime}–${endTime} ✓`, "success");
        setOpen(false);
        setNote("");
        onBlocked?.();
      } else {
        const d = await res.json();
        toast(d.error ?? "Failed to block time", "error");
      }
    } catch {
      toast("Network error", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-white border border-[#e8e2dc] rounded-xl px-3 py-3 text-sm font-medium text-[#5c4a42] hover:border-[#9b6f6f] hover:bg-[#fdf8f6] active:scale-[0.98] transition-all min-h-[48px] w-full"
      >
        <div className="w-7 h-7 rounded-lg bg-[#fce8e8] flex items-center justify-center flex-shrink-0">
          <svg className="w-3.5 h-3.5 text-[#9b5050]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            <line x1="4" y1="20" x2="20" y2="4" strokeWidth={2} />
          </svg>
        </div>
        Block Time
      </button>

      {/* Sheet */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-full sm:max-w-sm bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl p-5">
            {/* Handle */}
            <div className="flex justify-center mb-4 sm:hidden">
              <div className="w-10 h-1 bg-[#e8e2dc] rounded-full" />
            </div>

            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display text-lg text-[#1a1714]">Block Time</h3>
              <button onClick={() => setOpen(false)} className="p-2 text-[#8a7e78] hover:text-[#1a1714]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Day picker */}
            <div className="flex gap-2 mb-4">
              {(["today", "tomorrow"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDate(d)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    date === d
                      ? "bg-[#9b6f6f] text-white border-[#9b6f6f]"
                      : "bg-white text-[#5c4a42] border-[#e8e2dc] hover:bg-[#f5f0eb]"
                  }`}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>

            {/* Time pickers */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">Start</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
                  style={{ fontSize: 16 }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">End</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
                  style={{ fontSize: 16 }}
                />
              </div>
            </div>

            {/* Note */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">
                Note <span className="font-normal text-[#8a7e78]">(optional)</span>
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder='e.g. "lunch", "school pickup", "dentist"'
                className="w-full border border-[#e8e2dc] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
                style={{ fontSize: 16 }}
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 bg-[#9b6f6f] text-white font-semibold rounded-full hover:bg-[#8a5f5f] disabled:opacity-50 transition-all text-sm min-h-[48px]"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Blocking…
                </span>
              ) : "Block This Time"}
            </button>

            <p className="text-xs text-[#8a7e78] text-center mt-3">
              This will hide those slots from clients immediately.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
