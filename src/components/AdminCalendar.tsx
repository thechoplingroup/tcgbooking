"use client";

import { useMemo, useState, useEffect } from "react";
import { STUDIO } from "@/config/studio";
import {
  studioMinutesFromMidnight,
  studioDateString,
} from "@/lib/time";

/* ─── Types ─────────────────────────────────────────────────────────── */

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

interface BlockedTime {
  id: string;
  start_at: string;
  end_at: string;
  reason?: string;
}

export interface AdminCalendarProps {
  appointments: AppointmentRow[];
  blockedTimes?: BlockedTime[];
  onAppointmentClick?: (id: string) => void;
}

/* ─── Constants ─────────────────────────────────────────────────────── */

const HOUR_START = 7;
const HOUR_END = 21; // 9 PM
const HOUR_HEIGHT = 64; // px per hour
const TOTAL_HOURS = HOUR_END - HOUR_START;

const STATUS_BORDER: Record<string, string> = {
  pending: "border-l-amber-400",
  confirmed: "border-l-emerald-400",
  cancelled: "border-l-gray-300",
  no_show: "border-l-red-400",
  reschedule_requested: "border-l-purple-400",
};

const STATUS_BG: Record<string, string> = {
  pending: "bg-amber-50 hover:bg-amber-100/80",
  confirmed: "bg-emerald-50 hover:bg-emerald-100/80",
  cancelled: "bg-gray-50 hover:bg-gray-100/80",
  no_show: "bg-red-50 hover:bg-red-100/80",
  reschedule_requested: "bg-purple-50 hover:bg-purple-100/80",
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ─── Helpers ───────────────────────────────────────────────────────── */

function clientName(appt: AppointmentRow): string {
  return appt.client?.full_name ?? appt.walk_in?.full_name ?? "Guest";
}

function serviceNames(appt: AppointmentRow): string {
  if (appt.appointment_services && appt.appointment_services.length > 0) {
    const names = appt.appointment_services
      .map((as) => as.service?.name)
      .filter(Boolean);
    return names.length > 0 ? names.join(", ") : "Service";
  }
  return appt.service?.name ?? "Service";
}

/** Minutes from studio-local midnight for a stored UTC instant. */
function getMinutesFromMidnight(iso: string): number {
  return studioMinutesFromMidnight(iso);
}

function formatTimeShort(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STUDIO.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10) % 24;
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const suffix = h >= 12 ? "p" : "a";
  const hour12 = h % 12 || 12;
  return m > 0 ? `${hour12}:${String(m).padStart(2, "0")}${suffix}` : `${hour12}${suffix}`;
}

/**
 * Week grid works on studio-local calendar dates. `CalDay` represents a single
 * day column by its studio-local date string (YYYY-MM-DD) and a midnight Date
 * (built in UTC just so `.toLocaleDateString` with the studio tz can render it).
 */
interface CalDay {
  dateStr: string;
  midnightUtc: Date;
  dayOfMonth: number;
}

function calDayFromStudioDateStr(dateStr: string): CalDay {
  const [y, m, d] = dateStr.split("-").map(Number);
  const midnightUtc = new Date(Date.UTC(y!, m! - 1, d!));
  return { dateStr, midnightUtc, dayOfMonth: d! };
}

/** Monday of the studio-local week containing `date`. */
function getWeekStart(date: Date): CalDay {
  const todayStr = studioDateString(date);
  const [y, m, d] = todayStr.split("-").map(Number);
  const anchor = new Date(Date.UTC(y!, m! - 1, d!));
  const dow = anchor.getUTCDay(); // 0 = Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  anchor.setUTCDate(anchor.getUTCDate() + diff);
  const ds = `${anchor.getUTCFullYear()}-${String(anchor.getUTCMonth() + 1).padStart(2, "0")}-${String(anchor.getUTCDate()).padStart(2, "0")}`;
  return calDayFromStudioDateStr(ds);
}

function addDays(day: CalDay, n: number): CalDay {
  const next = new Date(day.midnightUtc);
  next.setUTCDate(next.getUTCDate() + n);
  const ds = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
  return calDayFromStudioDateStr(ds);
}

function formatDateHeader(day: CalDay): string {
  return day.midnightUtc.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/* ─── Component ─────────────────────────────────────────────────────── */

export default function AdminCalendar({
  appointments,
  blockedTimes = [],
  onAppointmentClick,
}: AdminCalendarProps) {
  const [weekStart, setWeekStart] = useState<CalDay>(() => getWeekStart(new Date()));
  const [now, setNow] = useState<Date>(new Date());

  // Tick the clock every minute for the current-time indicator
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  // Bucket appointments by day index (0-6) using studio-local date.
  const apptsByDay = useMemo(() => {
    const buckets: AppointmentRow[][] = Array.from({ length: 7 }, () => []);
    for (const appt of appointments) {
      const ds = studioDateString(appt.start_at);
      for (let i = 0; i < 7; i++) {
        if (ds === weekDays[i]!.dateStr) {
          buckets[i]!.push(appt);
          break;
        }
      }
    }
    return buckets;
  }, [appointments, weekDays]);

  // Bucket blocked times by day index using studio-local date.
  const blockedByDay = useMemo(() => {
    const buckets: BlockedTime[][] = Array.from({ length: 7 }, () => []);
    for (const bt of blockedTimes) {
      const ds = studioDateString(bt.start_at);
      for (let i = 0; i < 7; i++) {
        if (ds === weekDays[i]!.dateStr) {
          buckets[i]!.push(bt);
          break;
        }
      }
    }
    return buckets;
  }, [blockedTimes, weekDays]);

  // Current-time indicator position (studio local).
  const nowStudioDateStr = studioDateString(now);
  const isCurrentWeek = weekDays.some((d) => d.dateStr === nowStudioDateStr);
  const nowMinutes = studioMinutesFromMidnight(now);
  const nowTop = ((nowMinutes - HOUR_START * 60) / (TOTAL_HOURS * 60)) * (TOTAL_HOURS * HOUR_HEIGHT);
  const showNowLine = isCurrentWeek && nowMinutes >= HOUR_START * 60 && nowMinutes <= HOUR_END * 60;
  const todayIndex = isCurrentWeek
    ? weekDays.findIndex((d) => d.dateStr === nowStudioDateStr)
    : -1;

  function prevWeek() {
    setWeekStart((s) => addDays(s, -7));
  }
  function nextWeek() {
    setWeekStart((s) => addDays(s, 7));
  }
  function goToday() {
    setWeekStart(getWeekStart(new Date()));
  }

  const weekLabel = `${formatDateHeader(weekDays[0]!)} – ${formatDateHeader(weekDays[6]!)}`;

  return (
    <div className="bg-white rounded-2xl border border-[#e8e2dc] overflow-hidden">
      {/* Header: navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#e8e2dc] bg-[#faf8f5]">
        <div className="flex items-center gap-2">
          <button
            onClick={prevWeek}
            className="p-2 rounded-lg hover:bg-[#f5ede8] text-[#8a7e78] transition-colors"
            aria-label="Previous week"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToday}
            className="px-3 py-1.5 text-xs font-semibold text-[#9b6f6f] border border-[#e8e2dc] rounded-lg hover:bg-[#f5ede8] transition-colors"
          >
            Today
          </button>
          <button
            onClick={nextWeek}
            className="p-2 rounded-lg hover:bg-[#f5ede8] text-[#8a7e78] transition-colors"
            aria-label="Next week"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <p className="text-sm font-semibold text-[#1a1714]">{weekLabel}</p>
      </div>

      {/* Day header row */}
      <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-[#e8e2dc]">
        <div /> {/* gutter */}
        {weekDays.map((d, i) => {
          const isToday = todayIndex === i;
          return (
            <div
              key={i}
              className={`text-center py-2 border-l border-[#e8e2dc] ${isToday ? "bg-[#f5ede8]" : ""}`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8a7e78]">
                {DAY_LABELS[i]}
              </p>
              <p
                className={`text-sm font-bold mt-0.5 ${
                  isToday
                    ? "text-white bg-[#9b6f6f] w-7 h-7 rounded-full flex items-center justify-center mx-auto"
                    : "text-[#1a1714]"
                }`}
              >
                {d.dayOfMonth}
              </p>
            </div>
          );
        })}
      </div>

      {/* Scrollable time grid */}
      <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
        <div
          className="grid grid-cols-[56px_repeat(7,1fr)] relative"
          style={{ minHeight: TOTAL_HOURS * HOUR_HEIGHT }}
        >
          {/* Time labels column */}
          <div className="relative">
            {Array.from({ length: TOTAL_HOURS }, (_, i) => {
              const hour = HOUR_START + i;
              const label =
                hour === 0
                  ? "12 AM"
                  : hour < 12
                    ? `${hour} AM`
                    : hour === 12
                      ? "12 PM"
                      : `${hour - 12} PM`;
              return (
                <div
                  key={hour}
                  className="absolute right-2 text-[10px] text-[#8a7e78] -translate-y-1/2"
                  style={{ top: i * HOUR_HEIGHT }}
                >
                  {label}
                </div>
              );
            })}
          </div>

          {/* Day columns */}
          {weekDays.map((_, dayIdx) => (
            <div key={dayIdx} className="relative border-l border-[#e8e2dc]">
              {/* Hour grid lines */}
              {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                <div
                  key={i}
                  className="absolute w-full border-t border-[#f0ebe6]"
                  style={{ top: i * HOUR_HEIGHT }}
                />
              ))}

              {/* Half-hour dashed lines */}
              {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                <div
                  key={`half-${i}`}
                  className="absolute w-full border-t border-dashed border-[#f5f0eb]"
                  style={{ top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                />
              ))}

              {/* Blocked times */}
              {blockedByDay[dayIdx]!.map((bt) => {
                const startMin = getMinutesFromMidnight(bt.start_at);
                const endMin = getMinutesFromMidnight(bt.end_at);
                const top = ((startMin - HOUR_START * 60) / 60) * HOUR_HEIGHT;
                const height = ((endMin - startMin) / 60) * HOUR_HEIGHT;
                if (top + height < 0 || top > TOTAL_HOURS * HOUR_HEIGHT) return null;
                return (
                  <div
                    key={bt.id}
                    className="absolute left-0.5 right-0.5 rounded-lg overflow-hidden"
                    style={{
                      top: Math.max(0, top),
                      height: Math.max(16, height),
                      background:
                        "repeating-linear-gradient(135deg, #e8e2dc22, #e8e2dc22 4px, #f0ebe644 4px, #f0ebe644 8px)",
                      border: "1px dashed #d4ccc5",
                    }}
                    title={bt.reason ?? "Blocked"}
                  >
                    <span className="text-[9px] text-[#8a7e78] px-1.5 py-0.5 block truncate font-medium">
                      {bt.reason || "Blocked"}
                    </span>
                  </div>
                );
              })}

              {/* Appointments */}
              {apptsByDay[dayIdx]!.map((appt) => {
                const startMin = getMinutesFromMidnight(appt.start_at);
                const endMin = getMinutesFromMidnight(appt.end_at);
                const top = ((startMin - HOUR_START * 60) / 60) * HOUR_HEIGHT;
                const height = ((endMin - startMin) / 60) * HOUR_HEIGHT;
                if (top + height < 0 || top > TOTAL_HOURS * HOUR_HEIGHT) return null;

                const borderClass = STATUS_BORDER[appt.status] ?? "border-l-gray-300";
                const bgClass = STATUS_BG[appt.status] ?? "bg-gray-50 hover:bg-gray-100";

                return (
                  <button
                    key={appt.id}
                    onClick={() => onAppointmentClick?.(appt.id)}
                    className={`absolute left-0.5 right-0.5 rounded-lg border-l-[3px] ${borderClass} ${bgClass} text-left overflow-hidden transition-colors cursor-pointer px-1.5 py-0.5`}
                    style={{
                      top: Math.max(0, top),
                      height: Math.max(20, height),
                    }}
                    title={`${clientName(appt)} — ${serviceNames(appt)}`}
                  >
                    <p className="text-[10px] font-bold text-[#1a1714] truncate leading-tight">
                      {clientName(appt)}
                    </p>
                    {height > 28 && (
                      <p className="text-[9px] text-[#8a7e78] truncate leading-tight">
                        {serviceNames(appt)}
                      </p>
                    )}
                    {height > 40 && (
                      <p className="text-[9px] text-[#8a7e78] leading-tight">
                        {formatTimeShort(appt.start_at)}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {/* Current time indicator */}
          {showNowLine && nowTop >= 0 && (
            <div
              className="absolute pointer-events-none z-10"
              style={{
                top: nowTop,
                left: 56, // past the gutter
                right: 0,
              }}
            >
              <div className="flex items-center">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 flex-shrink-0" />
                <div className="flex-1 h-[2px] bg-red-500" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
