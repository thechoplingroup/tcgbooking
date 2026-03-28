/**
 * Pure utility functions for availability slot calculation.
 * Extracted from the availability API route for testability.
 */

/** Parse "HH:MM:SS" into total minutes from midnight. */
export function parseTime(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Check whether two time ranges overlap (exclusive of adjacent boundaries). */
export function overlaps(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export interface SlotCandidate {
  startMin: number;
  endMin: number;
}

export interface BusyRange {
  start: number;
  end: number;
}

/**
 * Generate candidate appointment slots between open and close times.
 * @param openMin  - opening time in minutes from midnight
 * @param closeMin - closing time in minutes from midnight
 * @param duration - appointment duration in minutes
 * @param slotInterval - interval between slot starts in minutes (default 30)
 */
export function generateSlots(
  openMin: number,
  closeMin: number,
  duration: number,
  slotInterval: number = 30
): SlotCandidate[] {
  const candidates: SlotCandidate[] = [];
  for (let start = openMin; start + duration <= closeMin; start += slotInterval) {
    candidates.push({ startMin: start, endMin: start + duration });
  }
  return candidates;
}

/**
 * Filter candidate slots by removing those that overlap with busy ranges
 * or that are in the past (when scheduling for today).
 * @param candidates   - candidate slots from generateSlots
 * @param busyRanges   - existing appointments / blocked times as minute ranges
 * @param isToday      - whether the date is today
 * @param nowMinutes   - current time in minutes from midnight (only used when isToday)
 */
export function filterAvailableSlots(
  candidates: SlotCandidate[],
  busyRanges: BusyRange[],
  isToday: boolean,
  nowMinutes: number
): SlotCandidate[] {
  return candidates.filter(({ startMin, endMin }) => {
    if (isToday && startMin <= nowMinutes) return false;
    return !busyRanges.some((r) => overlaps(startMin, endMin, r.start, r.end));
  });
}

/**
 * Format a slot (in minutes) into ISO 8601 UTC strings for a given date.
 * @param dateStr  - date in "YYYY-MM-DD" format
 * @param startMin - slot start in minutes from midnight
 * @param endMin   - slot end in minutes from midnight
 */
export function formatSlot(
  dateStr: string,
  startMin: number,
  endMin: number
): { start_at: string; end_at: string } {
  const sh = String(Math.floor(startMin / 60)).padStart(2, "0");
  const sm = String(startMin % 60).padStart(2, "0");
  const eh = String(Math.floor(endMin / 60)).padStart(2, "0");
  const em = String(endMin % 60).padStart(2, "0");
  return {
    start_at: `${dateStr}T${sh}:${sm}:00Z`,
    end_at: `${dateStr}T${eh}:${em}:00Z`,
  };
}
