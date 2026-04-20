import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useClampStatusLogsPage } from '@/pages/cameras/cameraCenterStateHelpers';

describe('cameraCenterStateHelpers', () => {
  it('resets status logs page to 1 when the current page is NaN', async () => {
    const setStatusLogsPage = vi.fn();

    renderHook(() =>
      useClampStatusLogsPage(5, Number.NaN, 4, setStatusLogsPage),
    );

    await waitFor(() => {
      expect(setStatusLogsPage).toHaveBeenCalledWith(1);
    });
  });
});
