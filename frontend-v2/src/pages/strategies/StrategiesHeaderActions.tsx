import { Button } from 'antd';
import type { useStrategiesPageController } from '@/pages/strategies/useStrategiesPageController';

type StrategiesPageController = ReturnType<typeof useStrategiesPageController>;

type StrategiesHeaderActionsProps = {
  controller: StrategiesPageController;
};

export function StrategiesHeaderActions({ controller }: StrategiesHeaderActionsProps) {
  return (
    <Button type="primary" onClick={controller.actions.resetForCreate}>
      新建策略
    </Button>
  );
}
