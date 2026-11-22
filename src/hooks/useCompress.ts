import { useCallback, useRef, useState } from 'react';
import { StreamMessageSchema } from '../../shared/schemas';
import type { CompressRequest, CompressSettings, DoneMessage, StreamMessage } from '../../shared/types';
import { ApiRequestError, assertOk, isAbortError, messageOf } from '../lib/api';

export type CompressPhase = 'idle' | 'running' | 'done' | 'error';

export interface Progress {
  percent: number;
  time: number;
  speed: string | null;
}

export interface CompressState {
  phase: CompressPhase;
  progress: Progress;
  result: DoneMessage | null;
  error: string;
  compress: (input: string, settings: CompressSettings) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

const INITIAL_PROGRESS: Progress = { percent: 0, time: 0, speed: null };

/** Lee un stream NDJSON y entrega cada línea ya validada. */
async function* readMessages(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamMessage> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line) continue;
      let raw: unknown;
      try {
        raw = JSON.parse(line);
      } catch {
        throw new ApiRequestError('El servidor envió un mensaje ilegible');
      }
      const parsed = StreamMessageSchema.safeParse(raw);
      if (!parsed.success) throw new ApiRequestError('El servidor envió un mensaje inesperado');
      yield parsed.data;
    }
  }
}

/**
 * Comprime con ffmpeg (POST /api/compress) y sigue el progreso por streaming.
 * Cancelar aborta el fetch: el servidor detecta la desconexión, mata ffmpeg y borra el archivo parcial.
 */
export function useCompress(): CompressState {
  const [phase, setPhase] = useState<CompressPhase>('idle');
  const [progress, setProgress] = useState<Progress>(INITIAL_PROGRESS);
  const [result, setResult] = useState<DoneMessage | null>(null);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setPhase('idle');
    setResult(null);
    setError('');
  }, []);

  const compress = useCallback(async (input: string, settings: CompressSettings) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase('running');
    setError('');
    setResult(null);
    setProgress(INITIAL_PROGRESS);

    try {
      const body: CompressRequest = { input, ...settings };
      const r = await fetch('/api/compress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      await assertOk(r);
      if (!r.body) throw new ApiRequestError('El servidor no devolvió datos');

      let finished = false;
      for await (const msg of readMessages(r.body)) {
        switch (msg.type) {
          case 'start':
            break;
          case 'progress':
            setProgress({ percent: msg.percent ?? 0, time: msg.time, speed: msg.speed });
            break;
          case 'done':
            finished = true;
            setResult(msg);
            setPhase('done');
            break;
          case 'error':
            throw new ApiRequestError(msg.message);
        }
      }
      if (!finished) throw new ApiRequestError('La compresión se interrumpió antes de terminar');
    } catch (e) {
      if (isAbortError(e)) {
        setPhase('idle');
      } else {
        setError(messageOf(e));
        setPhase('error');
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  return { phase, progress, result, error, compress, cancel, reset };
}
