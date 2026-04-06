import { describe, it, expect } from "vitest";
import {
  parseTime,
  overlaps,
  generateSlots,
  filterAvailableSlots,
  formatSlot,
} from "../availability";

// ─── 1. parseTime ────────────────────────────────────────────────────────────

describe("parseTime", () => {
  it("parses 10:00:00 to 600 minutes", () => {
    expect(parseTime("10:00:00")).toBe(600);
  });

  it("parses 14:30:00 to 870 minutes", () => {
    expect(parseTime("14:30:00")).toBe(870);
  });

  it("parses midnight 00:00:00 to 0", () => {
    expect(parseTime("00:00:00")).toBe(0);
  });

  it("parses 23:59:00 to 1439 minutes", () => {
    expect(parseTime("23:59:00")).toBe(1439);
  });
});

// ─── 2. overlaps ─────────────────────────────────────────────────────────────

describe("overlaps", () => {
  it("returns true when ranges overlap", () => {
    // 10:00-11:00 vs 10:30-11:30
    expect(overlaps(600, 660, 630, 690)).toBe(true);
  });

  it("returns true when one range contains the other", () => {
    // 9:00-17:00 vs 10:00-11:00
    expect(overlaps(540, 1020, 600, 660)).toBe(true);
  });

  it("returns false when ranges do not overlap", () => {
    // 10:00-11:00 vs 12:00-13:00
    expect(overlaps(600, 660, 720, 780)).toBe(false);
  });

  it("returns false when ranges are adjacent (end == start)", () => {
    // 10:00-11:00 vs 11:00-12:00
    expect(overlaps(600, 660, 660, 720)).toBe(false);
  });
});

// ─── 3. generateSlots ────────────────────────────────────────────────────────

describe("generateSlots", () => {
  it("generates correct slots for 10AM-6PM with 60min duration, 30min interval", () => {
    const openMin = 600; // 10:00
    const closeMin = 1080; // 18:00
    const duration = 60;
    const interval = 30;

    const slots = generateSlots(openMin, closeMin, duration, interval);

    // First slot: 10:00-11:00, last slot must end by 18:00
    // Starts: 600, 630, 660, ... up to start where start+60 <= 1080 => start <= 1020
    // (1020 - 600) / 30 + 1 = 15 slots
    expect(slots.length).toBe(15);
    expect(slots[0]).toEqual({ startMin: 600, endMin: 660 });
    expect(slots[slots.length - 1]).toEqual({ startMin: 1020, endMin: 1080 });
  });

  it("returns empty array when window is too short for any slot", () => {
    const openMin = 600; // 10:00
    const closeMin = 620; // 10:20
    const duration = 30;

    const slots = generateSlots(openMin, closeMin, duration);

    expect(slots).toEqual([]);
  });

  it("returns a single slot when duration exactly fills the window", () => {
    const openMin = 600; // 10:00
    const closeMin = 660; // 11:00
    const duration = 60;

    const slots = generateSlots(openMin, closeMin, duration);

    expect(slots.length).toBe(1);
    expect(slots[0]).toEqual({ startMin: 600, endMin: 660 });
  });
});

// ─── 4. filterAvailableSlots ─────────────────────────────────────────────────

describe("filterAvailableSlots", () => {
  it("removes slots that overlap with busy ranges", () => {
    const candidates = [
      { startMin: 600, endMin: 660 }, // 10:00-11:00
      { startMin: 630, endMin: 690 }, // 10:30-11:30
      { startMin: 660, endMin: 720 }, // 11:00-12:00
      { startMin: 690, endMin: 750 }, // 11:30-12:30
    ];
    // Busy: 10:15-11:15 (615-675)
    const busyRanges = [{ start: 615, end: 675 }];

    const available = filterAvailableSlots(candidates, busyRanges, false, -1);

    // Slot 10:00-11:00 overlaps (600 < 675 && 660 > 615) -> removed
    // Slot 10:30-11:30 overlaps (630 < 675 && 690 > 615) -> removed
    // Slot 11:00-12:00 overlaps (660 < 675 && 720 > 615) -> removed
    // Slot 11:30-12:30 does NOT overlap (690 < 675 is false) -> kept
    expect(available).toEqual([{ startMin: 690, endMin: 750 }]);
  });

  it("removes past slots when isToday is true", () => {
    const candidates = [
      { startMin: 540, endMin: 600 }, // 9:00-10:00
      { startMin: 570, endMin: 630 }, // 9:30-10:30
      { startMin: 600, endMin: 660 }, // 10:00-11:00
      { startMin: 630, endMin: 690 }, // 10:30-11:30
    ];
    const nowMinutes = 600; // current time is 10:00

    const available = filterAvailableSlots(candidates, [], true, nowMinutes);

    // Slots with startMin <= 600 are removed (540, 570, 600)
    // Only 630 (10:30) remains
    expect(available).toEqual([{ startMin: 630, endMin: 690 }]);
  });

  it("keeps all slots when not today", () => {
    const candidates = [
      { startMin: 540, endMin: 600 },
      { startMin: 600, endMin: 660 },
    ];

    const available = filterAvailableSlots(candidates, [], false, -1);

    expect(available).toEqual(candidates);
  });
});

// ─── 5. formatSlot ───────────────────────────────────────────────────────────

describe("formatSlot", () => {
  // The studio timezone is America/Chicago. formatSlot emits REAL UTC
  // instants, so March 15 2025 (CDT, UTC-5) at 10:00 Central → 15:00 UTC.
  it("converts studio wall clock to UTC during DST (CDT, UTC-5)", () => {
    const result = formatSlot("2025-03-15", 600, 660);

    expect(result).toEqual({
      start_at: "2025-03-15T15:00:00.000Z",
      end_at: "2025-03-15T16:00:00.000Z",
    });
  });

  it("converts studio wall clock to UTC during standard time (CST, UTC-6)", () => {
    // Jan 1 is CST: 01:05 Central → 07:05 UTC.
    const result = formatSlot("2025-01-01", 65, 125);

    expect(result).toEqual({
      start_at: "2025-01-01T07:05:00.000Z",
      end_at: "2025-01-01T08:05:00.000Z",
    });
  });
});

// ─── 6. Integration: full pipeline ──────────────────────────────────────────

describe("integration: slot generation + filtering", () => {
  it("produces correct available slots with multiple busy ranges", () => {
    const openMin = 540; // 9:00
    const closeMin = 720; // 12:00
    const duration = 60;
    const interval = 30;

    const candidates = generateSlots(openMin, closeMin, duration, interval);

    // Busy: 9:30-10:30 and 11:00-11:30
    const busyRanges = [
      { start: 570, end: 630 }, // 9:30-10:30
      { start: 660, end: 690 }, // 11:00-11:30
    ];

    const available = filterAvailableSlots(candidates, busyRanges, false, -1);

    // Candidates: 9:00-10:00, 9:30-10:30, 10:00-11:00, 10:30-11:30, 11:00-12:00
    // 9:00-10:00 overlaps 9:30-10:30 busy -> removed
    // 9:30-10:30 overlaps 9:30-10:30 busy -> removed
    // 10:00-11:00 overlaps 9:30-10:30 busy -> removed
    // 10:30-11:30 overlaps 11:00-11:30 busy -> removed
    // 11:00-12:00 overlaps 11:00-11:30 busy -> removed
    // All removed! Let's verify:
    // Actually let's recalculate:
    // 9:00-10:00 (540-600) vs busy 570-630: 540<630 && 600>570 -> overlap -> removed
    // 9:30-10:30 (570-630) vs busy 570-630: 570<630 && 630>570 -> overlap -> removed
    // 10:00-11:00 (600-660) vs busy 570-630: 600<630 && 660>570 -> overlap -> removed
    // 10:30-11:30 (630-690) vs busy 570-630: 630<630 false -> no overlap with first
    //   vs busy 660-690: 630<690 && 690>660 -> overlap -> removed
    // 11:00-12:00 (660-720) vs busy 660-690: 660<690 && 720>660 -> overlap -> removed
    expect(available).toEqual([]);

    // Now test with a smaller busy window to get some results
    const narrowBusy = [{ start: 570, end: 600 }]; // 9:30-10:00
    const available2 = filterAvailableSlots(candidates, narrowBusy, false, -1);

    // 9:00-10:00 (540-600) vs 570-600: 540<600 && 600>570 -> overlap -> removed
    // 9:30-10:30 (570-630) vs 570-600: 570<600 && 630>570 -> overlap -> removed
    // 10:00-11:00 (600-660) vs 570-600: 600<600 false -> no overlap -> kept
    // 10:30-11:30 (630-690) -> kept
    // 11:00-12:00 (660-720) -> kept
    expect(available2).toEqual([
      { startMin: 600, endMin: 660 },
      { startMin: 630, endMin: 690 },
      { startMin: 660, endMin: 720 },
    ]);

    // Format the results (June 15 2025 is CDT, UTC-5 → +5h).
    const formatted = available2.map((s) =>
      formatSlot("2025-06-15", s.startMin, s.endMin)
    );
    expect(formatted[0]).toEqual({
      start_at: "2025-06-15T15:00:00.000Z",
      end_at: "2025-06-15T16:00:00.000Z",
    });
  });
});

// ─── 7. Edge case: duration exactly fills remaining window ───────────────────

describe("edge case: duration exactly fills remaining window", () => {
  it("generates exactly one slot when duration equals window size", () => {
    const slots = generateSlots(600, 630, 30, 30);
    expect(slots).toEqual([{ startMin: 600, endMin: 630 }]);
  });

  it("the single slot survives filtering when no conflicts", () => {
    const slots = generateSlots(600, 630, 30, 30);
    const available = filterAvailableSlots(slots, [], false, -1);
    expect(available).toEqual([{ startMin: 600, endMin: 630 }]);
  });
});
