import "server-only";

const characterLockMap = new Map<number, Promise<void>>();

export async function withCharacterLock<T>(characterId: number, fn: () => Promise<T>): Promise<T> {
  const pending = characterLockMap.get(characterId) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });

  characterLockMap.set(characterId, pending.then(() => next));

  await pending;
  try {
    return await fn();
  } finally {
    release();
    if (characterLockMap.get(characterId) === next) {
      characterLockMap.delete(characterId);
    }
  }
}