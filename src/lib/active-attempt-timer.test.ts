import { describe, expect, it } from "vitest";
import { ActiveAttemptTimer } from "@/lib/active-attempt-timer";

describe("ActiveAttemptTimer", () => {
  it("counts only visible, focused time", () => {
    const timer = new ActiveAttemptTimer(0);
    timer.setAvailability(false, false, 1_000);
    timer.setAvailability(true, true, 6_000);

    expect(timer.pause(8_000)).toBe(3_000);
  });

  it("caps an inactive span at the idle threshold", () => {
    const timer = new ActiveAttemptTimer(0, true, true, 5_000);

    expect(timer.elapsed(9_000)).toBe(5_000);
    timer.recordActivity(10_000);
    expect(timer.pause(12_000)).toBe(7_000);
  });

  it("resets timing between answer attempts", () => {
    const timer = new ActiveAttemptTimer(0);
    expect(timer.pause(2_000)).toBe(2_000);

    timer.reset(2_000, false);
    timer.resume(3_000);
    expect(timer.pause(4_500)).toBe(1_500);
  });
});
