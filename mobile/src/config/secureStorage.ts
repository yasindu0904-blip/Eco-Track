import * as SecureStore from "expo-secure-store";

const chunkLength = 1_800;

function chunkKey(key: string, index: number): string {
  return `${key}.chunk.${index}`;
}

function metadataKey(key: string): string {
  return `${key}.chunks`;
}

async function readChunkCount(key: string): Promise<number> {
  const storedCount = await SecureStore.getItemAsync(metadataKey(key));
  const count = Number(storedCount);

  return Number.isInteger(count) && count > 0 ? count : 0;
}

async function removeStoredChunks(key: string): Promise<void> {
  const count = await readChunkCount(key);

  await Promise.all(
    Array.from({ length: count }, (_, index) =>
      SecureStore.deleteItemAsync(chunkKey(key, index)),
    ),
  );

  await SecureStore.deleteItemAsync(metadataKey(key));
  await SecureStore.deleteItemAsync(key);
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const count = await readChunkCount(key);

    if (count === 0) {
      return SecureStore.getItemAsync(key);
    }

    const chunks = await Promise.all(
      Array.from({ length: count }, (_, index) =>
        SecureStore.getItemAsync(chunkKey(key, index)),
      ),
    );

    if (chunks.some((chunk) => chunk === null)) {
      await removeStoredChunks(key);
      return null;
    }

    return chunks.join("");
  },

  async setItem(key: string, value: string): Promise<void> {
    await removeStoredChunks(key);

    const chunks = Array.from(
      { length: Math.ceil(value.length / chunkLength) },
      (_, index) => value.slice(index * chunkLength, (index + 1) * chunkLength),
    );

    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(chunkKey(key, index), chunk),
      ),
    );
    await SecureStore.setItemAsync(metadataKey(key), String(chunks.length));
  },

  async removeItem(key: string): Promise<void> {
    await removeStoredChunks(key);
  },
};
