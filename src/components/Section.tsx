import type { ReactNode } from 'react';

interface Props {
  index: string;
  title: string;
  aside?: ReactNode;
  dim?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Bloque numerado. Es un `.container`: en desktop el encabezado ocupa las
 * columnas 1–3 y el contenido es un subgrid de las 4–12.
 */
export function Section({ index, title, aside, dim = false, className = '', children }: Props) {
  return (
    <section className={`container section ${dim ? 'dim' : ''} ${className}`} aria-disabled={dim || undefined}>
      <header className="sectionHead">
        <span className="sectionIndex">{index}</span>
        <h2>{title}</h2>
        {aside && <span className="sectionAside">{aside}</span>}
      </header>
      <div className="subgrid sectionBody">{children}</div>
    </section>
  );
}
