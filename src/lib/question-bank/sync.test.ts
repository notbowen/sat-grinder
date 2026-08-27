import { describe, expect, it } from "vitest";
import { runQuestionBankSync, sanitizeQuestionHtml } from "@/lib/question-bank/sync";

describe("sanitizeQuestionHtml", () => {
  it("preserves the safe inline SVG used by graph questions", () => {
    const html = `<p style="text-align: center"><figure class="image">
      <svg width="287pt" height="275pt" viewBox="0 0 287 275" role="img" aria-label="A graph">
        <defs>
          <path id="point" d="M 0 0 L 2 2" style="fill:none;stroke:#000000;stroke-width:1.5"></path>
          <marker id="arrow" markerHeight="3" markerWidth="3" orient="auto" viewBox="0 0 3 3"></marker>
          <clipPath id="plot"><rect x="0" y="0" width="287" height="275"></rect></clipPath>
        </defs>
        <g clip-path="url(#plot)" transform="translate(1 2)">
          <use xlink:href="#point" x="3" y="4"></use>
          <line x1="0" y1="0" x2="10" y2="10" marker-end="url(#arrow)"></line>
        </g>
      </svg>
    </figure></p>`;

    const clean = sanitizeQuestionHtml(html);

    expect(clean).toContain('<svg width="287pt" height="275pt" viewBox="0 0 287 275" role="img" aria-label="A graph">');
    expect(clean).toContain('<clipPath id="plot">');
    expect(clean).toContain('style="fill:none;stroke:#000000;stroke-width:1.5"');
    expect(clean).toContain('xlink:href="#point"');
    expect(clean).toContain('marker-end="url(#arrow)"');
  });

  it("removes active content and nonlocal SVG references", () => {
    const clean = sanitizeQuestionHtml(`<svg onload="alert(1)">
      <script>alert(1)</script>
      <use xlink:href="https://example.com/remote.svg#shape"></use>
      <path fill="url(https://example.com/remote.svg#paint)" clip-path="url(https://example.com/remote.svg#clip)" style="fill:#fff;background-image:url(javascript:alert(1))"></path>
    </svg>`);

    expect(clean).not.toContain("onload");
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("example.com");
    expect(clean).not.toContain("background-image");
    expect(clean).toContain('style="fill:#fff"');
  });

  it("preserves note-taking lists", () => {
    const clean = sanitizeQuestionHtml("<p>While researching, a student took these notes:</p><ul><li>First note</li><li>Second note</li></ul>");

    expect(clean).toContain("<ul><li>First note</li><li>Second note</li></ul>");
  });

  it("preserves both forms of underlined referenced content", () => {
    const clean = sanitizeQuestionHtml(`<p>
      <span style="text-decoration: underline;" role="region" aria-label="Referenced Content">Styled claim</span>
      <span role="region" aria-label="Referenced Content"><u>Element claim</u></span>
    </p>`);

    expect(clean).toContain('style="text-decoration:underline"');
    expect(clean).toContain('<u>Element claim</u>');
  });

  it("preserves semantic and safely styled bold text", () => {
    const clean = sanitizeQuestionHtml('<p>Plain <strong>strong</strong> <b>bold</b> <span style="font-weight: 700">styled</span></p>');

    expect(clean).toContain("<strong>strong</strong>");
    expect(clean).toContain("<b>bold</b>");
    expect(clean).toContain('style="font-weight:700"');
  });

  it("removes unsafe styles from underlined referenced content", () => {
    const clean = sanitizeQuestionHtml('<span style="text-decoration: underline; background-image: url(javascript:alert(1))">Claim</span>');

    expect(clean).toContain('style="text-decoration:underline"');
    expect(clean).not.toContain("background-image");
    expect(clean).not.toContain("javascript");
  });

  it("normalizes MathML absolute-value fences for consistent browser rendering", () => {
    const clean = sanitizeQuestionHtml('<math><mfenced open="|" close="|"><mi>x</mi></mfenced></math>');

    expect(clean).toContain('<mrow><mo fence="true" stretchy="true">|</mo><mi>x</mi><mo fence="true" stretchy="true">|</mo></mrow>');
    expect(clean).not.toContain("mfenced");
  });

  it("keeps explicit absolute-value operators", () => {
    const html = '<math><mrow><mo fence="true" stretchy="true">|</mo><mi>x</mi><mo fence="true" stretchy="true">|</mo></mrow></math>';

    expect(sanitizeQuestionHtml(html)).toContain('<mo fence="true" stretchy="true">|</mo><mi>x</mi><mo fence="true" stretchy="true">|</mo>');
  });

  it("preserves MathML angle notation", () => {
    const clean = sanitizeQuestionHtml('<math alttext="angle upper Q"><mo>∠</mo><mi>Q</mi></math>');

    expect(clean).toContain('<mo>∠</mo><mi>Q</mi>');
  });

  it("requires the explicit College Board authorization assertion", async () => {
    const previous = process.env.COLLEGE_BOARD_EQB_AUTHORIZED;
    delete process.env.COLLEGE_BOARD_EQB_AUTHORIZED;
    await expect(runQuestionBankSync("manual-cli")).rejects.toThrow("confirming written content authorization");
    if (previous === undefined) delete process.env.COLLEGE_BOARD_EQB_AUTHORIZED;
    else process.env.COLLEGE_BOARD_EQB_AUTHORIZED = previous;
  });
});
