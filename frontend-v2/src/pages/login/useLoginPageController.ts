import { useMutation } from '@tanstack/react-query';
import { App, Form } from 'antd';
import { useNavigate } from 'react-router-dom';
import { login } from '@/shared/api/auth';
import { getApiErrorMessage } from '@/shared/utils/apiErrorMessage';
import { toStoreSessionPayload } from '@/shared/auth/session';
import { useAuthStore } from '@/shared/state/authStore';

export type LoginFormValues = {
  username: string;
  password: string;
};

export function useLoginPageController() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [form] = Form.useForm<LoginFormValues>();

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (response) => {
      setSession(toStoreSessionPayload(response));
      message.success('登录成功');
      navigate('/dashboard');
    },
  });

  async function handleFinish(values: LoginFormValues) {
    try {
      await loginMutation.mutateAsync(values);
    } catch (error) {
      message.error(getApiErrorMessage(error, '登录失败'));
    }
  }

  return {
    form,
    loginMutation,
    handleFinish,
  };
}
