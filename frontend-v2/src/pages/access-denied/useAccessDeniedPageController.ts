import { useNavigate } from 'react-router-dom';

export function useAccessDeniedPageController() {
  const navigate = useNavigate();

  function handleBackToDashboard() {
    navigate('/dashboard');
  }

  return {
    handleBackToDashboard,
  };
}
