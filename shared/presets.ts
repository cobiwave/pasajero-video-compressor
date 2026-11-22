import { GB, MB } from './constants.js';
import type { Preset, PresetId } from './types.js';

// Presets por destino. Los límites se revisaron en noviembre de 2026.
// - LinkedIn: verificado en la ayuda oficial (linkedin.com/help/linkedin/answer/a548372).
// - El resto: solo había guías de terceros que no coinciden entre sí. Se usó el valor
//   más conservador y se marcó con `TODO: verificar`.
// Los límites solo se usan para mostrar avisos; nunca bloquean la compresión.

export const PRESETS: readonly Preset[] = [
  {
    id: 'vertical',
    label: 'Instagram / TikTok',
    description: 'Reels y TikToks en vertical',
    platform: 'Instagram Reels · TikTok',
    settings: { crf: 23, fps: 30, width: 1080, preset: 'slow', audio: true },
    limits: {
      // Instagram exige mínimo 720 px y 30 fps (help.instagram.com/1038071743007909).
      resolution: '1080×1920', // TODO: verificar (recomendado por guías, no por la ayuda oficial)
      maxDuration: 90, // TODO: verificar (Reels: las fuentes dicen 90 s a 3 min o más; TikTok sube hasta 10–60 min)
      maxSize: 287 * MB, // TODO: verificar (TikTok iOS; en Android dicen 72 MB y en desktop 500 MB)
      maxFps: 60, // TODO: verificar
    },
  },
  {
    id: 'x',
    label: 'X',
    description: 'Posts con video en X',
    platform: 'X (Twitter)',
    settings: { crf: 24, fps: 30, width: 1920, preset: 'slow', audio: true },
    limits: {
      resolution: '1920×1200', // TODO: verificar (máximo según guías de terceros)
      maxDuration: 140, // TODO: verificar (cuentas sin Premium)
      maxSize: 512 * MB, // TODO: verificar (cuentas sin Premium)
      maxFps: 40, // TODO: verificar (las fuentes dicen 40 o 60; usamos el menor)
    },
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    description: 'Videos para publicar en tu perfil',
    platform: 'LinkedIn',
    settings: { crf: 26, fps: 30, width: 1920, preset: 'slow', audio: true },
    limits: {
      // Ayuda oficial: 256×144 a 4096×2304, 10–60 fps, 3 s a 15 min, 75 KB a 5 GB.
      resolution: '1920×1080',
      maxDuration: 15 * 60,
      maxSize: 5 * GB,
      maxFps: 60,
    },
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    description: 'Para enviar por chat sin perder calidad',
    platform: 'WhatsApp',
    settings: { crf: 28, fps: 30, width: 1280, preset: 'slow', audio: true },
    limits: {
      resolution: '1280×720', // TODO: verificar (tope del modo HD según guías de terceros)
      maxDuration: null,
      maxSize: 64 * MB, // TODO: verificar (como documento admite hasta 2 GB)
      maxFps: null,
    },
  },
  {
    id: 'web',
    label: 'Web',
    description: 'Videos de fondo para páginas web, sin sonido',
    platform: 'Sitio web',
    settings: { crf: 28, fps: 30, width: 1920, preset: 'slow', audio: false },
    limits: { resolution: '1920×1080', maxDuration: null, maxSize: null, maxFps: null },
  },
  {
    id: 'max',
    label: 'Máxima calidad',
    description: 'Casi igual al original, pero más ligero',
    platform: 'Para guardar',
    settings: { crf: 18, fps: 0, width: 0, preset: 'slow', audio: true },
    limits: { resolution: 'Original', maxDuration: null, maxSize: null, maxFps: null },
  },
];

export const DEFAULT_PRESET_ID: PresetId = 'x';

export function getPreset(id: PresetId): Preset {
  const preset = PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`Preset desconocido: ${id}`);
  return preset;
}
