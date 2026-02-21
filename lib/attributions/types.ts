export type AttributionServiceEntry = {
  name: string;
  purpose: string;
  url: string;
  termsUrl: string;
  requiredNotice?: string;
  notes?: string;
};

export type AttributionLibraryEntry = {
  name: string;
  version: string;
  license: string;
  url: string;
};

export type AttributionResourceEntry = {
  name: string;
  purpose: string;
  url: string;
  notes?: string;
};

export type AttributionsDocument = {
  services: AttributionServiceEntry[];
  libraries: AttributionLibraryEntry[];
  resources: AttributionResourceEntry[];
  generatedAt: string;
};
