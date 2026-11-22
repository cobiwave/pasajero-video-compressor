import type { VideoInfo } from '../../shared/types';
import { formatBytes, formatDuration } from '../lib/format';

export function VideoMeta({ info }: { info: VideoInfo }) {
  const items: [string, string, string?][] = [
    ['Archivo', info.name, info.path],
    ['Resolución', `${info.width}×${info.height}`],
    ['FPS', String(info.fps)],
    ['Duración', formatDuration(info.duration)],
    ['Peso', formatBytes(info.size)],
    ['Códec', info.codec],
    ['Audio', info.hasAudio ? 'Sí' : 'No'],
  ];

  return (
    <dl className="meta">
      {items.map(([label, value, title]) => (
        <div key={label} className={label === 'Archivo' ? 'wide' : ''}>
          <dt>{label}</dt>
          <dd title={title ?? value}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
