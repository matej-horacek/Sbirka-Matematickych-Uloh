import Sqids from 'sqids';

// Integer ids stay inside the backend; the API only ever sees Sqids strings.
// Sqids is obfuscation, not security: permission checks still happen in services.
// Set SQIDS_ALPHABET (a shuffled alphabet) in production so ids are not guessable from the default.
const sqids = new Sqids({
  minLength: 5,
  ...(process.env.SQIDS_ALPHABET && { alphabet: process.env.SQIDS_ALPHABET }),
});

export function encodeId(id: number): string {
  return sqids.encode([id]);
}

/** Returns null for anything that is not a canonical id (decode + re-encode must match). */
export function decodeId(value: string): number | null {
  const numbers = sqids.decode(value);
  if (numbers.length !== 1) return null;
  return sqids.encode(numbers) === value ? numbers[0] : null;
}

export function encodeNullableId(id: number | null): string | null {
  return id === null ? null : encodeId(id);
}
