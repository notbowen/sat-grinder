import { describe, expect, it } from "vitest";
import { replaceAnnotationRange, type TextAnnotation } from "@/components/highlightable-question-html";

describe("replaceAnnotationRange", () => {
  it("adds and merges adjacent highlights of the same color", () => {
    const first = replaceAnnotationRange([], 0, 5, "yellow", "first");
    const second = replaceAnnotationRange(first, 5, 10, "yellow", "second");

    expect(second).toEqual([{ id: "first", start: 0, end: 10, style: "yellow" }]);
  });

  it("recolors only the selected part of an existing highlight", () => {
    const current: TextAnnotation[] = [{ id: "yellow", start: 2, end: 12, style: "yellow" }];

    const updated = replaceAnnotationRange(current, 5, 9, "blue", "blue");

    expect(updated.map(({ start, end, style }) => ({ start, end, style }))).toEqual([
      { start: 2, end: 5, style: "yellow" },
      { start: 5, end: 9, style: "blue" },
      { start: 9, end: 12, style: "yellow" },
    ]);
  });

  it("removes only the selected part of a highlight", () => {
    const current: TextAnnotation[] = [{ id: "yellow", start: 2, end: 12, style: "yellow" }];

    const updated = replaceAnnotationRange(current, 5, 9);

    expect(updated.map(({ start, end, style }) => ({ start, end, style }))).toEqual([
      { start: 2, end: 5, style: "yellow" },
      { start: 9, end: 12, style: "yellow" },
    ]);
  });
});
