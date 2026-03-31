import { Button, Form, Input, Radio } from 'antd';
import type { FormInstance } from 'antd/es/form';
import { type FeedbackFormValues } from '@/pages/feedback/types';

const { TextArea } = Input;

type FeedbackReviewFormProps = {
  form: FormInstance<FeedbackFormValues>;
  loading: boolean;
  onSubmit: (values: FeedbackFormValues) => void;
};

export function FeedbackReviewForm({ form, loading, onSubmit }: FeedbackReviewFormProps) {
  return (
    <Form layout="vertical" form={form} onFinish={onSubmit}>
      <Form.Item
        label="判断"
        name="judgement"
        rules={[{ required: true, message: '请选择复核结果' }]}
      >
        <Radio.Group>
          <Radio value="correct">模型判断正确</Radio>
          <Radio value="incorrect">模型判断错误</Radio>
        </Radio.Group>
      </Form.Item>
      <Form.Item label="修正标签" name="correctedLabel">
        <Input placeholder="可选：补充更准确的标签" />
      </Form.Item>
      <Form.Item label="备注" name="comment">
        <TextArea rows={3} />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          提交复核
        </Button>
      </Form.Item>
    </Form>
  );
}
