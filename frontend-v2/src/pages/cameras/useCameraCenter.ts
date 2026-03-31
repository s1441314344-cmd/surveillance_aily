import { useOutletContext } from 'react-router-dom';
import type { CameraCenterState } from './cameraCenterTypes';

export function useCameraCenter() {
  return useOutletContext<CameraCenterState>();
}
