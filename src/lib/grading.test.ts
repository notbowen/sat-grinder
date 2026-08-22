import { describe, expect, it } from "vitest";
import { gradeAnswer, validateNumericResponse } from "@/lib/grading";

describe("gradeAnswer", () => {
  it("grades multiple-choice answers case-insensitively", () => {
    expect(gradeAnswer({ type: "mcq", correctAnswers: ["B"] }, "b")).toEqual({ correct: true, valid: true });
    expect(gradeAnswer({ type: "mcq", correctAnswers: ["B"] }, "A")).toEqual({ correct: false, valid: true });
  });

  it("treats equivalent fractions and decimals as the same numeric answer", () => {
    expect(gradeAnswer({ type: "spr", correctAnswers: ["0.5"] }, "1/2").correct).toBe(true);
    expect(gradeAnswer({ type: "spr", correctAnswers: ["-2/3"] }, "-4/6").correct).toBe(true);
    expect(gradeAnswer({ type: "spr", correctAnswers: ["3"] }, "3.0").correct).toBe(true);
  });

  it("enforces digital SAT response shape and length", () => {
    expect(validateNumericResponse("1/0").valid).toBe(false);
    expect(validateNumericResponse("1.2.3").valid).toBe(false);
    expect(validateNumericResponse("123456").valid).toBe(false);
    expect(validateNumericResponse("-12345").valid).toBe(true);
  });
});
