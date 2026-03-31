import { useEffect } from 'react';
import type { FormInstance } from 'antd';
import type { Strategy } from '@/shared/api/configCenter';
import type { UploadFormValues } from '@/pages/jobs/types';

type UseEnsureDefaultJobStrategyParams = {
  form: FormInstance<UploadFormValues>;
  strategies: Strategy[];
};

export function useEnsureDefaultJobStrategy({
  form,
  strategies,
}: UseEnsureDefaultJobStrategyParams) {
  useEffect(() => {
    const selectedStrategyId = form.getFieldValue('strategyId');
    if (!selectedStrategyId && strategies.length > 0) {
      form.setFieldValue('strategyId', strategies[0].id);
    }
  }, [form, strategies]);
}
