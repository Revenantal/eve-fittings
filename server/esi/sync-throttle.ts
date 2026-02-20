import "server-only";

const lastSyncByCharacter = new Map<number, number>();

export function consumeSyncSlot(characterId: number, minIntervalMs: number): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const previous = lastSyncByCharacter.get(characterId);
  if (previous) {
    const elapsed = now - previous;
    if (elapsed < minIntervalMs) {
      const retryAfterSeconds = Math.ceil((minIntervalMs - elapsed) / 1000);
      return { allowed: false, retryAfterSeconds };
    }
  }

  lastSyncByCharacter.set(characterId, now);
  return { allowed: true, retryAfterSeconds: 0 };
}

export function clearSyncSlot(characterId: number): void {
  lastSyncByCharacter.delete(characterId);
}