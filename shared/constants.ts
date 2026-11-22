// Única fuente de verdad para los valores permitidos. El servidor los usa como
// whitelist y el cliente para armar los controles; los tipos se derivan de acá.

/** Presets de velocidad de x264 que se pueden elegir. */
export const X264_PRESETS = ['veryfast', 'medium', 'slow'] as const;

/** Anchos máximos en px. 0 = mantener el original. 720 y 1080 sirven para video vertical. */
export const WIDTHS = [0, 720, 1080, 1280, 1920, 2560, 3840] as const;

/** FPS máximos. 0 = mantener el original. */
export const FPS_OPTIONS = [0, 24, 30, 60] as const;

/** Rango de CRF que acepta el servidor. */
export const CRF_RANGE = { min: 16, max: 36 } as const;

/** Rango de CRF que muestra el slider de la UI (subconjunto del anterior). */
export const CRF_UI_RANGE = { min: 18, max: 32 } as const;

export const MB = 1024 * 1024;
export const GB = 1024 * MB;
