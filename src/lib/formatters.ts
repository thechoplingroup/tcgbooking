/**
 * Shared formatting utilities
 */

/**
 * Format ISO date to time string (e.g., "9:30 AM")
 */
export function formatTime(iso: string, options?: { timeZone?: string }): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: options?.timeZone ?? "America/Chicago",
  });
}

/**
 * Format ISO date to time string using UTC timezone
 */
export function formatTimeUTC(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

/**
 * Format duration in minutes to human-readable string (e.g., "1h 30m")
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Format cents to display string (e.g., "$150")
 */
export function formatCents(cents: number, options?: { decimals?: boolean }): string {
  if (options?.decimals) {
    return `$${(cents / 100).toFixed(2)}`;
  }
  return `$${(cents / 100).toFixed(0)}`;
}

/**
 * Format ISO date to short date string (e.g., "Mon, Mar 15")
 */
export function formatDateShort(iso: string, options?: { timeZone?: string }): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: options?.timeZone ?? "UTC",
  });
}

/**
 * Format ISO date to long date string (e.g., "Monday, March 15, 2026")
 */
export function formatDateLong(iso: string, options?: { timeZone?: string }): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: options?.timeZone ?? "UTC",
  });
}

/**
 * Format ISO date to full datetime string with timezone
 */
export function formatDateTime(iso: string, options?: { timeZone?: string }): string {
  const tz = options?.timeZone ?? "America/Chicago";
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  }) + " CDT";
}
