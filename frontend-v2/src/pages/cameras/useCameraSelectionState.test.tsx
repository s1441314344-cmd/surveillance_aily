import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CREATE_CAMERA_ID } from '@/pages/cameras/cameraCenterConfig';
import { useCameraSelectionState } from '@/pages/cameras/useCameraSelectionState';

afterEach(() => {
  cleanup();
});

function Harness({
  selectedCameraId,
  effectiveSelectedCameraId,
  onSelectCamera,
}: {
  selectedCameraId: string | null;
  effectiveSelectedCameraId: string | null;
  onSelectCamera: (cameraId: string | null) => void;
}) {
  const selectionState = useCameraSelectionState({
    selectedCameraId,
    effectiveSelectedCameraId,
    setSelectedCameraId: onSelectCamera,
  });

  return (
    <div>
      <span data-testid="selected-camera-id">{selectionState.selectedCameraId ?? 'null'}</span>
      <span data-testid="effective-camera-id">{selectionState.effectiveSelectedCameraId ?? 'null'}</span>
      <span data-testid="desired-camera-id">{selectionState.desiredCameraIdForUrl ?? 'null'}</span>
      <button type="button" onClick={() => selectionState.selectCamera('camera-next')}>
        select
      </button>
      <button type="button" onClick={() => selectionState.selectCamera('  camera-with-space  ')}>
        select-spaced
      </button>
    </div>
  );
}

describe('useCameraSelectionState', () => {
  it('keeps selected/effective ids unchanged and delegates select action', () => {
    const onSelectCamera = vi.fn();
    const { getByTestId, getByRole } = render(
      <Harness
        selectedCameraId="camera-a"
        effectiveSelectedCameraId="camera-b"
        onSelectCamera={onSelectCamera}
      />,
    );

    expect(getByTestId('selected-camera-id').textContent).toBe('camera-a');
    expect(getByTestId('effective-camera-id').textContent).toBe('camera-b');
    expect(getByTestId('desired-camera-id').textContent).toBe('camera-b');

    fireEvent.click(getByRole('button', { name: 'select' }));
    expect(onSelectCamera).toHaveBeenCalledWith('camera-next');
  });

  it('resolves create mode to null cameraId for url sync target', () => {
    const onSelectCamera = vi.fn();
    const { getByTestId } = render(
      <Harness
        selectedCameraId={CREATE_CAMERA_ID}
        effectiveSelectedCameraId="camera-b"
        onSelectCamera={onSelectCamera}
      />,
    );

    expect(getByTestId('desired-camera-id').textContent).toBe('null');
  });

  it('normalizes selected camera id before delegating to state setter', () => {
    const onSelectCamera = vi.fn();
    const { getByRole } = render(
      <Harness
        selectedCameraId="camera-a"
        effectiveSelectedCameraId="camera-a"
        onSelectCamera={onSelectCamera}
      />,
    );

    fireEvent.click(getByRole('button', { name: 'select-spaced' }));
    expect(onSelectCamera).toHaveBeenCalledWith('camera-with-space');
  });
});
