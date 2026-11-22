import { useCallback, useState } from 'react';
import { PickResponseSchema } from '../../shared/schemas';
import { messageOf, postJson } from '../lib/api';

export interface PickFileState {
  picking: boolean;
  error: string;
  /** Abre el Finder / Explorador. Devuelve la ruta elegida, o null si se canceló o falló. */
  pick: () => Promise<string | null>;
}

/** Pide al servidor local que abra el selector de archivos nativo (POST /api/pick). */
export function usePickFile(): PickFileState {
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState('');

  const pick = useCallback(async () => {
    setPicking(true);
    setError('');
    try {
      const { path } = await postJson('/api/pick', {}, PickResponseSchema);
      return path;
    } catch (e) {
      setError(messageOf(e));
      return null;
    } finally {
      setPicking(false);
    }
  }, []);

  return { picking, error, pick };
}
