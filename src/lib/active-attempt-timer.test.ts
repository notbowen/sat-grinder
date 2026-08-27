import { describe, expect, it } from "vitest";
import { ActiveAttemptTimer, MAX_RECORDED_ATTEMPT_MS } from "@/lib/active-attempt-timer";

describe("ActiveAttemptTimer", () => {
  it("counts wall-clock time from start until pause", () => {
    const timer = new ActiveAttemptTimer(0);

    expect(timer.pause(8_000)).toBe(8_000);
  });

  it("keeps counting through long inactive spans", () => {
    const timer = new ActiveAttemptTimer(0);

    expect(timer.elapsed(10 * 60 * 1000)).toBe(10 * 60 * 1000);
    expect(timer.pause(12 * 60 * 1000)).toBe(12 * 60 * 1000);
  });

  it("resets timing between answer attempts", () => {
    const timer = new ActiveAttemptTimer(0);
    expect(timer.pause(2_000)).toBe(2_000);

    timer.reset(2_000, false);
    timer.resume(3_000);
    expect(timer.pause(4_500)).toBe(1_500);
  });

  it("caps recorded time at one hour", () => {
    const timer = new ActiveAttemptTimer(0);

    expect(timer.pause(MAX_RECORDED_ATTEMPT_MS + 5_000)).toBe(MAX_RECORDED_ATTEMPT_MS);
  });
});
