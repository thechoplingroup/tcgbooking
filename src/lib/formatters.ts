import { STUDIO } from "@/config/studio";

/**
 * Shared formatting utilities for appointment times and related values.
 *
 * Appointment `start_at` / `end_at` are `timestamptz` columns that store real
 * UTC instants. All display formatters below render in the studio timezone
 * (see `STUDIO.timezone`). Use these helpers — don't reach for
 * `timeZone: "UTC"` directly; that convention was retired.
 */

/** Format a UTC instant as studio-local "9:30 AM". */
export function formatTime(iso: string, options?: { timeZone?: string }): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: options?.timeZone ?? STUDIO.timezone,
  });
}

/**
 * Back-compat alias: `formatTimeUTC` used to read the "fake-UTC" wall clock.
 * Storage is now real UTC, so it behaves identically to `formatTime`. Prefer
 * `formatTime` in new code; this is kept only to avoid a disruptive rename.
 */
export const formatTimeUTC = formatTime;

/** Duration in minutes → "1h 30m". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Cents → "$150" (or "$150.00" when `decimals` is set). */
export function formatCents(cents: number, options?: { decimals?: boolean }): string {
  if (options?.decimals) {
    return `$${(cents / 100).toFixed(2)}`;
  }
  return `$${(cents / 100).toFixed(0)}`;
}

/** UTC instant → studio-local "Mon, Mar 15". */
export function formatDateShort(iso: string, options?: { timeZone?: string }): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: options?.timeZone ?? STUDIO.timezone,
  });
}

/** UTC instant → studio-local "Monday, March 15, 2026". */
export function formatDateLong(iso: string, options?: { timeZone?: string }): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: options?.timeZone ?? STUDIO.timezone,
  });
}

/** UTC instant → full studio-local datetime with tz name. */
export function formatDateTime(iso: string, options?: { timeZone?: string }): string {
  const tz = options?.timeZone ?? STUDIO.timezone;
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
    timeZoneName: "short",
  });
}
