import type { Progress } from '../hooks/useCompress';

/** "Quedan unos 2 min" a partir de la velocidad que reporta el servidor (ej. "2.5x"). */
function remaining({ time, speed }: Progress, duration: number): string | null {
  const factor = speed ? Number.parseFloat(speed) : Number.NaN;
  if (!duration || !Number.isFinite(factor) || factor <= 0) return null;
  const seconds = Math.max(0, (duration - time) / factor);
  if (seconds < 60) return 'Quedan unos segundos';
  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? 'Queda alrededor de 1 minuto' : `Quedan unos ${minutes} minutos`;
}

export function ProgressBar({ progress, duration }: { progress: Progress; duration: number }) {
  const percent = Math.round(progress.percent);
  const eta = remaining(progress, duration);
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <div className="progressHead">
        <span className="percent">{percent}%</span>
        {eta && <span className="eta">{eta}</span>}
      </div>
      <div className="bar">
        <div style={{ width: `${progress.percent}%` }} />
      </div>
    </div>
  );
}
