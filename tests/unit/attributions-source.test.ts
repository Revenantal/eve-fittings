import { describe, expect, it } from "vitest";
import sourceData from "@/lib/attributions/source.json";

describe("attributions source", () => {
  it("defines required non-empty fields for services and resources", () => {
    for (const service of sourceData.services) {
      expect(service.name.trim().length).toBeGreaterThan(0);
      expect(service.purpose.trim().length).toBeGreaterThan(0);
      expect(service.url.startsWith("https://")).toBe(true);
      expect(service.termsUrl.startsWith("https://")).toBe(true);
    }

    for (const resource of sourceData.resources) {
      expect(resource.name.trim().length).toBeGreaterThan(0);
      expect(resource.purpose.trim().length).toBeGreaterThan(0);
      expect(resource.url.startsWith("https://")).toBe(true);
    }
  });
});
