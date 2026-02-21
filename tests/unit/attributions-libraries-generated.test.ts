import { describe, expect, it } from "vitest";
import packageJson from "@/package.json";
import generatedLibraries from "@/lib/attributions/libraries.generated.json";

describe("generated attributions libraries", () => {
  it("contains exactly all direct dependencies and devDependencies", () => {
    const expectedNames = new Set([
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.devDependencies ?? {})
    ]);
    const actualNames = new Set(generatedLibraries.libraries.map((library) => library.name));

    expect(actualNames).toEqual(expectedNames);
  });
});
