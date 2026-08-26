import { describe, expect, it } from "vitest";
import { gradeAnswer, validateNumericResponse } from "@/lib/grading";
import { mathResponseToLatex } from "@/lib/math-response";

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

  it("accepts a leading zero when the answer key omits it", () => {
    expect(gradeAnswer({ type: "spr", correctAnswers: [".33"] }, "0.33").correct).toBe(true);
    expect(gradeAnswer({ type: "spr", correctAnswers: ["-.33"] }, "-0.33").correct).toBe(true);
  });

  it("accepts responses up to 50 characters", () => {
    expect(validateNumericResponse("1/0").valid).toBe(false);
    expect(validateNumericResponse("1.2.3").valid).toBe(false);
    expect(validateNumericResponse("1".repeat(50)).valid).toBe(true);
    expect(validateNumericResponse("1".repeat(51)).valid).toBe(false);
  });

  it("accepts and grades LaTeX fractions", () => {
    expect(validateNumericResponse(String.raw`\frac{3}{4}`).valid).toBe(true);
    expect(gradeAnswer({ type: "spr", correctAnswers: ["0.75"] }, String.raw`\frac{3}{4}`).correct).toBe(true);
    expect(gradeAnswer({ type: "spr", correctAnswers: ["-2/3"] }, String.raw`-\frac{4}{6}`).correct).toBe(true);
  });

  it("renders a negative sign before the fraction", () => {
    expect(mathResponseToLatex("-1/2")).toBe(String.raw`-\frac{1}{2}`);
  });
});
