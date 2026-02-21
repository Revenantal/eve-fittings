import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import generatedLibraries from "@/lib/attributions/libraries.generated.json";
import source from "@/lib/attributions/source.json";

import { buildAttributionsMarkdown, injectReadmeAttributionsBlock } from "../../scripts/attributions-utils.mjs";

describe("README attributions sync", () => {
  it("matches the generated attribution block", async () => {
    const readme = await readFile("README.md", "utf8");
    const markdown = buildAttributionsMarkdown({ source, generatedLibraries });
    const injected = injectReadmeAttributionsBlock(readme, markdown);

    expect(injected).toBe(readme);
  });
});
