import type { MouseEvent } from 'react';

export const withRowClickGuard =
  (action: () => void) => (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    action();
  };

export const stopRowClickPropagation = withRowClickGuard(() => undefined);
