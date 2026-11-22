import { useCallback, useState } from 'react';
import { VIDEO_EXTENSIONS } from '../../shared/constants';
import { LocateResponseSchema, PickResponseSchema } from '../../shared/schemas';
import type { LocateRequest } from '../../shared/types';
import { messageOf, postJson } from '../lib/api';

export interface PickFileState {
  /** Esperando el diálogo nativo o buscando un archivo soltado. */
  busy: boolean;
  error: string;
  /** Abre el Finder / Explorador. Devuelve la ruta elegida, o null si se canceló o falló. */
  pick: () => Promise<string | null>;
  /** Busca en el disco un archivo soltado en la página. Devuelve su ruta, o null. */
  locate: (file: File) => Promise<string | null>;
}

const isVideo = (file: File): boolean => {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return file.type.startsWith('video/') || VIDEO_EXTENSIONS.some((e) => e === ext);
};

/**
 * Consigue la ruta real de un video: con el selector nativo (POST /api/pick) o, si se
 * soltó un archivo, buscándolo en el disco por nombre, tamaño y fecha (POST /api/locate).
 */
export function usePickFile(): PickFileState {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const request = useCallback(async (run: () => Promise<string | null>) => {
    setBusy(true);
    setError('');
    try {
      return await run();
    } catch (e) {
      setError(messageOf(e));
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const pick = useCallback(
    () => request(async () => (await postJson('/api/pick', {}, PickResponseSchema)).path),
    [request],
  );

  const locate = useCallback(
    (file: File) => {
      if (!isVideo(file)) {
        setError(`“${file.name}” no parece un video`);
        return Promise.resolve(null);
      }
      return request(async () => {
        const body: LocateRequest = { name: file.name, size: file.size, lastModified: file.lastModified };
        const { path } = await postJson('/api/locate', body, LocateResponseSchema);
        if (!path) setError(`No se encontró “${file.name}”. Haz clic para elegirlo.`);
        return path;
      });
    },
    [request],
  );

  return { busy, error, pick, locate };
}
