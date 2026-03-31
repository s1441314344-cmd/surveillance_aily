import { useEffect } from 'react';

function getTotalStatusLogPages(totalLogs: number, pageSize: number) {
  return Math.max(1, Math.ceil(totalLogs / pageSize));
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
    if (statusLogsPage > totalPages) {
      setStatusLogsPage(totalPages);
    }
  }, [totalLogs, statusLogsPage, statusLogsPageSize, setStatusLogsPage]);
}
