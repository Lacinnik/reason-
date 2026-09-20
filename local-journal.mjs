// A failed/corrupt journal must never be silently replaced.
export function readJournal(storage, key) {
  try {
    const raw = storage.getItem(key);
    const entries = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(entries)) return { ok: false, reason: "INVALID_JOURNAL" };
    return { ok: true, entries };
  } catch { return { ok: false, reason: "STORAGE_UNAVAILABLE_OR_CORRUPT" }; }
}
export function persistJournal(storage, key, entry) {
  const previous = readJournal(storage, key);
  if (!previous.ok) return previous;
  return persistValue(storage, key, [entry, ...previous.entries].slice(0, 100));
}
export function persistValue(storage, key, value) {
  try {
    const encoded = JSON.stringify(value);
    storage.setItem(key, encoded);
    return storage.getItem(key) === encoded ? { ok: true } : { ok: false, reason: "WRITE_NOT_VERIFIED" };
  } catch { return { ok: false, reason: "STORAGE_UNAVAILABLE" }; }
}
export function downloadJson(filename, value) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url; link.download = filename; link.hidden = true;
  document.body.append(link); link.click();
  setTimeout(() => { link.remove(); URL.revokeObjectURL(url); }, 1000);
}
