// @vitest-environment happy-dom
/**
 * Security regression tests for diagram SVG sanitization.
 *
 * These tests verify that DOMPurify correctly strips XSS payloads from
 * diagram SVGs before they are injected into the DOM via innerHTML.
 * This covers the vulnerability where untrusted diagram sources (mermaid,
 * vega, graphviz, Kroki) could inject script tags or event handlers.
 */
import { describe, it, expect } from "vitest";
import DOMPurify from "dompurify";

// Replicate the sanitization config used in diagramNodeView.ts
const sanitizeConfig = {
  ALLOWED_TAGS: [
    "svg",
    "g",
    "path",
    "rect",
    "circle",
    "ellipse",
    "line",
    "polyline",
    "polygon",
    "text",
    "tspan",
    "tref",
    "defs",
    "pattern",
    "linearGradient",
    "radialGradient",
    "stop",
    "mask",
    "clipPath",
    "marker",
    "use",
    "filter",
    "feGaussianBlur",
    "feOffset",
    "feMerge",
    "feMergeNode",
    "feFlood",
    "feComposite",
    "image",
  ],
  ALLOWED_ATTR: [
    "d",
    "x",
    "y",
    "x1",
    "y1",
    "x2",
    "y2",
    "cx",
    "cy",
    "r",
    "rx",
    "ry",
    "width",
    "height",
    "viewBox",
    "preserveAspectRatio",
    "transform",
    "fill",
    "stroke",
    "stroke-width",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-dasharray",
    "stroke-dashoffset",
    "fill-opacity",
    "opacity",
    "font-family",
    "font-size",
    "font-weight",
    "text-anchor",
    "class",
    "id",
    "style",
    "href",
    "xlink:href",
    "xmlns",
    "xmlns:xlink",
    "data-*",
    "marker-end",
    "marker-start",
    "marker-mid",
  ],
  ADD_ATTR: ["data-*"],
  FORBID_ATTR: ["onload", "onerror", "onclick", "onmouseover", "onfocus", "onanimationstart"],
};

describe("Diagram SVG sanitization (DOMPurify)", () => {
  it("strips <script> tags from SVG", () => {
    const malicious = `<svg><script>alert('xss')</script><rect/></svg>`;
    const clean = DOMPurify.sanitize(malicious, sanitizeConfig);
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("alert");
  });

  it("strips onload event handlers from SVG elements", () => {
    const malicious = `<svg><rect onload="alert('xss')"/></svg>`;
    const clean = DOMPurify.sanitize(malicious, sanitizeConfig);
    expect(clean).not.toContain("onload");
    expect(clean).not.toContain("alert");
  });

  it("strips onerror event handlers from SVG elements", () => {
    const malicious = `<svg><image href="x" onerror="alert('xss')"/></svg>`;
    const clean = DOMPurify.sanitize(malicious, sanitizeConfig);
    expect(clean).not.toContain("onerror");
    expect(clean).not.toContain("alert");
  });

  it("strips onclick handlers from SVG elements", () => {
    const malicious = `<svg><rect onclick="alert('xss')"/></svg>`;
    const clean = DOMPurify.sanitize(malicious, sanitizeConfig);
    expect(clean).not.toContain("onclick");
  });

  it("preserves legitimate SVG content", () => {
    const legit = `<svg viewBox="0 0 100 100"><rect width="50" height="50" fill="blue"/></svg>`;
    const clean = DOMPurify.sanitize(legit, sanitizeConfig);
    expect(clean).toContain("<svg");
    expect(clean).toContain("<rect");
    expect(clean).toContain("viewBox");
    expect(clean).toContain("fill");
  });

  it("strips foreignObject (prevents HTML injection inside SVG)", () => {
    const malicious = `<svg><foreignObject><script>alert(1)</script></foreignObject></svg>`;
    const clean = DOMPurify.sanitize(malicious, sanitizeConfig);
    expect(clean).not.toContain("foreignObject");
    expect(clean).not.toContain("<script");
  });

  it("strips javascript: URLs in href attributes", () => {
    const malicious = `<svg><a href="javascript:alert(1)"><text>click</text></a></svg>`;
    const clean = DOMPurify.sanitize(malicious, sanitizeConfig);
    expect(clean).not.toContain("javascript:");
  });

  it("preserves data-* attributes (used by mermaid/vega)", () => {
    const svg = `<svg><rect data-testid="my-rect"/></svg>`;
    const clean = DOMPurify.sanitize(svg, sanitizeConfig);
    expect(clean).toContain("data-testid");
  });
});
