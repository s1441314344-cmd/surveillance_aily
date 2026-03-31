import type { PropsWithChildren, ReactNode } from 'react';

export type FilterToolbarProps = PropsWithChildren<{
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  dense?: boolean;
}>;

export function FilterToolbar({
  title,
  description,
  actions,
  dense = false,
  children,
}: FilterToolbarProps) {
  return (
    <div className={dense ? 'filter-toolbar filter-toolbar--dense' : 'filter-toolbar'}>
      {title || description || actions ? (
        <div className="filter-toolbar__meta">
          <div>
            {title ? <div className="filter-toolbar__title">{title}</div> : null}
            {description ? <div className="filter-toolbar__description">{description}</div> : null}
          </div>
          {actions ? <div className="filter-toolbar__meta-actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className="filter-toolbar__content">{children}</div>
    </div>
  );
}
