import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_PRESET_ID, PRESETS, getPreset } from '../../shared/presets';
import { CompressSettingsSchema } from '../../shared/schemas';
import type { CompressSettings, Preset, PresetId } from '../../shared/types';

const STORAGE_KEY = 'video-compressor:settings';

interface Stored {
  settings: CompressSettings;
  presetId: PresetId;
}

const isPresetId = (v: unknown): v is PresetId => PRESETS.some((p) => p.id === v);

/** Lee lo guardado y descarta cualquier valor que ya no sea válido. */
function load(): Stored {
  const fallback = getPreset(DEFAULT_PRESET_ID);
  let raw: unknown = null;
  try {
    raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
  } catch {
    // localStorage bloqueado o JSON roto: usamos los valores por defecto
  }
  if (typeof raw !== 'object' || raw === null) return { settings: fallback.settings, presetId: fallback.id };

  const settings = { ...fallback.settings };
  const partial = CompressSettingsSchema.partial().safeParse(raw);
  if (partial.success) {
    for (const [k, v] of Object.entries(partial.data)) {
      if (v !== undefined) Object.assign(settings, { [k]: v });
    }
  }
  const presetId = 'presetId' in raw && isPresetId(raw.presetId) ? raw.presetId : fallback.id;
  return { settings: CompressSettingsSchema.parse(settings), presetId };
}

export const sameSettings = (a: CompressSettings, b: CompressSettings): boolean =>
  a.crf === b.crf && a.fps === b.fps && a.width === b.width && a.preset === b.preset && a.audio === b.audio;

export interface SettingsState {
  settings: CompressSettings;
  preset: Preset;
  /** true si el usuario cambió algún valor después de elegir el preset. */
  modified: boolean;
  choosePreset: (id: PresetId) => void;
  update: <K extends keyof CompressSettings>(key: K, value: CompressSettings[K]) => void;
}

/** Configuración de compresión + destino elegido, guardados en localStorage. */
export function useSettings(): SettingsState {
  const [state, setState] = useState<Stored>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state.settings, presetId: state.presetId }));
    } catch {
      // Sin localStorage (modo privado, etc.): la app sigue andando sin guardar
    }
  }, [state]);

  const choosePreset = useCallback((id: PresetId) => {
    setState({ presetId: id, settings: { ...getPreset(id).settings } });
  }, []);

  const update = useCallback(<K extends keyof CompressSettings>(key: K, value: CompressSettings[K]) => {
    setState((s) => ({ ...s, settings: { ...s.settings, [key]: value } }));
  }, []);

  const preset = getPreset(state.presetId);
  return {
    settings: state.settings,
    preset,
    modified: !sameSettings(state.settings, preset.settings),
    choosePreset,
    update,
  };
}
