import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SetURLSearchParams } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { CREATE_CAMERA_ID } from '@/pages/cameras/cameraCenterConfig';
import {
  getDesiredCameraIdForUrlSync,
  normalizeCameraId,
  readCameraIdFromSearch,
  shouldSelectCameraFromQuery,
} from '@/pages/cameras/cameraUrlSyncUtils';
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

  it('returns null desired camera id when selected id is create mode', () => {
    expect(
      getDesiredCameraIdForUrlSync({
        selectedCameraId: CREATE_CAMERA_ID,
        effectiveSelectedCameraId: 'camera-a',
      }),
    ).toBeNull();
  });

  it('only selects from query when query differs from both selected and effective ids', () => {
    expect(
      shouldSelectCameraFromQuery({
        queryCameraId: 'camera-a',
        selectedCameraId: 'camera-a',
        effectiveSelectedCameraId: 'camera-b',
      }),
    ).toBe(false);
    expect(
      shouldSelectCameraFromQuery({
        queryCameraId: 'camera-b',
        selectedCameraId: 'camera-a',
        effectiveSelectedCameraId: 'camera-b',
      }),
    ).toBe(false);
    expect(
      shouldSelectCameraFromQuery({
        queryCameraId: 'camera-c',
        selectedCameraId: 'camera-a',
        effectiveSelectedCameraId: 'camera-b',
      }),
    ).toBe(true);
  });

  it('normalizes blank query camera id to null', () => {
    expect(normalizeCameraId(undefined)).toBeNull();
    expect(normalizeCameraId(null)).toBeNull();
    expect(normalizeCameraId('   ')).toBeNull();
    expect(normalizeCameraId(' camera-z ')).toBe('camera-z');

    expect(readCameraIdFromSearch('?cameraId=')).toBeNull();
    expect(readCameraIdFromSearch('?cameraId=%20%20')).toBeNull();
    expect(readCameraIdFromSearch('?cameraId=%20camera-z%20')).toBe('camera-z');
  });

  it('removes cameraId but preserves other query params in create mode', async () => {
    const onSelect = vi.fn();
    const setSearchParams = vi.fn() as unknown as SetURLSearchParams;
    render(
      <Harness
        onSelect={onSelect}
        search={`?cameraId=${CREATE_CAMERA_ID}&tab=monitoring&debug=1`}
        setSearchParams={setSearchParams}
      />,
    );

    await waitFor(() => expect(setSearchParams).toHaveBeenCalled());

    const [nextParams] = setSearchParams.mock.calls[0];
    const searchValue = String(nextParams);
    expect(searchValue).toContain('tab=monitoring');
    expect(searchValue).toContain('debug=1');
    expect(searchValue).not.toContain('cameraId=');
  });
});
