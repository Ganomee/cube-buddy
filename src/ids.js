export function newId() {
  return globalThis.crypto.randomUUID();
}
