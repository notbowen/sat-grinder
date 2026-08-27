import { describe, expect, it } from "vitest";
import { normalizeQuestionHtml } from "./question-html";

const absoluteValue = '<mrow><mo fence="true" stretchy="true">|</mo><mi>x</mi><mo fence="true" stretchy="true">|</mo></mrow>';

describe("normalizeQuestionHtml", () => {
  it("replaces absolute-value mfenced elements with explicit vertical-bar operators", () => {
    expect(normalizeQuestionHtml('<math><mfenced open="|" close="|"><mi>x</mi></mfenced></math>')).toBe(
      `<math>${absoluteValue}</math>`,
    );
  });

  it("recognizes encoded vertical-bar attributes", () => {
    expect(normalizeQuestionHtml('<mfenced open="&#124;" close="&#x7C;"><mi>x</mi></mfenced>')).toBe(absoluteValue);
    expect(normalizeQuestionHtml('<mfenced open="&vert;" close="&VerticalLine;"><mi>x</mi></mfenced>')).toBe(absoluteValue);
  });

  it("leaves other mfenced delimiters unchanged", () => {
    const html = '<math><mfenced open="[" close="]"><mi>x</mi></mfenced></math>';
    expect(normalizeQuestionHtml(html)).toBe(html);
  });

  it("tracks nested mfenced elements independently", () => {
    const html = '<mfenced open="|" close="|"><mfenced open="(" close=")"><mi>x</mi></mfenced></mfenced>';
    expect(normalizeQuestionHtml(html)).toBe(
      '<mrow><mo fence="true" stretchy="true">|</mo><mfenced open="(" close=")"><mi>x</mi></mfenced><mo fence="true" stretchy="true">|</mo></mrow>',
    );
  });

  it("is idempotent for already-normalized absolute values", () => {
    const html = `<math>${absoluteValue}</math>`;
    expect(normalizeQuestionHtml(html)).toBe(html);
  });
});
