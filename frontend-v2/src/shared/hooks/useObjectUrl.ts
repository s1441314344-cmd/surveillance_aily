import { useEffect, useMemo } from 'react';

export function useObjectUrl(file: Blob | MediaSource | null | undefined) {
  const objectUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    if (!objectUrl) {
      return undefined;
    }

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  return objectUrl;
}
