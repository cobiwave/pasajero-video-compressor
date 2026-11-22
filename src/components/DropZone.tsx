import { useEffect, useRef, useState, type DragEvent } from 'react';

interface Props {
  /** Nombre del video ya elegido, si hay uno. */
  current: string | null;
  /** Clic: abre el selector nativo. */
  onPick: () => void;
  /** Se soltó un archivo: hay que buscar su ruta en el disco. */
  onDropFile: (file: File) => void;
  /** Se soltó algo que ya trae la ruta (algunos gestores de archivos en Linux). */
  onDropPath: (path: string) => void;
  disabled: boolean;
  /** Texto de estado mientras se elige, se busca o se analiza. */
  busyLabel: string | null;
  error: string;
}

/** Ruta local si el arrastre trae una URL file:// (el servidor limpia el prefijo). */
const fileUrlFrom = (e: DragEvent): string | null => {
  const url = e.dataTransfer.getData('text/uri-list').split(/\r?\n/).find((l) => l.startsWith('file://'));
  return url ?? null;
};

/** Zona para soltar un video o hacer clic y elegirlo. */
export function DropZone({ current, onPick, onDropFile, onDropPath, disabled, busyLabel, error }: Props) {
  const [over, setOver] = useState(false);
  // dragenter/dragleave se disparan también al pasar por los hijos: contamos
  const depth = useRef(0);
  const blocked = disabled || busyLabel !== null;

  // Si el archivo cae fuera de la zona, que el navegador no lo abra en la pestaña
  useEffect(() => {
    const prevent = (e: globalThis.DragEvent) => e.preventDefault();
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', prevent);
    };
  }, []);

  const onDragEnter = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    depth.current++;
    if (!blocked) setOver(true);
  };

  const onDragLeave = () => {
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setOver(false);
  };

  const onDragOver = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = blocked ? 'none' : 'copy';
  };

  const onDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    depth.current = 0;
    setOver(false);
    if (blocked) return;
    const url = fileUrlFrom(e);
    if (url) return onDropPath(url);
    const file = e.dataTransfer.files[0];
    if (file) onDropFile(file);
  };

  const title = busyLabel ?? (over ? 'Suéltalo' : (current ?? 'Suelta un video aquí'));
  const hint = current ? 'Suelta otro o haz clic para cambiarlo' : 'o haz clic para elegirlo';

  return (
    <div className="source">
      <button
        type="button"
        className={`dropzone${over ? ' over' : ''}${current ? ' has-file' : ''}`}
        onClick={onPick}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        disabled={blocked}
        aria-busy={busyLabel !== null}
      >
        <span className="dropzoneTitle">{title}</span>
        {!busyLabel && !over && <span className="dropzoneHint">{hint}</span>}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
