import type { ReactNode } from 'react';

interface Props {
  index: string;
  title: string;
  aside?: ReactNode;
  dim?: boolean;
  className?: string;
  children: ReactNode;
}

/** Bloque numerado, como una planilla de rodaje. */
export function Section({ index, title, aside, dim = false, className = '', children }: Props) {
  return (
    <section className={`section ${dim ? 'dim' : ''} ${className}`} aria-disabled={dim || undefined}>
      <header className="sectionHead">
        <span className="sectionIndex">{index}</span>
        <h2>{title}</h2>
        {aside && <span className="sectionAside">{aside}</span>}
      </header>
      {children}
    </section>
  );
}
