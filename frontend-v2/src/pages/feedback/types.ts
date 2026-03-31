export type FeedbackFormValues = {
  judgement: 'correct' | 'incorrect';
  correctedLabel?: string;
  comment?: string;
};

export const formatTimestamp = (value: string | null) => (value ? new Date(value).toLocaleString() : '-');
