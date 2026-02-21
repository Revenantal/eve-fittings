import { describe, expect, it } from "vitest";

import { sanitizeBasicHtml } from "@/lib/html/sanitize";

describe("sanitizeBasicHtml", () => {
  it("keeps basic formatting tags", () => {
    const input = "<p><strong>Hello</strong> <em>capsuleer</em></p><ul><li>One</li></ul>";
    const output = sanitizeBasicHtml(input);

    expect(output).toContain("<p><strong>Hello</strong> <em>capsuleer</em></p>");
    expect(output).toContain("<ul><li>One</li></ul>");
  });

  it("strips scripts, event handlers, and javascript links", () => {
    const input = `<p onclick="alert(1)">ok</p><script>alert(2)</script><a href="javascript:alert(3)" title="x">link</a>`;
    const output = sanitizeBasicHtml(input);

    expect(output).toContain("<p>ok</p>");
    expect(output).not.toContain("onclick");
    expect(output).not.toContain("<script>");
    expect(output).not.toContain("javascript:");
  });
});
