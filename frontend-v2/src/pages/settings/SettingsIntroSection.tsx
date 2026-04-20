import { Typography } from 'antd';
import { SectionCard } from '@/shared/ui';

const { Paragraph } = Typography;

export function SettingsIntroSection() {
  return (
    <SectionCard
      title="接入说明"
      subtitle="本页只维护服务端 API 配置，不依赖 ChatGPT Plus 等网页登录态。"
    >
      <Paragraph className="page-paragraph-bottomless">
        `OpenAI` 维护标准 API 地址与模型，`豆包/火山方舟` 继续走 `ark` 提供方，`Google` 对应 Gemini API。
        调试结果会保留本次请求日志、输入摘要、原始输出和结构化结果，方便判断链路是否真正打通。
      </Paragraph>
    </SectionCard>
  );
}
