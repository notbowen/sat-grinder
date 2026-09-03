/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import {
  readCrossOutEnabled,
  readTimerVisible,
  saveCrossOutEnabled,
  saveTimerVisible,
} from "@/lib/practice-preferences";

afterEach(() => localStorage.clear());

describe("practice preferences", () => {
  describe("timer visibility", () => {
    it("defaults to false when nothing is stored", () => {
      expect(readTimerVisible()).toBe(false);
    });

    it("saves and reads true", () => {
      saveTimerVisible(true);
      expect(readTimerVisible()).toBe(true);
      expect(localStorage.getItem("sat-grinder:timer-visible")).toBe("true");
    });

    it("saves and reads false", () => {
      saveTimerVisible(true);
      saveTimerVisible(false);
      expect(readTimerVisible()).toBe(false);
      expect(localStorage.getItem("sat-grinder:timer-visible")).toBe("false");
    });

    it("handles legacy string boolean or malformed JSON", () => {
      localStorage.setItem("sat-grinder:timer-visible", "false");
      expect(readTimerVisible()).toBe(false);
      localStorage.setItem("sat-grinder:timer-visible", "true");
      expect(readTimerVisible()).toBe(true);
      localStorage.setItem("sat-grinder:timer-visible", "invalid-json");
      expect(readTimerVisible()).toBe(false);
    });
  });

  describe("cross-out enabled", () => {
    it("defaults to true when nothing is stored", () => {
      expect(readCrossOutEnabled()).toBe(true);
    });

    it("saves and reads false", () => {
      saveCrossOutEnabled(false);
      expect(readCrossOutEnabled()).toBe(false);
      expect(localStorage.getItem("sat-grinder:cross-out-enabled")).toBe("false");
      expect(localStorage.getItem("sat-grinder:eliminator-enabled")).toBe("false");
    });

    it("saves and reads true", () => {
      saveCrossOutEnabled(false);
      saveCrossOutEnabled(true);
      expect(readCrossOutEnabled()).toBe(true);
    });

    it("falls back to eliminator-enabled key if present", () => {
      localStorage.setItem("sat-grinder:eliminator-enabled", "false");
      expect(readCrossOutEnabled()).toBe(false);
    });
  });
});
