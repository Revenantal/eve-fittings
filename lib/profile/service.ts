import "server-only";

import {
  getAlliancePublicInfo,
  getCharacterPublicInfo,
  getCorporationPublicInfo
} from "@/server/esi/client";

export type PlayerProfile = {
  characterId: number;
  characterName: string;
  corporationName: string;
  allianceName: string | null;
  portraitUrl: string;
};

function portraitUrl(characterId: number): string {
  return `https://images.evetech.net/characters/${characterId}/portrait?size=128`;
}

export async function loadPlayerProfile(characterId: number, accessToken: string): Promise<PlayerProfile> {
  const character = await getCharacterPublicInfo(characterId, accessToken);

  let corporationName = `Corporation ${character.corporation_id}`;
  try {
    const corporation = await getCorporationPublicInfo(character.corporation_id, accessToken);
    corporationName = corporation.name;
  } catch {
    // Fall back to ID-derived label when name lookup fails.
  }

  let allianceName: string | null = null;
  if (typeof character.alliance_id === "number") {
    allianceName = `Alliance ${character.alliance_id}`;
    try {
      const alliance = await getAlliancePublicInfo(character.alliance_id, accessToken);
      allianceName = alliance.name;
    } catch {
      // Fall back to ID-derived label when name lookup fails.
    }
  }

  return {
    characterId,
    characterName: character.name,
    corporationName,
    allianceName,
    portraitUrl: portraitUrl(characterId)
  };
}
