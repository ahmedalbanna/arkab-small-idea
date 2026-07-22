// @vitest-environment node
import { describe, it, expect } from "vitest";
import { validateUrl } from "../lib/utils";

describe("validateUrl", () => {
  it("accepts http URLs", () => {
    expect(validateUrl("http://example.com")).toBe(true);
  });

  it("accepts https URLs", () => {
    expect(validateUrl("https://example.com/path")).toBe(true);
  });

  it("accepts mailto links", () => {
    expect(validateUrl("mailto:user@example.com")).toBe(true);
  });

  it("accepts relative URLs", () => {
    expect(validateUrl("/path/to/page")).toBe(true);
    expect(validateUrl("page.html")).toBe(true);
    expect(validateUrl("../images/photo.png")).toBe(true);
  });

  it("rejects javascript: URLs", () => {
    expect(validateUrl("javascript:alert(1)")).toBe(false);
  });

  it("rejects data: URLs", () => {
    expect(validateUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("rejects vbscript: URLs", () => {
    expect(validateUrl("vbscript:msgbox(1)")).toBe(false);
  });

  it("rejects empty strings", () => {
    expect(validateUrl("")).toBe(false);
    expect(validateUrl("   ")).toBe(false);
  });
});
