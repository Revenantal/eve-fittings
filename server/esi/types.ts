export type EsiFitting = {
  description: string;
  fitting_id: number;
  items: Array<{
    flag: number | string;
    quantity: number;
    type_id: number;
  }>;
  name: string;
  ship_type_id: number;
};

export type EsiCharacterPublicInfo = {
  alliance_id?: number;
  corporation_id: number;
  name: string;
};

export type EsiCorporationPublicInfo = {
  name: string;
};

export type EsiAlliancePublicInfo = {
  name: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
};

export type VerifyResponse = {
  CharacterID: number;
  CharacterName: string;
  ExpiresOn: string;
  Scopes: string;
  TokenType: string;
  CharacterOwnerHash: string;
  IntellectualProperty: string;
};

export type EsiRateInfo = {
  group: string | null;
  limit: string | null;
  remaining: string | null;
  used: string | null;
};
