import type { ReactNode } from "react";

type PageHeaderProps = {
  /** Main title text/nodes (rendered with the brand gradient) */
  title: ReactNode;
  /** Right-aligned actions, e.g. a primary button */
  actions?: ReactNode;
  /** Optional content under the title (e.g. a streak line, a caption) */
  subtitle?: ReactNode;
};

/**
 * Shared page header: a gradient title on the left (that truncates/flexes)
 * and optional actions on the right. Used across the top-level views so they
 * only pass their own text and buttons.
 */
export function PageHeader({ title, actions, subtitle }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="gradient-text text-3xl font-bold">{title}</h1>
        {subtitle}
      </div>
      {actions}
    </header>
  );
}
