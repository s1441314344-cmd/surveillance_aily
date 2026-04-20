import { useEffect } from 'react';

function getTotalStatusLogPages(totalLogs: number, pageSize: number) {
  return Math.max(1, Math.ceil(totalLogs / pageSize));
}

function normalizeStatusLogsPage(statusLogsPage: number) {
  if (!Number.isFinite(statusLogsPage)) {
    return 1;
  }
  return Math.max(1, Math.trunc(statusLogsPage));
}

export function useResetStatusLogsPageOnCameraChange(
  effectiveSelectedCameraId: string | null,
  setStatusLogsPage: (page: number) => void,
) {
  useEffect(() => {
    setStatusLogsPage(1);
  }, [effectiveSelectedCameraId, setStatusLogsPage]);
}

export function useClampStatusLogsPage(
  totalLogs: number,
  statusLogsPage: number,
  statusLogsPageSize: number,
  setStatusLogsPage: (page: number) => void,
) {
  useEffect(() => {
    const totalPages = getTotalStatusLogPages(totalLogs, statusLogsPageSize);
    const normalizedPage = normalizeStatusLogsPage(statusLogsPage);
    if (normalizedPage !== statusLogsPage) {
      setStatusLogsPage(normalizedPage);
      return;
    }
    if (normalizedPage > totalPages) {
      setStatusLogsPage(totalPages);
    }
  }, [totalLogs, statusLogsPage, statusLogsPageSize, setStatusLogsPage]);
}
