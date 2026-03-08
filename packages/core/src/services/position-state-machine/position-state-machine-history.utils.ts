export function appendHistoryEntry<TEntry>(
  historyMap: Map<string, TEntry[]>,
  key: string,
  entry: TEntry,
): void {
  if (!historyMap.has(key)) {
    historyMap.set(key, []);
  }

  historyMap.get(key)!.push(entry);
}
