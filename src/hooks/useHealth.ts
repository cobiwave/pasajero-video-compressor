import { useEffect, useState } from 'react';
import { HealthResponseSchema } from '../../shared/schemas';
import type { HealthResponse } from '../../shared/types';
import { readJson } from '../lib/api';

const OFFLINE: HealthResponse = { ok: false, error: 'No se pudo conectar con el servidor local' };

/** Chequea que el servidor esté arriba y que ffmpeg esté instalado. null = todavía cargando. */
export function useHealth(): HealthResponse | null {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/health', { signal: controller.signal })
      .then(readJson)
      .then((data) => {
        const parsed = HealthResponseSchema.safeParse(data);
        setHealth(parsed.success ? parsed.data : OFFLINE);
      })
      .catch(() => {
        if (!controller.signal.aborted) setHealth(OFFLINE);
      });
    return () => controller.abort();
  }, []);

  return health;
}
