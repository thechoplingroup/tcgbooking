/**
 * Time helpers for the studio timezone (see STUDIO.timezone — America/Chicago).
 *
 * Storage convention: `appointments.start_at`, `appointments.end_at`,
 * `blocked_times.start_at`, and `blocked_times.end_at` are `timestamptz`
 * columns that hold **real UTC instants**. The rest of the app displays and
 * constructs times in the studio's local timezone via the helpers below.
 *
 * Never reach for `getUTCHours`, `timeZone: "UTC"`, or
 * `` `${date}T${time}:00Z` `` anywhere that touches appointment data — the
 * right answer is always one of the helpers in this file.
 */
import { STUDIO } from "@/config/studio";

const TZ = STUDIO.timezone;

/**
 * Returns the offset of the studio timezone relative to UTC at the given
 * instant, in milliseconds. Negative for timezones west of UTC.
 * DST-aware: evaluates the offset at the specific instant.
 */
function studioOffsetMs(instant: Date): number {
  // Trick: format the instant twice — once pretending it's in the studio tz,
  // once pretending it's UTC — and parse both back as naive local strings.
  // The delta is the offset. Works across DST transitions because the tz
  // formatter uses the actual offset at `instant`.
  const tzWall = new Date(instant.toLocaleString("en-US", { timeZone: TZ }));
  const utcWall = new Date(instant.toLocaleString("en-US", { timeZone: "UTC" }));
  return tzWall.getTime() - utcWall.getTime();
}

/**
 * Convert a wall-clock time in the studio timezone to a real UTC ISO string.
 *
 * @param dateStr "YYYY-MM-DD" (studio-local calendar date)
 * @param hour    0–23 studio-local hour
 * @param minute  0–59 studio-local minute
 */
export function studioWallClockToUtcIso(
  dateStr: string,
  hour: number,
  minute: number,
): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  // First guess: pretend the wall clock IS UTC.
  const guess = new Date(Date.UTC(y!, m! - 1, d!, hour, minute, 0));
  // Then back it off by the studio's offset at that instant.
  const offset = studioOffsetMs(guess);
  return new Date(guess.getTime() - offset).toISOString();
}

/**
 * Given a UTC ISO string, return the studio-local (hour, minute) pair.
 * Useful when placing appointments on a studio-local grid.
 */
export function studioHourMinute(iso: string | Date): {
  hour: number;
  minute: number;
} {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hStr = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mStr = parts.find((p) => p.type === "minute")?.value ?? "00";
  // Safari/Node can return "24" for midnight — normalise.
  return { hour: parseInt(hStr, 10) % 24, minute: parseInt(mStr, 10) };
}

/** Minutes since studio-local midnight for a UTC instant. */
export function studioMinutesFromMidnight(iso: string | Date): number {
  const { hour, minute } = studioHourMinute(iso);
  return hour * 60 + minute;
}

/** Studio-local "YYYY-MM-DD" for a UTC instant. */
export function studioDateString(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${day}`;
}

/** Today's studio-local date string, suitable for date-picker defaults. */
export function studioTodayString(): string {
  return studioDateString(new Date());
}

/** Studio-local day-of-week (0 = Sunday) for a UTC instant. */
export function studioDayOfWeek(iso: string | Date): number {
  const dateStr = studioDateString(iso);
  const [y, m, d] = dateStr.split("-").map(Number);
  // Treat the studio date as a naive UTC date — only the weekday is used.
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

/** ISO for studio-local midnight of the given YYYY-MM-DD. */
export function studioDayStartUtcIso(dateStr: string): string {
  return studioWallClockToUtcIso(dateStr, 0, 0);
}

/** ISO for the instant just before studio-local midnight the next day. */
export function studioDayEndUtcIso(dateStr: string): string {
  // Add one day in the studio calendar, then take that day's start.
  const [y, m, d] = dateStr.split("-").map(Number);
  const next = new Date(Date.UTC(y!, m! - 1, d! + 1));
  const nextStr = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
  return studioDayStartUtcIso(nextStr);
}

/** Format a UTC instant as studio-local "h:mm AM/PM". */
export function formatStudioTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: TZ,
  });
}

/** Format a UTC instant as studio-local "Mon, Mar 15". */
export function formatStudioDateShort(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: TZ,
  });
}

/** Format a UTC instant as studio-local "Monday, March 15, 2026". */
export function formatStudioDateLong(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: TZ,
  });
}

/**
 * Format a UTC instant as a full studio-local datetime with tz name,
 * e.g. "Monday, March 15, 2026, 10:00 AM CDT".
 */
export function formatStudioDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
    timeZoneName: "short",
  });
}

/**
 * Parse a `<input type="datetime-local">` value ("YYYY-MM-DDTHH:MM" or
 * "YYYY-MM-DDTHH:MM:SS") as studio-local wall clock and return the real UTC
 * ISO instant it represents. Tolerates a trailing "Z" or ":SS" gracefully.
 */
export function studioDateTimeLocalToUtcIso(value: string): string {
  const trimmed = value.replace(/Z$/, "");
  const [datePart, timePart = "00:00"] = trimmed.split("T");
  if (!datePart) throw new Error(`Invalid datetime-local value: ${value}`);
  const [hStr = "0", mStr = "0"] = timePart.split(":");
  const hour = parseInt(hStr, 10);
  const minute = parseInt(mStr, 10);
  return studioWallClockToUtcIso(datePart, hour, minute);
}

/**
 * Format a UTC instant as the value expected by `<input type="datetime-local">`
 * ("YYYY-MM-DDTHH:MM") in studio-local time.
 */
export function formatStudioDateTimeLocal(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hh = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hh}:${get("minute")}`;
}
