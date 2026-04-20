export function buildLookupNameMap<T extends { id: string; name: string }>(items: T[]): Map<string, string> {
  return new Map(items.map((item) => [item.id, item.name]));
}
