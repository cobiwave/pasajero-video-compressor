import type { Preset, PresetId } from '../../shared/types';
import { formatBytes, formatDuration } from '../lib/format';

interface Props {
  presets: readonly Preset[];
  activeId: PresetId;
  modified: boolean;
  onChoose: (id: PresetId) => void;
  disabled: boolean;
}

function summary({ limits }: Preset): string {
  const parts = [limits.resolution];
  if (limits.maxDuration) parts.push(`máx. ${formatDuration(limits.maxDuration)}`);
  if (limits.maxSize) parts.push(`máx. ${formatBytes(limits.maxSize)}`);
  return parts.join(' · ');
}

export function PresetPicker({ presets, activeId, modified, onChoose, disabled }: Props) {
  return (
    <div className="subgrid presets" role="radiogroup" aria-label="Destino">
      {presets.map((p) => {
        const active = p.id === activeId;
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={active}
            className={`preset ${active ? 'active' : ''}`}
            onClick={() => onChoose(p.id)}
            disabled={disabled}
            title={p.platform}
          >
            <strong>
              {p.label}
              {active && modified && <em> · ajustado</em>}
            </strong>
            <span className="presetDesc">{p.description}</span>
            <span className="presetSpec">{summary(p)}</span>
          </button>
        );
      })}
    </div>
  );
}
