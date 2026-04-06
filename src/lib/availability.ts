/**
 * Pure utility functions for availability slot calculation.
 * Extracted from the availability API route for testability.
 *
 * All `startMin`/`endMin` values in this file are minutes from studio-local
 * midnight. `formatSlot` converts them to real UTC ISO instants using the
 * studio's DST-aware timezone.
 */
import { studioWallClockToUtcIso } from "@/lib/time";

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
 * Format a slot (in minutes from studio-local midnight) into real UTC ISO
 * instants for the given studio-local calendar date.
 *
 * @param dateStr  - studio-local date in "YYYY-MM-DD" format
 * @param startMin - slot start in minutes from studio-local midnight
 * @param endMin   - slot end in minutes from studio-local midnight
 */
export function formatSlot(
  dateStr: string,
  startMin: number,
  endMin: number
): { start_at: string; end_at: string } {
  const sh = Math.floor(startMin / 60);
  const sm = startMin % 60;
  const eh = Math.floor(endMin / 60);
  const em = endMin % 60;
  return {
    start_at: studioWallClockToUtcIso(dateStr, sh, sm),
    end_at: studioWallClockToUtcIso(dateStr, eh, em),
  };
}
