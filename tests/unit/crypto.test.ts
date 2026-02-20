import { describe, expect, it } from "vitest";

import { decryptString, encryptString, randomId } from "@/server/security/crypto";

describe("crypto helpers", () => {
  it("encrypts and decrypts a round trip", () => {
    const plain = "refresh-token-value";
    const encrypted = encryptString(plain);
    const decrypted = decryptString(encrypted);

    expect(encrypted).not.toBe(plain);
    expect(decrypted).toBe(plain);
  });

  it("generates hex random ids", () => {
    const value = randomId(12);
    expect(value).toMatch(/^[a-f0-9]{24}$/);
  });
});