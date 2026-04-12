import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SetURLSearchParams } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { useCameraUrlSync } from './useCameraUrlSync';

function Harness({
  onSelect,
  search,
  setSearchParams,
}: {
  onSelect: (cameraId: string | null) => void;
  search: string;
  setSearchParams: SetURLSearchParams;
}) {
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(
    () => new URLSearchParams(search).get('cameraId'),
  );
  const effectiveSelectedCameraId = selectedCameraId;

  const selectCamera = (cameraId: string | null) => {
    onSelect(cameraId);
    setSelectedCameraId(cameraId);
  };

  useCameraUrlSync({
    search,
    selectedCameraId,
    effectiveSelectedCameraId,
    selectCamera,
    setSearchParams,
  });

  return (
    <div>
      <button type="button" onClick={() => selectCamera('camera-b')}>
        switch
      </button>
      <span data-testid="search">{search}</span>
    </div>
  );
}

describe('useCameraUrlSync', () => {
  it('does not revert selection to the stale query when user changes selection', async () => {
    const onSelect = vi.fn();
    const setSearchParams = vi.fn() as unknown as SetURLSearchParams;
    render(<Harness onSelect={onSelect} search="?cameraId=camera-a" setSearchParams={setSearchParams} />);

    fireEvent.click(screen.getByRole('button', { name: 'switch' }));

    await waitFor(() => expect(setSearchParams).toHaveBeenCalled());

    expect(onSelect.mock.calls.map(([cameraId]) => cameraId)).toEqual(['camera-b']);
  });
});
