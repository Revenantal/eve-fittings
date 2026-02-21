import librariesData from "@/lib/attributions/libraries.generated.json";
import sourceData from "@/lib/attributions/source.json";
import type {
  AttributionLibraryEntry,
  AttributionResourceEntry,
  AttributionServiceEntry,
  AttributionsDocument
} from "@/lib/attributions/types";

type SourceDataShape = {
  services: AttributionServiceEntry[];
  resources: AttributionResourceEntry[];
};

type LibraryDataShape = {
  generatedAt: string;
  libraries: AttributionLibraryEntry[];
};

const source = sourceData as SourceDataShape;
const generatedLibraries = librariesData as LibraryDataShape;

export const attributionsDocument: AttributionsDocument = {
  services: source.services,
  resources: source.resources,
  libraries: generatedLibraries.libraries,
  generatedAt: generatedLibraries.generatedAt
};
