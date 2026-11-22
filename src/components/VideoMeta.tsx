import type { VideoInfo } from '../../shared/types';
import { formatBytes, formatDuration } from '../lib/format';

export function VideoMeta({ info }: { info: VideoInfo }) {
  const items: [string, string][] = [
    ['Duración', formatDuration(info.duration)],
    ['Peso', formatBytes(info.size)],
    ['Tamaño', `${info.width}×${info.height}`],
  ];

  return (
    <dl className="subgrid meta">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
