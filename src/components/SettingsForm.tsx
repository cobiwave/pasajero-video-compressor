import { CRF_UI_RANGE, FPS_OPTIONS, WIDTHS, X264_PRESETS } from '../../shared/constants';
import type { CompressSettings, Fps, Width, X264Preset } from '../../shared/types';

interface Props {
  settings: CompressSettings;
  update: <K extends keyof CompressSettings>(key: K, value: CompressSettings[K]) => void;
  disabled: boolean;
}

const WIDTH_LABELS: Record<Width, string> = {
  0: 'Original',
  720: 'Vertical HD',
  1080: 'Vertical Full HD',
  1280: 'HD',
  1920: 'Full HD',
  2560: '2K',
  3840: '4K',
};

const FPS_LABELS: Record<Fps, string> = {
  0: 'Original',
  24: 'Cine',
  30: 'Normal',
  60: 'Muy fluida',
};

const PRESET_LABELS: Record<X264Preset, string> = {
  veryfast: 'Rápida (archivo más grande)',
  medium: 'Normal',
  slow: 'Lenta (archivo más pequeño)',
};

/** Busca el valor del <select> dentro de la lista permitida (sin casteos). */
const pick = <T extends string | number>(options: readonly T[], value: string): T | undefined =>
  options.find((o) => String(o) === value);

// El slider va de "más ligero" (izquierda) a "mejor calidad" (derecha); el CRF funciona al
// revés (menor = más calidad), así que se invierte.
const toSlider = (crf: number) => CRF_UI_RANGE.min + CRF_UI_RANGE.max - crf;
const fromSlider = toSlider;

export function SettingsForm({ settings, update, disabled }: Props) {
  return (
    <div className="subgrid settings">
      <label className="field wide">
        <span className="label">Calidad</span>
        <input
          type="range"
          min={CRF_UI_RANGE.min}
          max={CRF_UI_RANGE.max}
          value={toSlider(settings.crf)}
          onChange={(e) => update('crf', fromSlider(Number(e.target.value)))}
          disabled={disabled}
        />
        <span className="rangeEnds" aria-hidden="true">
          <small>Archivo más ligero</small>
          <small>Mejor calidad</small>
        </span>
      </label>

      <label className="field">
        <span className="label">Tamaño de imagen</span>
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
        <span className="label">Fluidez</span>
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
        <span className="label">Velocidad</span>
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
        <span>Mantener el sonido</span>
      </label>
    </div>
  );
}
