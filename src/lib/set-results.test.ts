/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { readSetResults, recordSetResult } from "@/lib/set-results";

afterEach(() => sessionStorage.clear());

describe("set results", () => {
  it("keeps a miss for the position even after the later correct answer", () => {
    expect(recordSetResult("s", 0, false)).toEqual({ 0: "miss" });
    expect(recordSetResult("s", 0, true)).toEqual({ 0: "miss" });
    expect(recordSetResult("s", 1, true)).toEqual({ 0: "miss", 1: "clean" });
    expect(readSetResults("s")).toEqual({ 0: "miss", 1: "clean" });
  });

  it("ignores stored values it does not understand", () => {
    sessionStorage.setItem("sat-grinder:set-results:s", JSON.stringify({ 0: "clean", x: "miss", 2: "maybe" }));
    expect(readSetResults("s")).toEqual({ 0: "clean" });
    sessionStorage.setItem("sat-grinder:set-results:t", "not json");
    expect(readSetResults("t")).toEqual({});
  });
});
