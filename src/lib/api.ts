import type { z } from 'zod';
import { ApiErrorSchema } from '../../shared/schemas';

/** Error con un mensaje listo para mostrar en la UI. */
export class ApiRequestError extends Error {}

/** Lee el cuerpo como JSON sin confiar en su forma. */
export async function readJson(r: Response): Promise<unknown> {
  try {
    const data: unknown = await r.json();
    return data;
  } catch {
    return null;
  }
}

/** Si la respuesta no es OK, tira un error con el mensaje del servidor. */
export async function assertOk(r: Response): Promise<void> {
  if (r.ok) return;
  const parsed = ApiErrorSchema.safeParse(await readJson(r));
  throw new ApiRequestError(parsed.success ? parsed.data.error : `El servidor respondió ${r.status}`);
}

/** POST con body JSON; valida la respuesta con el schema dado. */
export async function postJson<S extends z.ZodType>(
  url: string,
  body: unknown,
  schema: S,
  signal?: AbortSignal,
): Promise<z.infer<S>> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  await assertOk(r);
  const parsed = schema.safeParse(await readJson(r));
  if (!parsed.success) throw new ApiRequestError('El servidor devolvió una respuesta inesperada');
  return parsed.data;
}

export const isAbortError = (e: unknown): boolean => e instanceof DOMException && e.name === 'AbortError';

export const messageOf = (e: unknown): string => (e instanceof Error ? e.message : 'Ocurrió un error inesperado');
