import { useCallback, useRef, useState } from 'react';
import { VideoInfoSchema } from '../../shared/schemas';
import type { ProbeRequest, VideoInfo } from '../../shared/types';
import { isAbortError, messageOf, postJson } from '../lib/api';

export interface ProbeState {
  info: VideoInfo | null;
  probing: boolean;
  error: string;
  analyze: (input: string) => Promise<void>;
}

/** Analiza un video con ffprobe (POST /api/probe). */
export function useProbe(): ProbeState {
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [probing, setProbing] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const analyze = useCallback(async (input: string) => {
    if (!input.trim()) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setProbing(true);
    setError('');
    setInfo(null);
    try {
      const body: ProbeRequest = { input };
      setInfo(await postJson('/api/probe', body, VideoInfoSchema, controller.signal));
    } catch (e) {
      if (!isAbortError(e)) setError(messageOf(e));
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setProbing(false);
      }
    }
  }, []);

  return { info, probing, error, analyze };
}
