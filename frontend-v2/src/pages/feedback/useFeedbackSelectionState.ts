import { useSearchParams } from 'react-router-dom';

export function useFeedbackSelectionState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedRecordId = searchParams.get('recordId');

  const handleSelectRecord = (recordId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('recordId', recordId);
    setSearchParams(next, { replace: true });
  };

  return {
    selectedRecordId,
    handleSelectRecord,
  };
}
