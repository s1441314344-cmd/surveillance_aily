import { App } from 'antd';
import { exportTaskRecords } from '@/shared/api/tasks';
import { getApiErrorMessage } from '@/shared/api/errors';
import type { RecordsFilterState } from '@/pages/records/types';
import { buildTaskRecordFilterParams } from '@/pages/records/recordsTaskRecordParams';

type UseRecordsActionStateParams = {
  filters: RecordsFilterState;
};

export function useRecordsActionState({ filters }: UseRecordsActionStateParams) {
  const { message } = App.useApp();

  const handleExport = async (format: 'csv' | 'xlsx') => {
    try {
      const blob = await exportTaskRecords({
        format,
        ...buildTaskRecordFilterParams(filters),
      });

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = format === 'xlsx' ? 'task-records.xlsx' : 'task-records.csv';
      link.click();
      URL.revokeObjectURL(objectUrl);

      message.success(format === 'xlsx' ? 'Excel 导出成功' : 'CSV 导出成功');
    } catch (error) {
      message.error(
        getApiErrorMessage(error, format === 'xlsx' ? 'Excel 导出失败' : 'CSV 导出失败'),
      );
    }
  };

  return {
    handleExport,
  };
}
