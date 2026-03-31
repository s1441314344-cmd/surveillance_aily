export type SelectOption = {
  label: string;
  value: string;
};

export function createAllOption(label: string): SelectOption {
  return { label, value: 'all' };
}

export function buildAllOptions<T>(
  items: readonly T[] | undefined,
  allLabel: string,
  mapItem: (item: T) => SelectOption,
): SelectOption[] {
  return [createAllOption(allLabel), ...((items ?? []).map(mapItem))];
}
