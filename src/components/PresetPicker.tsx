import type { Preset, PresetId } from '../../shared/types';

interface Props {
  presets: readonly Preset[];
  activeId: PresetId;
  modified: boolean;
  onChoose: (id: PresetId) => void;
  disabled: boolean;
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
          </button>
        );
      })}
    </div>
  );
}
