import type { CompressSettings, PlatformLimits, VideoInfo } from '../../shared/types';
import { formatBytes, formatDuration } from './format';

/** Avisos (no bloqueantes) cuando el video o el resultado superan los límites del destino. */
export function limitWarnings(
  limits: PlatformLimits,
  platform: string,
  info: VideoInfo | null,
  settings: CompressSettings,
  outputSize?: number,
): string[] {
  const warnings: string[] = [];
  if (info && limits.maxDuration && info.duration > limits.maxDuration) {
    warnings.push(
      `Dura ${formatDuration(info.duration)}; ${platform} acepta hasta ${formatDuration(limits.maxDuration)}.`,
    );
  }
  if (info && limits.maxFps) {
    const outFps = settings.fps ? Math.min(settings.fps, info.fps) : info.fps;
    if (outFps > limits.maxFps + 0.5) {
      warnings.push(`${platform} acepta hasta ${limits.maxFps} cuadros por segundo. Baja la fluidez en los ajustes.`);
    }
  }
  if (outputSize && limits.maxSize && outputSize > limits.maxSize) {
    warnings.push(
      `Pesa ${formatBytes(outputSize)}; ${platform} acepta hasta ${formatBytes(limits.maxSize)}. Prueba con menos calidad o un tamaño de imagen menor.`,
    );
  }
  return warnings;
}
