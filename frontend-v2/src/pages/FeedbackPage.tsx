import { PagePlaceholder } from './PagePlaceholder';

export function FeedbackPage() {
  return (
    <PagePlaceholder
      title="人工复核"
      description="用于对模型结果做正确/错误标记并补充修正标签。"
      bullets={[
        '待复核队列',
        '图片与模型结论对照',
        '正确/错误标记、修正标签、备注',
      ]}
      phase="Phase 4"
    />
  );
}
