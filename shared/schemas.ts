import { z } from 'zod';
import { CRF_RANGE, FPS_OPTIONS, WIDTHS, X264_PRESETS } from './constants.js';

// Schemas de zod compartidos. Validan todo lo que viene "de afuera":
// bodies de requests (servidor) y respuestas / mensajes del stream (cliente).

/** z.literal acepta un array de literales: sirve para uniones numéricas. */
const oneOf = <const T extends readonly [number, ...number[]]>(values: T) => z.literal(values);

export const X264PresetSchema = z.enum(X264_PRESETS);
export const WidthSchema = oneOf(WIDTHS);
export const FpsSchema = oneOf(FPS_OPTIONS);

export const CompressSettingsSchema = z.object({
  crf: z.number().int().min(CRF_RANGE.min).max(CRF_RANGE.max),
  fps: FpsSchema,
  width: WidthSchema,
  preset: X264PresetSchema,
  audio: z.boolean(),
});

const InputPath = z.string().trim().min(1, 'Pegá la ruta de un video');

export const ProbeRequestSchema = z.object({ input: InputPath });

export const CompressRequestSchema = CompressSettingsSchema.extend({ input: InputPath });

export const RevealRequestSchema = z.object({ path: z.string().min(1) });

export const VideoInfoSchema = z.object({
  path: z.string(),
  name: z.string(),
  duration: z.number(),
  size: z.number(),
  width: z.number(),
  height: z.number(),
  fps: z.number(),
  codec: z.string(),
  hasAudio: z.boolean(),
});

export const ApiErrorSchema = z.object({ error: z.string() });

export const HealthResponseSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), version: z.string() }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);

export const RevealResponseSchema = z.object({ ok: z.literal(true) });

/** Ruta elegida en el diálogo nativo; null si el usuario canceló. */
export const PickResponseSchema = z.object({ path: z.string().nullable() });

export const StreamMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('start'), output: z.string(), info: VideoInfoSchema, command: z.string() }),
  z.object({
    type: z.literal('progress'),
    percent: z.number().nullable(),
    time: z.number(),
    speed: z.string().nullable(),
  }),
  z.object({ type: z.literal('done'), output: z.string(), size: z.number(), originalSize: z.number() }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);

/** Subconjunto del JSON de ffprobe que usamos. El resto se ignora. */
export const FfprobeOutputSchema = z.object({
  streams: z
    .array(
      z.object({
        codec_type: z.string().optional(),
        codec_name: z.string().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        avg_frame_rate: z.string().optional(),
        r_frame_rate: z.string().optional(),
      }),
    )
    .default([]),
  format: z.object({ duration: z.string().optional(), size: z.string().optional() }).optional(),
});
