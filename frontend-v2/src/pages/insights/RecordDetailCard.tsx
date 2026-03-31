import type { ReactNode } from 'react';
import { SectionCard } from '@/shared/ui';

export function RecordDetailCard({
  title,
  content,
  secondary,
}: {
  title: string;
  content: ReactNode;
  secondary?: string;
}) {
  return (
    <SectionCard
      title={title}
      className="record-detail-card"
    >
      <div>{content}</div>
      {secondary ? <div className="record-detail-secondary">{secondary}</div> : null}
    </SectionCard>
  );
}
