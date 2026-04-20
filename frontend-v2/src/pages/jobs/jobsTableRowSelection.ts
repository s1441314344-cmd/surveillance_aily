import type { KeyboardEvent } from 'react';

type SelectableRecord = {
  id: string;
};

type BuildSelectableTableRowPropsParams = {
  selectedId?: string | null;
  onSelect: (id: string) => void;
};

function buildSelectableTableRowClassName(isSelected: boolean) {
  return `table-row-clickable ${isSelected ? 'table-row-selected' : ''}`;
}

function handleSelectableTableRowKeyDown(
  event: KeyboardEvent<HTMLElement>,
  onSelect: () => void,
) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onSelect();
  }
}

export function buildSelectableTableRowProps<T extends SelectableRecord>({
  selectedId,
  onSelect,
}: BuildSelectableTableRowPropsParams) {
  return {
    onRow: (record: T) => ({
      onClick: () => onSelect(record.id),
      tabIndex: 0,
      'aria-selected': record.id === selectedId,
      onKeyDown: (event: KeyboardEvent<HTMLElement>) =>
        handleSelectableTableRowKeyDown(event, () => onSelect(record.id)),
    }),
    rowClassName: (record: T) =>
      buildSelectableTableRowClassName(record.id === selectedId),
  };
}
