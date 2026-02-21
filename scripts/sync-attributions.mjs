import { writeFile } from "node:fs/promises";
import process from "node:process";

import {
  buildAttributionsMarkdown,
  collectDirectLibraries,
  injectReadmeAttributionsBlock,
  loadJson
} from "./attributions-utils.mjs";

const GENERATED_LIBRARIES_PATH = "lib/attributions/libraries.generated.json";
const SOURCE_PATH = "lib/attributions/source.json";
const README_PATH = "README.md";

async function readText(path) {
  const file = await import("node:fs/promises");
  return file.readFile(path, "utf8");
}

async function main() {
  const checkMode = process.argv.includes("--check");
  const source = await loadJson(SOURCE_PATH);
  const libraries = await collectDirectLibraries();

  if (checkMode) {
    const existingGeneratedLibraries = await loadJson(GENERATED_LIBRARIES_PATH);
    const existingLibrariesJson = `${JSON.stringify(existingGeneratedLibraries, null, 2)}\n`;
    const expectedGeneratedLibraries = {
      generatedAt: String(existingGeneratedLibraries.generatedAt ?? ""),
      libraries
    };
    const expectedLibrariesJson = `${JSON.stringify(expectedGeneratedLibraries, null, 2)}\n`;
    const readmeBefore = await readText(README_PATH);
    const markdownSection = buildAttributionsMarkdown({ source, generatedLibraries: expectedGeneratedLibraries });
    const readmeAfter = injectReadmeAttributionsBlock(readmeBefore, markdownSection);
    const stale = existingLibrariesJson !== expectedLibrariesJson || readmeAfter !== readmeBefore;
    if (stale) {
      process.stderr.write(
        "Attribution files are out of date. Run `npm run attributions:sync`.\n"
      );
      process.exit(1);
    }
    process.stdout.write("Attribution files are up to date.\n");
    return;
  }

  const generatedAt = new Date().toISOString();
  const generatedLibraries = {
    generatedAt,
    libraries
  };
  const generatedLibrariesJson = `${JSON.stringify(generatedLibraries, null, 2)}\n`;
  const readmeBefore = await readText(README_PATH);
  const markdownSection = buildAttributionsMarkdown({ source, generatedLibraries });
  const readmeAfter = injectReadmeAttributionsBlock(readmeBefore, markdownSection);

  await writeFile(GENERATED_LIBRARIES_PATH, generatedLibrariesJson, "utf8");
  await writeFile(README_PATH, readmeAfter, "utf8");
  process.stdout.write("Updated attribution files.\n");
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
