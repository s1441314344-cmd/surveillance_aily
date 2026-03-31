type GetEffectiveSelectionParams<T> = {
  items: T[];
  selectedId: string | null | undefined;
  getId: (item: T) => string;
};

export function getEffectiveSelectionId<T>({
  items,
  selectedId,
  getId,
}: GetEffectiveSelectionParams<T>): string | null {
  if (!items.length) {
    return null;
  }

  const exists = Boolean(selectedId) && items.some((item) => getId(item) === selectedId);
  return exists ? (selectedId as string) : getId(items[0]);
}
