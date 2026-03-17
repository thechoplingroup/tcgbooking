"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { OperationalHour, OperationalHoursOverride } from "@/lib/supabase/types";
import { useToast } from "@/components/Toast";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

function formatTime12(time: string): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const period = h! >= 12 ? "PM" : "AM";
  const hour = h! > 12 ? h! - 12 : h === 0 ? 12 : h;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

// ─── Weekly Row ──────────────────────────────────────────────────────────────

interface DayRowProps {
  dayIndex: number;
  hour: OperationalHour | undefined;
  onSaved: (hour: OperationalHour) => void;
  onClosed: (dayIndex: number) => void;
}

function DayRow({ dayIndex, hour, onSaved, onClosed }: DayRowProps) {
  const isOpen = !!hour;
  const [openTime, setOpenTime] = useState(hour?.open_time?.slice(0, 5) ?? "09:00");
  const [closeTime, setCloseTime] = useState(hour?.close_time?.slice(0, 5) ?? "17:00");
  const [savedFlash, setSavedFlash] = useState(false);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  // Sync external changes (when data loads)
  useEffect(() => {
    if (hour) {
      setOpenTime(hour.open_time?.slice(0, 5) ?? "09:00");
      setCloseTime(hour.close_time?.slice(0, 5) ?? "17:00");
    }
  }, [hour?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback(
    async (open: string, close: string) => {
      setSaving(true);
      try {
        const res = await fetch("/api/admin/hours", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ day_of_week: dayIndex, open_time: open, close_time: close }),
        });
        const data = await res.json();
        if (res.ok) {
          onSaved(data.hour);
          setSavedFlash(true);
          setTimeout(() => setSavedFlash(false), 1800);
        } else {
          toast(data.error ?? "Failed to save", "error");
        }
      } catch {
        toast("Network error", "error");
      } finally {
        setSaving(false);
      }
    },
    [dayIndex, onSaved, toast]
  );

  function scheduleSave(open: string, close: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(open, close), 500);
  }

  async function toggleOpen() {
    if (isOpen) {
      // Mark closed — delete the row
      if (hour) {
        await fetch(`/api/admin/hours/${hour.id}`, { method: "DELETE" });
        onClosed(dayIndex);
      }
    } else {
      // Open — save with defaults
      await save(openTime, closeTime);
    }
  }

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
        isOpen ? "bg-white" : "bg-[#faf9f7] opacity-60"
      }`}
    >
      {/* Day name */}
      <div className="w-10 flex-shrink-0">
        <span className={`text-sm font-semibold ${isOpen ? "text-[#1a1714]" : "text-[#a09890]"}`}>
          {DAY_SHORT[dayIndex]}
        </span>
      </div>

      {/* Toggle */}
      <button
        onClick={toggleOpen}
        aria-label={isOpen ? "Close day" : "Open day"}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] focus:ring-offset-1 ${
          isOpen ? "bg-[#9b6f6f]" : "bg-[#d8d0c8]"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 mt-0.5 ${
            isOpen ? "translate-x-5 ml-0.5" : "translate-x-0.5"
          }`}
        />
      </button>
      <span className={`text-xs w-10 flex-shrink-0 ${isOpen ? "text-[#9b6f6f] font-medium" : "text-[#a09890]"}`}>
        {isOpen ? "Open" : "Closed"}
      </span>

      {/* Time inputs */}
      {isOpen ? (
        <div className="flex items-center gap-2 flex-1">
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-[#8a7e78] uppercase tracking-wide">Opens</label>
            <input
              type="time"
              value={openTime}
              onChange={(e) => {
                setOpenTime(e.target.value);
                scheduleSave(e.target.value, closeTime);
              }}
              onBlur={() => save(openTime, closeTime)}
              className="border border-[#e8e2dc] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7] w-[110px]"
              style={{ fontSize: 16 }}
            />
          </div>
          <span className="text-[#c9a96e] mt-4 text-sm">–</span>
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-[#8a7e78] uppercase tracking-wide">Closes</label>
            <input
              type="time"
              value={closeTime}
              onChange={(e) => {
                setCloseTime(e.target.value);
                scheduleSave(openTime, e.target.value);
              }}
              onBlur={() => save(openTime, closeTime)}
              className="border border-[#e8e2dc] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7] w-[110px]"
              style={{ fontSize: 16 }}
            />
          </div>

          {/* Saved flash */}
          <div
            className={`ml-1 text-xs text-emerald-600 font-medium transition-all duration-500 ${
              savedFlash ? "opacity-100" : "opacity-0"
            }`}
          >
            {saving ? (
              <span className="w-3 h-3 border border-[#9b6f6f] border-t-transparent rounded-full animate-spin inline-block" />
            ) : (
              "saved ✓"
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1" />
      )}
    </div>
  );
}

// ─── Override Form ────────────────────────────────────────────────────────────

interface OverrideFormProps {
  onSaved: (override: OperationalHoursOverride) => void;
  onCancel: () => void;
}

function OverrideForm({ onSaved, onCancel }: OverrideFormProps) {
  const [label, setLabel] = useState("");
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState<string>("-1"); // -1 = all days
  const [isClosed, setIsClosed] = useState(true);
  const [openTime, setOpenTime] = useState("09:00");
  const [closeTime, setCloseTime] = useState("17:00");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!from || !until) { setError("Date range required."); return; }
    if (new Date(from) > new Date(until)) { setError("Start must be before end."); return; }
    if (!isClosed && (!openTime || !closeTime)) { setError("Hours required."); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/hours/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim() || null,
          effective_from: from,
          effective_until: until,
          day_of_week: Number(dayOfWeek) >= 0 ? Number(dayOfWeek) : null,
          open_time: isClosed ? null : openTime,
          close_time: isClosed ? null : closeTime,
          is_closed: isClosed,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
      } else {
        onSaved(data.override);
        toast("Special hours saved ✓", "success");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-[#e8e2dc] rounded-2xl bg-white p-5 space-y-4">
      <h3 className="font-display text-base text-[#1a1714]">Add Special Hours</h3>

      {/* Label */}
      <div>
        <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">Label <span className="font-normal text-[#8a7e78]">(optional)</span></label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Holiday Break, Summer Hours…"
          className="w-full border border-[#e8e2dc] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
        />
      </div>

      {/* Date range */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            required
            className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
            style={{ fontSize: 16 }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">Until</label>
          <input
            type="date"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            required
            className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
            style={{ fontSize: 16 }}
          />
        </div>
      </div>

      {/* Apply to */}
      <div>
        <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">Apply to</label>
        <select
          value={dayOfWeek}
          onChange={(e) => setDayOfWeek(e.target.value)}
          className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
        >
          <option value="-1">All days in range</option>
          {DAYS.map((name, i) => (
            <option key={i} value={i}>{name} only</option>
          ))}
        </select>
      </div>

      {/* Open / Closed toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsClosed(true)}
          className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
            isClosed
              ? "bg-[#1a1714] text-white border-[#1a1714]"
              : "bg-white text-[#8a7e78] border-[#e8e2dc] hover:bg-[#f5f0eb]"
          }`}
        >
          Closed all day
        </button>
        <button
          type="button"
          onClick={() => setIsClosed(false)}
          className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
            !isClosed
              ? "bg-[#9b6f6f] text-white border-[#9b6f6f]"
              : "bg-white text-[#8a7e78] border-[#e8e2dc] hover:bg-[#f5f0eb]"
          }`}
        >
          Open with hours
        </button>
      </div>

      {/* Hours */}
      {!isClosed && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">Opens</label>
            <input
              type="time"
              value={openTime}
              onChange={(e) => setOpenTime(e.target.value)}
              className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
              style={{ fontSize: 16 }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">Closes</label>
            <input
              type="time"
              value={closeTime}
              onChange={(e) => setCloseTime(e.target.value)}
              className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
              style={{ fontSize: 16 }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-2.5 bg-[#9b6f6f] text-white text-sm font-semibold rounded-full hover:bg-[#8a5f5f] disabled:opacity-50 transition-all"
        >
          {saving ? "Saving…" : "Save Special Hours"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 border border-[#e8e2dc] text-sm text-[#8a7e78] font-medium rounded-full hover:bg-[#f5f0eb] transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function HoursPage() {
  const [hours, setHours] = useState<OperationalHour[]>([]);
  const [overrides, setOverrides] = useState<OperationalHoursOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [deletingOverrideId, setDeletingOverrideId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/admin/hours")
      .then((r) => r.json())
      .then(({ hours: h, overrides: o }) => {
        setHours((h ?? []).sort((a: OperationalHour, b: OperationalHour) => a.day_of_week - b.day_of_week));
        setOverrides(o ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  function handleHourSaved(updated: OperationalHour) {
    setHours((prev) => {
      const exists = prev.find((h) => h.day_of_week === updated.day_of_week);
      if (exists) return prev.map((h) => h.day_of_week === updated.day_of_week ? updated : h);
      return [...prev, updated].sort((a, b) => a.day_of_week - b.day_of_week);
    });
  }

  function handleDayClosed(dayIndex: number) {
    setHours((prev) => prev.filter((h) => h.day_of_week !== dayIndex));
  }

  function handleOverrideSaved(override: OperationalHoursOverride) {
    setOverrides((prev) => [...prev, override].sort((a, b) =>
      a.effective_from.localeCompare(b.effective_from)
    ));
    setShowOverrideForm(false);
  }

  async function deleteOverride(id: string) {
    setDeletingOverrideId(id);
    try {
      const res = await fetch(`/api/admin/hours/overrides/${id}`, { method: "DELETE" });
      if (res.ok) {
        setOverrides((prev) => prev.filter((o) => o.id !== id));
        toast("Override removed", "success");
      } else {
        toast("Failed to delete", "error");
      }
    } catch {
      toast("Network error", "error");
    } finally {
      setDeletingOverrideId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-[#9b6f6f] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hourMap = Object.fromEntries(hours.map((h) => [h.day_of_week, h]));

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-[#1a1714]">Operational Hours</h1>
        <p className="text-[#8a7e78] text-sm mt-1">
          Set your weekly schedule. Changes save automatically.
        </p>
      </div>

      {/* Weekly schedule */}
      <div className="bg-white rounded-2xl border border-[#e8e2dc] overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-[#f5f0eb]">
          <p className="text-xs font-semibold text-[#c9a96e] uppercase tracking-widest">Weekly Schedule</p>
        </div>
        <div className="divide-y divide-[#f5f0eb]">
          {Array.from({ length: 7 }, (_, i) => (
            <DayRow
              key={i}
              dayIndex={i}
              hour={hourMap[i]}
              onSaved={handleHourSaved}
              onClosed={handleDayClosed}
            />
          ))}
        </div>
      </div>

      {/* Special hours / overrides */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-[#1a1714]">Special Hours</p>
            <p className="text-xs text-[#8a7e78] mt-0.5">Holidays, closures, or custom schedules. These override your weekly hours.</p>
          </div>
          {!showOverrideForm && (
            <button
              onClick={() => setShowOverrideForm(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#9b6f6f] text-white text-sm font-medium rounded-full hover:bg-[#8a5f5f] transition-colors flex-shrink-0 ml-4"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
          )}
        </div>

        {showOverrideForm && (
          <div className="mb-4">
            <OverrideForm
              onSaved={handleOverrideSaved}
              onCancel={() => setShowOverrideForm(false)}
            />
          </div>
        )}

        {overrides.length === 0 && !showOverrideForm ? (
          <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-[#e8e2dc]">
            <p className="text-sm text-[#8a7e78]">No special hours yet.</p>
            <button
              onClick={() => setShowOverrideForm(true)}
              className="text-sm text-[#9b6f6f] font-medium mt-1 hover:underline"
            >
              Add your first override
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {overrides.map((o) => (
              <div
                key={o.id}
                className="bg-white rounded-2xl border border-[#e8e2dc] px-4 py-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {o.label && (
                      <span className="text-sm font-semibold text-[#1a1714]">{o.label}</span>
                    )}
                    <span className="text-xs bg-[#f5ede8] text-[#9b6f6f] px-2 py-0.5 rounded-full font-medium">
                      {formatDate(o.effective_from)}
                      {o.effective_from !== o.effective_until && ` – ${formatDate(o.effective_until)}`}
                    </span>
                    {o.day_of_week != null && (
                      <span className="text-xs text-[#8a7e78]">{DAYS[o.day_of_week]} only</span>
                    )}
                  </div>
                  <p className="text-xs text-[#8a7e78] mt-0.5">
                    {o.is_closed
                      ? "Closed all day"
                      : `${formatTime12(o.open_time?.slice(0, 5) ?? "")} – ${formatTime12(o.close_time?.slice(0, 5) ?? "")}`}
                  </p>
                </div>
                <button
                  onClick={() => deleteOverride(o.id)}
                  disabled={deletingOverrideId === o.id}
                  className="text-[#8a7e78] hover:text-red-600 transition-colors flex-shrink-0 p-1 disabled:opacity-40"
                  aria-label="Delete override"
                >
                  {deletingOverrideId === o.id ? (
                    <span className="w-4 h-4 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
