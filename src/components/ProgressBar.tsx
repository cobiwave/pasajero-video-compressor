import type { Progress } from '../hooks/useCompress';
import { formatTimecode } from '../lib/format';

export function ProgressBar({ progress, duration }: { progress: Progress; duration: number }) {
  const percent = Math.round(progress.percent);
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <div className="progressHead">
        <span className="percent">{progress.percent.toFixed(0)}%</span>
        <span className="timecode">
          {formatTimecode(progress.time)} / {formatTimecode(duration)}
          {progress.speed && ` · ${progress.speed}`}
        </span>
      </div>
      <div className="bar">
        <div style={{ width: `${progress.percent}%` }} />
      </div>
    </div>
  );
}
