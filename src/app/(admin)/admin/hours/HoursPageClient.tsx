"use client";

import { useRef, useState, useCallback } from "react";
import type { OperationalHour, OperationalHoursOverride } from "@/lib/supabase/types";
import { useToast } from "@/components/Toast";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatTime12(time: string): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const period = h! >= 12 ? "PM" : "AM";
  const hour = h! > 12 ? h! - 12 : h === 0 ? 12 : h;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Weekly Default Row ──────────────────────────────────────────────────────

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
      if (hour) {
        await fetch(`/api/admin/hours/${hour.id}`, { method: "DELETE" });
        onClosed(dayIndex);
      }
    } else {
      await save(openTime, closeTime);
    }
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-3 transition-colors ${isOpen ? "bg-white" : "bg-[#faf9f7] opacity-60"}`}>
      <div className="w-10 flex-shrink-0">
        <span className={`text-sm font-semibold ${isOpen ? "text-[#1a1714]" : "text-[#a09890]"}`}>
          {DAY_SHORT[dayIndex]}
        </span>
      </div>
      <button
        onClick={toggleOpen}
        aria-label={isOpen ? "Close day" : "Open day"}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] focus:ring-offset-1 ${isOpen ? "bg-[#9b6f6f]" : "bg-[#d8d0c8]"}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 mt-0.5 ${isOpen ? "translate-x-5 ml-0.5" : "translate-x-0.5"}`} />
      </button>
      <span className={`text-xs w-10 flex-shrink-0 ${isOpen ? "text-[#9b6f6f] font-medium" : "text-[#a09890]"}`}>
        {isOpen ? "Open" : "Closed"}
      </span>
      {isOpen ? (
        <div className="flex items-center gap-2 flex-1">
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-[#8a7e78] uppercase tracking-wide">Opens</label>
            <input
              type="time"
              value={openTime}
              onChange={(e) => { setOpenTime(e.target.value); scheduleSave(e.target.value, closeTime); }}
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
              onChange={(e) => { setCloseTime(e.target.value); scheduleSave(openTime, e.target.value); }}
              onBlur={() => save(openTime, closeTime)}
              className="border border-[#e8e2dc] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7] w-[110px]"
              style={{ fontSize: 16 }}
            />
          </div>
          <div className={`ml-1 text-xs text-emerald-600 font-medium transition-all duration-500 ${savedFlash ? "opacity-100" : "opacity-0"}`}>
            {saving ? (
              <span className="w-3 h-3 border border-[#9b6f6f] border-t-transparent rounded-full animate-spin inline-block" />
            ) : "saved ✓"}
          </div>
        </div>
      ) : <div className="flex-1" />}
    </div>
  );
}

// ─── Inline Day Editor (replaces DaySheet) ──────────────────────────────────

interface InlineDayEditorProps {
  dateKey: string; // YYYY-MM-DD
  defaultHour: OperationalHour | undefined;
  override: OperationalHoursOverride | undefined;
  onSaved: (o: OperationalHoursOverride) => void;
  onDeleted: (dateKey: string) => void;
  onClose: () => void;
  savedFlash: boolean;
}

function InlineDayEditor({
  dateKey,
  defaultHour,
  override,
  onSaved,
  onDeleted,
  onClose,
  savedFlash,
}: InlineDayEditorProps) {
  const { toast } = useToast();

  const initOpen = override ? !override.is_closed : !!defaultHour;
  const initOpenTime = override?.open_time?.slice(0, 5) ?? defaultHour?.open_time?.slice(0, 5) ?? "09:00";
  const initCloseTime = override?.close_time?.slice(0, 5) ?? defaultHour?.close_time?.slice(0, 5) ?? "17:00";

  const [isOpen, setIsOpen] = useState(initOpen);
  const [openAt, setOpenAt] = useState(initOpenTime);
  const [closeAt, setCloseAt] = useState(initCloseTime);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [y, m, d] = dateKey.split("-").map(Number);
  const dateObj = new Date(y!, m! - 1, d!);
  const dayName = DAY_LONG[dateObj.getDay()];
  const displayDate = dateObj.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/hours/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: null,
          effective_from: dateKey,
          effective_until: dateKey,
          day_of_week: null,
          is_closed: !isOpen,
          open_time: isOpen ? openAt : null,
          close_time: isOpen ? closeAt : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Failed to save", "error");
      } else {
        onSaved(data.override);
        onClose();
      }
    } catch {
      toast("Network error", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!override) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/hours/overrides/${override.id}`, { method: "DELETE" });
      if (res.ok) {
        onDeleted(dateKey);
        toast("Override cleared", "success");
        onClose();
      } else {
        toast("Failed to delete", "error");
      }
    } catch {
      toast("Network error", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mt-3 bg-white rounded-2xl border-2 border-rose-200 shadow-lg p-4 animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-display text-base text-[#1a1714] font-semibold">{dayName}</p>
          <p className="text-xs text-[#8a7e78]">{displayDate}</p>
          {override && (
            <span className="text-xs text-[#c9a96e] font-medium">Has override</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {savedFlash && (
            <span className="text-xs text-emerald-600 font-semibold">Saved ✓</span>
          )}
          <button
            onClick={onClose}
            className="p-2.5 text-[#8a7e78] hover:text-[#1a1714] rounded-full hover:bg-[#f5f0eb] transition-all active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close editor"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Open / Closed toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setIsOpen(true)}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all active:scale-95 min-h-[44px] ${
            isOpen ? "bg-[#9b6f6f] text-white border-[#9b6f6f]" : "bg-white text-[#8a7e78] border-[#e8e2dc] hover:bg-[#f5f0eb]"
          }`}
        >
          Open
        </button>
        <button
          onClick={() => setIsOpen(false)}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all active:scale-95 min-h-[44px] ${
            !isOpen ? "bg-[#1a1714] text-white border-[#1a1714]" : "bg-white text-[#8a7e78] border-[#e8e2dc] hover:bg-[#f5f0eb]"
          }`}
        >
          Closed
        </button>
      </div>

      {/* Time inputs — only when Open */}
      {isOpen && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">Opens</label>
            <input
              type="time"
              value={openAt}
              onChange={(e) => setOpenAt(e.target.value)}
              className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
              style={{ fontSize: 16 }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">Closes</label>
            <input
              type="time"
              value={closeAt}
              onChange={(e) => setCloseAt(e.target.value)}
              className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
              style={{ fontSize: 16 }}
            />
          </div>
        </div>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold rounded-full disabled:opacity-50 transition-all active:scale-[0.98] min-h-[48px]"
      >
        {saving ? "Saving…" : "Save"}
      </button>

      {/* Clear override link */}
      {override && (
        <div className="text-center mt-2">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-[#8a7e78] hover:text-red-500 underline transition-all disabled:opacity-50 min-h-[44px] inline-flex items-center"
          >
            {deleting ? "Clearing…" : "Clear override"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Month Calendar ──────────────────────────────────────────────────────────

interface MonthCalendarProps {
  year: number;
  month: number; // 0-indexed
  hours: OperationalHour[];
  overrides: OperationalHoursOverride[];
  selectedDay: string | null;
  savedFlashDay: string | null;
  onDayClick: (dateKey: string) => void;
  onEditorSaved: (o: OperationalHoursOverride) => void;
  onEditorDeleted: (dateKey: string) => void;
  onEditorClose: () => void;
}

function MonthCalendar({
  year, month, hours, overrides,
  selectedDay, savedFlashDay,
  onDayClick, onEditorSaved, onEditorDeleted, onEditorClose,
}: MonthCalendarProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const hourMap = Object.fromEntries(hours.map((h) => [h.day_of_week, h]));
  const overrideMap = new Map<string, OperationalHoursOverride>();
  for (const o of overrides) {
    if (o.effective_from === o.effective_until && o.day_of_week == null) {
      overrideMap.set(o.effective_from, o);
    }
  }

  const firstDay = new Date(year, month, 1);
  const startPad = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  // Group into weeks (rows) so we can inject editor after the right row
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  // Find which week (row index) the selected day is in
  const selectedWeekIdx = selectedDay
    ? weeks.findIndex((week) => week.some((d) => d && toDateKey(d) === selectedDay))
    : -1;

  const selectedOverride = selectedDay ? overrideMap.get(selectedDay) : undefined;
  const selectedDayOfWeek = selectedDay ? new Date(selectedDay + "T12:00:00").getDay() : undefined;
  const selectedDefaultHour = selectedDayOfWeek !== undefined ? hourMap[selectedDayOfWeek] : undefined;

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_SHORT.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-[#a09890] uppercase tracking-wide py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Weeks + inline editor */}
      <div className="space-y-px">
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx}>
            {/* Week row */}
            <div className={`grid grid-cols-7 gap-px ${weekIdx === 0 ? "rounded-t-xl overflow-hidden" : ""} ${weekIdx === weeks.length - 1 && selectedWeekIdx !== weekIdx ? "rounded-b-xl overflow-hidden" : ""} bg-[#f5f0eb] border-x border-[#e8e2dc] ${weekIdx === 0 ? "border-t" : ""} ${weekIdx === weeks.length - 1 && selectedWeekIdx !== weekIdx ? "border-b" : ""}`}>
              {week.map((date, dayIdx) => {
                if (!date) {
                  return <div key={`pad-${weekIdx}-${dayIdx}`} className="bg-[#faf9f7] h-16 sm:h-20" />;
                }

                const dateKey = toDateKey(date);
                const isPast = date < today;
                const isToday = date.getTime() === today.getTime();
                const override = overrideMap.get(dateKey);
                const defaultHour = hourMap[date.getDay()];
                const hasOverride = !!override;
                const isSelected = selectedDay === dateKey;
                const hasSavedFlash = savedFlashDay === dateKey;

                let label = "";
                let labelClass = "";

                if (override) {
                  if (override.is_closed) {
                    label = "Closed";
                    labelClass = "text-red-500";
                  } else {
                    const ot = override.open_time?.slice(0, 5) ?? "";
                    const ct = override.close_time?.slice(0, 5) ?? "";
                    label = ot && ct ? `${formatTime12(ot).replace(":00", "")} – ${formatTime12(ct).replace(":00", "")}` : "Open";
                    labelClass = "text-[#9b6f6f]";
                  }
                } else if (defaultHour) {
                  const ot = defaultHour.open_time?.slice(0, 5) ?? "";
                  const ct = defaultHour.close_time?.slice(0, 5) ?? "";
                  label = ot && ct ? `${formatTime12(ot).replace(":00", "")}–${formatTime12(ct).replace(":00", "")}` : "Open";
                  labelClass = "text-[#8a7e78]";
                } else {
                  label = "Closed";
                  labelClass = "text-[#c9b5ad]";
                }

                return (
                  <button
                    key={dateKey}
                    onClick={() => !isPast && onDayClick(dateKey)}
                    disabled={isPast}
                    className={`relative bg-white h-16 sm:h-20 p-1.5 sm:p-2 flex flex-col items-center transition-colors ${
                      isPast ? "opacity-40 cursor-default" : "hover:bg-[#faf3f0] cursor-pointer"
                    } ${isSelected ? "bg-rose-50 ring-1 ring-inset ring-rose-200" : ""}`}
                  >
                    {/* Day number */}
                    <span className={`text-xs font-semibold mb-0.5 w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday ? "bg-[#9b6f6f] text-white" : isSelected ? "bg-rose-100 text-rose-700" : "text-[#1a1714]"
                    }`}>
                      {date.getDate()}
                    </span>

                    {/* Hours label or saved flash */}
                    {hasSavedFlash ? (
                      <span className="text-[9px] font-semibold text-emerald-600">Saved ✓</span>
                    ) : (
                      <span className={`text-[8px] sm:text-[9px] font-medium leading-tight text-center ${labelClass}`}>
                        {label}
                      </span>
                    )}

                    {/* Override dot */}
                    {hasOverride && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#c9a96e] rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Inline editor — shown below the week that contains the selected day */}
            {selectedWeekIdx === weekIdx && selectedDay && (
              <div className={`border-x border-b border-[#e8e2dc] rounded-b-xl bg-[#faf8f5] px-3 pb-3 ${weekIdx === weeks.length - 1 ? "" : "mb-px"}`}>
                <InlineDayEditor
                  dateKey={selectedDay}
                  defaultHour={selectedDefaultHour}
                  override={selectedOverride}
                  onSaved={onEditorSaved}
                  onDeleted={onEditorDeleted}
                  onClose={onEditorClose}
                  savedFlash={savedFlashDay === selectedDay}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface HoursPageClientProps {
  initialHours: OperationalHour[];
  initialOverrides: OperationalHoursOverride[];
}

export default function HoursPageClient({
  initialHours,
  initialOverrides,
}: HoursPageClientProps) {
  const [hours, setHours] = useState<OperationalHour[]>(
    [...initialHours].sort((a, b) => a.day_of_week - b.day_of_week)
  );
  const [overrides, setOverrides] = useState<OperationalHoursOverride[]>(initialOverrides);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [savedFlashDay, setSavedFlashDay] = useState<string | null>(null);

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

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
    setOverrides((prev) => {
      const filtered = prev.filter(
        (o) => !(o.effective_from === override.effective_from && o.effective_until === override.effective_until && o.day_of_week == null)
      );
      return [...filtered, override];
    });
    // Flash "Saved ✓" on the cell then collapse
    if (selectedDay) {
      setSavedFlashDay(selectedDay);
      setTimeout(() => setSavedFlashDay(null), 2000);
    }
  }

  function handleOverrideDeleted(dateKey: string) {
    setOverrides((prev) =>
      prev.filter((o) => !(o.effective_from === dateKey && o.effective_until === dateKey && o.day_of_week == null))
    );
  }

  function handleDayClick(dateKey: string) {
    // Toggle: clicking the same day collapses, clicking a new day switches
    setSelectedDay((prev) => (prev === dateKey ? null : dateKey));
  }

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  }

  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  }

  const hourMap = Object.fromEntries(hours.map((h) => [h.day_of_week, h]));

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-[#1a1714]">Operational Hours</h1>
        <p className="text-[#8a7e78] text-sm mt-1">
          Set your default weekly schedule, then tap any day to customize.
        </p>
      </div>

      {/* Default Week */}
      <div className="bg-white rounded-2xl border border-[#e8e2dc] overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-[#f5f0eb]">
          <p className="text-xs font-semibold text-[#c9a96e] uppercase tracking-widest">Default Week</p>
          <p className="text-xs text-[#8a7e78] mt-0.5">Changes save automatically.</p>
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

      {/* Month Calendar */}
      <div className="bg-white rounded-2xl border border-[#e8e2dc] p-4">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="p-2.5 rounded-full hover:bg-[#f5f0eb] transition-all active:scale-95 text-[#8a7e78] min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <p className="font-display text-base text-[#1a1714]">
            {MONTH_NAMES[calMonth]} {calYear}
          </p>
          <button
            onClick={nextMonth}
            className="p-2.5 rounded-full hover:bg-[#f5f0eb] transition-all active:scale-95 text-[#8a7e78] min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <MonthCalendar
          year={calYear}
          month={calMonth}
          hours={hours}
          overrides={overrides}
          selectedDay={selectedDay}
          savedFlashDay={savedFlashDay}
          onDayClick={handleDayClick}
          onEditorSaved={handleOverrideSaved}
          onEditorDeleted={handleOverrideDeleted}
          onEditorClose={() => setSelectedDay(null)}
        />

        <div className="flex items-center gap-4 mt-4 px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#c9a96e]" />
            <span className="text-xs text-[#8a7e78]">Has override</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-[#9b6f6f] flex items-center justify-center">
              <span className="text-[8px] text-white font-bold">1</span>
            </span>
            <span className="text-xs text-[#8a7e78]">Today</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-rose-100 ring-1 ring-rose-200 flex items-center justify-center">
              <span className="text-[8px] text-rose-700 font-bold">5</span>
            </span>
            <span className="text-xs text-[#8a7e78]">Selected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
