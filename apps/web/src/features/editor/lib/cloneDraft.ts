/**
 * Deep copy of editor data (drafts, blocks, tags, chapters).
 *
 * `structuredClone` throws a DataCloneError when a Vue reactive proxy is
 * anywhere inside the value, and `toRaw()` only unwraps the top level. A draft
 * is plain JSON (strings, numbers, null, arrays, objects), so a JSON round trip
 * copies it safely, proxies included.
 */
export function cloneDraft<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
