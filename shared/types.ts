import type { z } from 'zod';
import type { FPS_OPTIONS, WIDTHS, X264_PRESETS } from './constants.js';
import type {
  ApiErrorSchema,
  CompressRequestSchema,
  CompressSettingsSchema,
  HealthResponseSchema,
  LocateRequestSchema,
  LocateResponseSchema,
  PickResponseSchema,
  ProbeRequestSchema,
  RevealRequestSchema,
  RevealResponseSchema,
  StreamMessageSchema,
  VideoInfoSchema,
} from './schemas.js';

// Tipos compartidos entre cliente y servidor.
// Los que tienen schema se infieren de zod, así tipos y validación no se desincronizan.

export type X264Preset = (typeof X264_PRESETS)[number];
export type Width = (typeof WIDTHS)[number];
export type Fps = (typeof FPS_OPTIONS)[number];

export type VideoInfo = z.infer<typeof VideoInfoSchema>;
export type CompressSettings = z.infer<typeof CompressSettingsSchema>;

export type StreamMessage = z.infer<typeof StreamMessageSchema>;
export type StreamMessageType = StreamMessage['type'];
export type StartMessage = Extract<StreamMessage, { type: 'start' }>;
export type ProgressMessage = Extract<StreamMessage, { type: 'progress' }>;
export type DoneMessage = Extract<StreamMessage, { type: 'done' }>;
export type ErrorMessage = Extract<StreamMessage, { type: 'error' }>;

export type ApiError = z.infer<typeof ApiErrorSchema>;

// --- Endpoints ---
// GET  /api/health
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
// POST /api/probe
export type ProbeRequest = z.infer<typeof ProbeRequestSchema>;
export type ProbeResponse = VideoInfo;
// POST /api/compress  → stream NDJSON de StreamMessage (o ApiError con status 400)
export type CompressRequest = z.infer<typeof CompressRequestSchema>;
// POST /api/reveal
export type RevealRequest = z.infer<typeof RevealRequestSchema>;
export type RevealResponse = z.infer<typeof RevealResponseSchema>;
// POST /api/pick  → abre el selector de archivos nativo
export type PickResponse = z.infer<typeof PickResponseSchema>;
// POST /api/locate  → busca en el disco un archivo soltado en la página
export type LocateRequest = z.infer<typeof LocateRequestSchema>;
export type LocateResponse = z.infer<typeof LocateResponseSchema>;

// --- Presets por destino ---
export type PresetId = 'vertical' | 'x' | 'linkedin' | 'whatsapp' | 'web' | 'max';

export interface PlatformLimits {
  /** Resolución recomendada, solo informativa (ej. "1080×1920"). */
  resolution: string;
  /** Duración máxima en segundos; null si no aplica. */
  maxDuration: number | null;
  /** Peso máximo en bytes; null si no aplica. */
  maxSize: number | null;
  /** FPS máximos que acepta la plataforma; null si no aplica. */
  maxFps: number | null;
}

export interface Preset {
  id: PresetId;
  label: string;
  description: string;
  /** Plataforma o uso de destino. */
  platform: string;
  settings: CompressSettings;
  limits: PlatformLimits;
}

// --- Cliente ---
export type Status = 'idle' | 'probing' | 'running' | 'done' | 'error';
