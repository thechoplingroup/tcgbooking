"use client";

import { useEffect, useState } from "react";
import type { BlockedTime } from "@/lib/supabase/types";

function formatRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const sameDay = start.toDateString() === end.toDateString();

  const dateStr = start.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: start.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });

  const startTime = start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const endTime = end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (sameDay) return `${dateStr} · ${startTime} – ${endTime}`;

  const endDateStr = end.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `${dateStr} – ${endDateStr}`;
}

export default function BlockedTimesPage() {
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().slice(0, 10);

  const [startAt, setStartAt] = useState(`${defaultDate}T09:00`);
  const [endAt, setEndAt] = useState(`${defaultDate}T18:00`);
  const [reason, setReason] = useState("");

  useEffect(() => { loadBlockedTimes(); }, []);

  async function loadBlockedTimes() {
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
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/blocked-times", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_at: new Date(startAt).toISOString(),
          end_at: new Date(endAt).toISOString(),
          reason: reason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Failed to save" });
      } else {
        setBlockedTimes((prev) =>
          [...prev, data.blocked_time].sort(
            (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
          )
        );
        setReason("");
        setShowForm(false);
        setMessage({ type: "success", text: "Time block added." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this blocked time?")) return;
    const res = await fetch(`/api/admin/blocked-times/${id}`, { method: "DELETE" });
    if (res.ok) setBlockedTimes((prev) => prev.filter((b) => b.id !== id));
  }

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
            Block off vacations, personal time, or anything else.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#9b6f6f] text-white text-sm font-medium rounded-full hover:bg-[#8a5f5f] transition-colors flex-shrink-0 ml-4"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Block Time
        </button>
      </div>

      {message && (
        <div className={`mb-5 px-4 py-3 rounded-xl text-sm ${
          message.type === "success"
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {message.text}
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-[#e8e2dc] p-5 mb-6">
          <h2 className="font-display text-lg text-[#1a1714] mb-4">Add Block</h2>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">Start</label>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                required
                className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">End</label>
              <input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                required
                className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
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
              className="px-5 py-2 bg-[#9b6f6f] text-white text-sm font-medium rounded-full hover:bg-[#8a5f5f] disabled:opacity-50 transition-colors"
            >
              {submitting ? "Adding…" : "Block This Time"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-5 py-2 border border-[#e8e2dc] text-sm text-[#8a7e78] font-medium rounded-full hover:bg-[#f5ede8] transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Block list */}
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
                className="text-xs text-[#8a7e78] hover:text-red-600 transition-colors ml-4 flex-shrink-0"
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
