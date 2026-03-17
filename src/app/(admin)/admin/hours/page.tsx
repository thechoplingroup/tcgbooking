"use client";

import { useEffect, useState } from "react";
import type { OperationalHour } from "@/lib/supabase/types";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h! >= 12 ? "PM" : "AM";
  const hour = h! > 12 ? h! - 12 : h === 0 ? 12 : h;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

export default function HoursPage() {
  const [hours, setHours] = useState<OperationalHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [day, setDay] = useState(2);
  const [openTime, setOpenTime] = useState("09:00");
  const [closeTime, setCloseTime] = useState("18:00");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { loadHours(); }, []);

  async function loadHours() {
    setLoading(true);
    const res = await fetch("/api/admin/hours");
    const data = await res.json();
    setHours((data.hours ?? []).sort((a: OperationalHour, b: OperationalHour) => a.day_of_week - b.day_of_week));
    setLoading(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day_of_week: day, open_time: openTime, close_time: closeTime }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Failed to save" });
      } else {
        setMessage({ type: "success", text: `${DAYS[day]} hours saved.` });
        setShowForm(false);
        await loadHours();
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, dayIndex: number) {
    if (!confirm(`Remove hours for ${DAYS[dayIndex]}?`)) return;
    await fetch(`/api/admin/hours/${id}`, { method: "DELETE" });
    setHours((prev) => prev.filter((h) => h.id !== id));
  }

  const configuredDaySet = new Set(hours.map((h) => h.day_of_week));

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
          <h1 className="font-display text-3xl text-[#1a1714]">Operational Hours</h1>
          <p className="text-[#8a7e78] text-sm mt-1">
            Set the days and hours you accept bookings.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#9b6f6f] text-white text-sm font-medium rounded-full hover:bg-[#8a5f5f] transition-colors flex-shrink-0 ml-4"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Hours
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
          <h2 className="font-display text-lg text-[#1a1714] mb-4">Add Hours</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">Day</label>
              <select
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
              >
                {DAYS.map((name, i) => (
                  <option key={i} value={i}>
                    {name}
                    {configuredDaySet.has(i) ? " ✓" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">Open</label>
              <input
                type="time"
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
                required
                className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">Close</label>
              <input
                type="time"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                required
                className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-[#9b6f6f] text-white text-sm font-medium rounded-full hover:bg-[#8a5f5f] disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : configuredDaySet.has(day) ? "Update Hours" : "Add Hours"}
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

      {/* Visual week grid */}
      <div className="bg-white rounded-2xl border border-[#e8e2dc] p-5 mb-6">
        <h2 className="text-sm font-semibold text-[#1a1714] mb-4">Weekly Schedule</h2>
        <div className="grid grid-cols-7 gap-1">
          {DAYS.map((_, i) => {
            const h = hours.find((h) => h.day_of_week === i);
            const isOpen = !!h;
            return (
              <div
                key={i}
                className={`rounded-xl py-2.5 px-1 text-center transition-colors ${
                  isOpen
                    ? "bg-[#f5ede8] border border-[#e8d8d0]"
                    : "bg-[#faf9f7] border border-[#f0ebe6]"
                }`}
              >
                <p className={`text-[9px] font-bold uppercase tracking-wide ${isOpen ? "text-[#c9a96e]" : "text-[#c8c0b8]"}`}>
                  {DAY_SHORT[i]}
                </p>
                {isOpen ? (
                  <div className="mt-1">
                    <div className="w-2 h-2 rounded-full bg-[#9b6f6f] mx-auto" />
                  </div>
                ) : (
                  <div className="mt-1">
                    <div className="w-2 h-2 rounded-full bg-[#e0dbd6] mx-auto" />
                  </div>
                )}
                <p className={`text-[8px] mt-1 ${isOpen ? "text-[#9b6f6f] font-medium" : "text-[#c8c0b8]"}`}>
                  {isOpen ? "Open" : "Closed"}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hours list */}
      {hours.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-2xl border border-[#e8e2dc]">
          <p className="text-sm text-[#8a7e78]">No hours set. Add your first day above.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#e8e2dc] divide-y divide-[#f5f0eb] overflow-hidden">
          {hours.map((h) => (
            <div key={h.id} className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#f5ede8] flex items-center justify-center">
                  <span className="text-xs font-bold text-[#9b6f6f]">
                    {DAY_SHORT[h.day_of_week]}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1a1714]">{DAYS[h.day_of_week]}</p>
                  <p className="text-xs text-[#8a7e78]">
                    {formatTime12(h.open_time.slice(0, 5))} – {formatTime12(h.close_time.slice(0, 5))}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(h.id, h.day_of_week)}
                className="text-xs text-[#8a7e78] hover:text-red-600 transition-colors"
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
