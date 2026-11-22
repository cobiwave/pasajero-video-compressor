import { CRF_UI_RANGE, FPS_OPTIONS, WIDTHS, X264_PRESETS } from '../../shared/constants';
import type { CompressSettings, Fps, Width, X264Preset } from '../../shared/types';

interface Props {
  settings: CompressSettings;
  update: <K extends keyof CompressSettings>(key: K, value: CompressSettings[K]) => void;
  disabled: boolean;
}

const WIDTH_LABELS: Record<Width, string> = {
  0: 'Original',
  720: '720 px (vertical 720p)',
  1080: '1080 px (vertical 1080p)',
  1280: '1280 px (720p)',
  1920: '1920 px (1080p)',
  2560: '2560 px (1440p)',
  3840: '3840 px (4K)',
};

const FPS_LABELS: Record<Fps, string> = {
  0: 'Original',
  24: '24 fps (cine)',
  30: '30 fps',
  60: '60 fps (movimiento fluido)',
};

const PRESET_LABELS: Record<X264Preset, string> = {
  veryfast: 'Rápida (archivo más grande)',
  medium: 'Media',
  slow: 'Lenta (archivo más chico)',
};

/** Busca el valor del <select> dentro de la lista permitida (sin casteos). */
const pick = <T extends string | number>(options: readonly T[], value: string): T | undefined =>
  options.find((o) => String(o) === value);

export function SettingsForm({ settings, update, disabled }: Props) {
  return (
    <div className="grid">
      <label className="field wide">
        <span className="label">
          Calidad (CRF) <b>{settings.crf}</b>
        </span>
        <input
          type="range"
          min={CRF_UI_RANGE.min}
          max={CRF_UI_RANGE.max}
          value={settings.crf}
          onChange={(e) => update('crf', Number(e.target.value))}
          disabled={disabled}
        />
        <small>Menor = más calidad y más peso. 23–28 es el rango ideal.</small>
      </label>

      <label className="field">
        <span className="label">Ancho máximo</span>
        <select
          value={settings.width}
          onChange={(e) => {
            const v = pick(WIDTHS, e.target.value);
            if (v !== undefined) update('width', v);
          }}
          disabled={disabled}
        >
          {WIDTHS.filter((w) => w !== 0).map((w) => (
            <option key={w} value={w}>
              {WIDTH_LABELS[w]}
            </option>
          ))}
          <option value={0}>{WIDTH_LABELS[0]}</option>
        </select>
      </label>

      <label className="field">
        <span className="label">FPS máximo</span>
        <select
          value={settings.fps}
          onChange={(e) => {
            const v = pick(FPS_OPTIONS, e.target.value);
            if (v !== undefined) update('fps', v);
          }}
          disabled={disabled}
        >
          {FPS_OPTIONS.filter((f) => f !== 0).map((f) => (
            <option key={f} value={f}>
              {FPS_LABELS[f]}
            </option>
          ))}
          <option value={0}>{FPS_LABELS[0]}</option>
        </select>
      </label>

      <label className="field">
        <span className="label">Velocidad de compresión</span>
        <select
          value={settings.preset}
          onChange={(e) => {
            const v = pick(X264_PRESETS, e.target.value);
            if (v) update('preset', v);
          }}
          disabled={disabled}
        >
          {X264_PRESETS.map((p) => (
            <option key={p} value={p}>
              {PRESET_LABELS[p]}
            </option>
          ))}
        </select>
      </label>

      <label className="field check">
        <input
          type="checkbox"
          checked={settings.audio}
          onChange={(e) => update('audio', e.target.checked)}
          disabled={disabled}
        />
        <span>Mantener audio</span>
      </label>
    </div>
  );
}
