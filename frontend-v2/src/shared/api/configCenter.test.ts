import { describe, expect, it, vi } from 'vitest';

vi.mock('./client', () => ({
  apiClient: {},
}));

import * as configCenterBarrel from './configCenter';
import * as alertsDomain from './config-center/alerts';
import * as camerasDomain from './config-center/cameras';
import * as dashboardDomain from './config-center/dashboard';
import * as settingsDomain from './config-center/settings';
import * as strategiesDomain from './config-center/strategies';
import * as trainingDomain from './config-center/training';
import type {
  AlertRecord as BarrelAlertRecord,
  AlertWebhookPayload as BarrelAlertWebhookPayload,
  Camera as BarrelCamera,
  SignalMonitorConfigPayload as BarrelSignalMonitorConfigPayload,
  DashboardDefinition as BarrelDashboardDefinition,
  DashboardDefinitionPayload as BarrelDashboardDefinitionPayload,
  ModelProvider as BarrelModelProvider,
  ModelProviderDebugResult as BarrelModelProviderDebugResult,
  Strategy as BarrelStrategy,
  StrategyPayload as BarrelStrategyPayload,
  TrainingOverview as BarrelTrainingOverview,
  TrainingRunDetail as BarrelTrainingRunDetail,
} from './configCenter';
import type {
  AlertRecord as DomainAlertRecord,
  AlertWebhookPayload as DomainAlertWebhookPayload,
} from './config-center/alerts';
import type {
  Camera as DomainCamera,
  SignalMonitorConfigPayload as DomainSignalMonitorConfigPayload,
} from './config-center/cameras';
import type {
  DashboardDefinition as DomainDashboardDefinition,
  DashboardDefinitionPayload as DomainDashboardDefinitionPayload,
} from './config-center/dashboard';
import type {
  ModelProvider as DomainModelProvider,
  ModelProviderDebugResult as DomainModelProviderDebugResult,
} from './config-center/settings';
import type {
  Strategy as DomainStrategy,
  StrategyPayload as DomainStrategyPayload,
} from './config-center/strategies';
import type {
  TrainingOverview as DomainTrainingOverview,
  TrainingRunDetail as DomainTrainingRunDetail,
} from './config-center/training';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2)
    ? true
    : false;

type AssertTrue<T extends true> = T;

type _AlertRecordReExport = AssertTrue<Equal<BarrelAlertRecord, DomainAlertRecord>>;
type _AlertWebhookPayloadReExport = AssertTrue<Equal<BarrelAlertWebhookPayload, DomainAlertWebhookPayload>>;
type _CameraReExport = AssertTrue<Equal<BarrelCamera, DomainCamera>>;
type _SignalMonitorConfigPayloadReExport = AssertTrue<
  Equal<BarrelSignalMonitorConfigPayload, DomainSignalMonitorConfigPayload>
>;
type _DashboardDefinitionReExport = AssertTrue<Equal<BarrelDashboardDefinition, DomainDashboardDefinition>>;
type _DashboardDefinitionPayloadReExport = AssertTrue<
  Equal<BarrelDashboardDefinitionPayload, DomainDashboardDefinitionPayload>
>;
type _ModelProviderReExport = AssertTrue<Equal<BarrelModelProvider, DomainModelProvider>>;
type _ModelProviderDebugResultReExport = AssertTrue<
  Equal<BarrelModelProviderDebugResult, DomainModelProviderDebugResult>
>;
type _StrategyReExport = AssertTrue<Equal<BarrelStrategy, DomainStrategy>>;
type _StrategyPayloadReExport = AssertTrue<Equal<BarrelStrategyPayload, DomainStrategyPayload>>;
type _TrainingOverviewReExport = AssertTrue<Equal<BarrelTrainingOverview, DomainTrainingOverview>>;
type _TrainingRunDetailReExport = AssertTrue<Equal<BarrelTrainingRunDetail, DomainTrainingRunDetail>>;

const _typeCoverageProof: [
  _AlertRecordReExport,
  _AlertWebhookPayloadReExport,
  _CameraReExport,
  _SignalMonitorConfigPayloadReExport,
  _DashboardDefinitionReExport,
  _DashboardDefinitionPayloadReExport,
  _ModelProviderReExport,
  _ModelProviderDebugResultReExport,
  _StrategyReExport,
  _StrategyPayloadReExport,
  _TrainingOverviewReExport,
  _TrainingRunDetailReExport,
] = [true, true, true, true, true, true, true, true, true, true, true, true];

void _typeCoverageProof;

describe('configCenter compatibility barrel', () => {
  it('re-exports every runtime API from all config-center domain modules', () => {
    const domainExports = {
      ...alertsDomain,
      ...camerasDomain,
      ...dashboardDomain,
      ...settingsDomain,
      ...strategiesDomain,
      ...trainingDomain,
    };

    const barrelExportNames = Object.keys(configCenterBarrel).sort();
    const domainExportNames = Object.keys(domainExports).sort();

    expect(barrelExportNames).toEqual(domainExportNames);

    for (const [exportName, domainExport] of Object.entries(domainExports)) {
      expect(configCenterBarrel[exportName as keyof typeof configCenterBarrel]).toBe(domainExport);
    }
  });
});
