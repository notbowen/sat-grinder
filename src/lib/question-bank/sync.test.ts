import { describe, expect, it } from "vitest";
import { sanitizeQuestionHtml } from "@/lib/question-bank/sync";

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
});
