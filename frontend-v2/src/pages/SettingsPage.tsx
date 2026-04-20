import { RoutePageHeader } from '@/shared/ui';
import { SettingsHeaderActions } from '@/pages/settings/SettingsHeaderActions';
import { SettingsIntroSection } from '@/pages/settings/SettingsIntroSection';
import { SettingsProviderWorkspace } from '@/pages/settings/SettingsProviderWorkspace';
import { useSettingsPageController } from '@/pages/settings/useSettingsPageController';

export function SettingsPage() {
  const controller = useSettingsPageController();

  return (
    <div className="page-stack">
      <RoutePageHeader
        description="统一管理 OpenAI、Google Gemini、智谱、豆包/火山方舟等模型提供方，并在保存后直接执行联通性调试。"
        extra={<SettingsHeaderActions controller={controller} />}
      />

      <SettingsIntroSection />
      <SettingsProviderWorkspace controller={controller} />
    </div>
  );
}
