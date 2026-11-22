import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ZodError } from 'zod';
import {
  CompressRequestSchema,
  FfprobeOutputSchema,
  LocateRequestSchema,
  ProbeRequestSchema,
  RevealRequestSchema,
} from '../shared/schemas.js';
import type {
  ApiError,
  CompressRequest,
  HealthResponse,
  LocateResponse,
  PickResponse,
  ProbeResponse,
  RevealResponse,
  StreamMessage,
  VideoInfo,
} from '../shared/types.js';
import { locateFile } from './locate.js';
import { pickVideoFile } from './picker.js';

const PORT = Number(process.env.PORT) || 5174;
const app = express();
app.use(express.json());

// Archivos generados en esta sesión (solo estos se pueden "mostrar en carpeta")
const outputs = new Set<string>();

// --- Utilidades ---

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

const isErrnoCode = (e: unknown, code: string): boolean =>
  e instanceof Error && 'code' in e && e.code === code;

const lastLine = (s: string): string => s.trim().split('\n').filter(Boolean).pop() ?? '';

// Mensajes en español para los errores de validación, según el campo que falló
const FIELD_ERRORS: Record<string, string> = {
  input: 'Elige un video',
  name: 'Falta el nombre del archivo',
  size: 'Tamaño de archivo inválido',
  lastModified: 'Fecha de archivo inválida',
  path: 'Falta la ruta del archivo',
  crf: 'CRF fuera de rango (16–36)',
  preset: 'Preset inválido',
  width: 'Ancho inválido',
  fps: 'FPS inválido',
  audio: 'El campo "audio" tiene que ser true o false',
};

function validationError(error: ZodError): ApiError {
  const field = error.issues[0]?.path[0];
  return { error: (typeof field === 'string' && FIELD_ERRORS[field]) || 'El pedido no es válido' };
}

// Mensajes para el usuario: sin nombres de herramientas ni detalles técnicos.
// El detalle técnico va a la consola del servidor.
const MISSING_TOOL = 'Falta un componente necesario para comprimir videos. Revisa las instrucciones de instalación.';
const UNREADABLE = 'No se pudo abrir este video. Puede que el archivo esté dañado o que no sea un video.';

// Ejecuta un comando y devuelve stdout (sin shell: los argumentos no se interpretan)
const run = (cmd: string, args: readonly string[]): Promise<string> =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let out = '';
    let err = '';
    p.stdout.on('data', (d: Buffer) => (out += d.toString()));
    p.stderr.on('data', (d: Buffer) => (err += d.toString()));
    p.on('error', (e) => reject(isErrnoCode(e, 'ENOENT') ? new Error(MISSING_TOOL) : e));
    p.on('close', (code) =>
      code === 0 ? resolve(out) : reject(new Error(lastLine(err) || `${cmd} terminó con código ${code}`)),
    );
  });

// Acepta rutas pegadas desde Finder/Explorer/Terminal: comillas, "\ ", ~ y file://
function cleanPath(raw: string): string {
  let p = raw.trim().replace(/^['"]|['"]$/g, '');
  if (!/^[a-zA-Z]:\\/.test(p)) p = p.replace(/\\ /g, ' ');
  if (p.startsWith('file://')) p = fileURLToPath(p);
  return p.replace(/^~(?=$|[\\/])/, os.homedir());
}

function resolveInput(raw: string): string {
  const p = path.resolve(cleanPath(raw));
  if (!fs.existsSync(p)) throw new Error('No se encontró el archivo');
  if (!fs.statSync(p).isFile()) throw new Error('Eso es una carpeta, no un video');
  return p;
}

function parseFrameRate(rate: string | undefined): number {
  const [n = 0, d = 0] = (rate ?? '0/1').split('/').map(Number);
  return d ? Math.round((n / d) * 100) / 100 : 0;
}

async function probe(input: string): Promise<VideoInfo> {
  let raw: unknown;
  try {
    raw = JSON.parse(
      await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', input]),
    );
  } catch (e) {
    if (e instanceof Error && e.message === MISSING_TOOL) throw e;
    console.error(`ffprobe falló con ${input}:`, errorMessage(e));
    throw new Error(UNREADABLE);
  }
  const parsed = FfprobeOutputSchema.safeParse(raw);
  if (!parsed.success) throw new Error(UNREADABLE);
  const { streams, format } = parsed.data;

  const v = streams.find((s) => s.codec_type === 'video');
  if (!v || !v.width || !v.height) throw new Error('Este archivo no contiene video');
  const rate = v.avg_frame_rate && v.avg_frame_rate !== '0/0' ? v.avg_frame_rate : v.r_frame_rate;

  return {
    path: input,
    name: path.basename(input),
    duration: Number(format?.duration) || 0,
    size: Number(format?.size) || fs.statSync(input).size,
    width: v.width,
    height: v.height,
    fps: parseFrameRate(rate),
    codec: v.codec_name ?? 'desconocido',
    hasAudio: streams.some((s) => s.codec_type === 'audio'),
  };
}

function uniqueOutput(input: string): string {
  const dir = path.dirname(input);
  const base = path.basename(input, path.extname(input));
  let out = path.join(dir, `${base}-compressed.mp4`);
  for (let i = 2; fs.existsSync(out); i++) out = path.join(dir, `${base}-compressed-${i}.mp4`);
  return out;
}

function buildArgs(info: VideoInfo, opts: CompressRequest, output: string): string[] {
  // Solo reducimos: nunca escalamos hacia arriba ni duplicamos frames
  const filters: string[] = [];
  if (opts.width && info.width > opts.width) filters.push(`scale=${opts.width}:-2`);
  else if (info.width % 2 || info.height % 2) filters.push('scale=trunc(iw/2)*2:trunc(ih/2)*2');
  if (opts.fps && info.fps > opts.fps + 0.5) filters.push(`fps=${opts.fps}`);

  return [
    '-hide_banner', '-y',
    '-i', info.path,
    ...(filters.length ? ['-vf', filters.join(',')] : []),
    '-c:v', 'libx264',
    '-crf', String(opts.crf),
    '-preset', opts.preset,
    '-pix_fmt', 'yuv420p',
    ...(opts.audio && info.hasAudio ? ['-c:a', 'aac', '-b:a', '128k'] : ['-an']),
    '-movflags', '+faststart',
    '-progress', 'pipe:1', '-nostats',
    output,
  ];
}

// --- Endpoints ---

app.get('/api/health', async (_req, res: Response<HealthResponse>) => {
  try {
    const v = await run('ffmpeg', ['-hide_banner', '-version']);
    res.json({ ok: true, version: v.split('\n')[0] ?? 'ffmpeg' });
  } catch (e) {
    console.error('ffmpeg no está disponible:', errorMessage(e));
    res.json({ ok: false, error: MISSING_TOOL });
  }
});

app.post('/api/probe', async (req: Request, res: Response<ProbeResponse | ApiError>) => {
  const body: unknown = req.body;
  const parsed = ProbeRequestSchema.safeParse(body);
  if (!parsed.success) return void res.status(400).json(validationError(parsed.error));
  try {
    res.json(await probe(resolveInput(parsed.data.input)));
  } catch (e) {
    res.status(400).json({ error: errorMessage(e) });
  }
});

app.post('/api/compress', async (req: Request, res: Response<ApiError>) => {
  const body: unknown = req.body;
  const parsed = CompressRequestSchema.safeParse(body);
  if (!parsed.success) return void res.status(400).json(validationError(parsed.error));
  const opts = parsed.data;

  let info: VideoInfo;
  try {
    info = await probe(resolveInput(opts.input));
  } catch (e) {
    return void res.status(400).json({ error: errorMessage(e) });
  }

  const output = uniqueOutput(info.path);
  const args = buildArgs(info, opts, output);

  res.writeHead(200, {
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no',
  });
  const send = (msg: StreamMessage) => res.write(JSON.stringify(msg) + '\n');
  send({ type: 'start', output, info, command: ['ffmpeg', ...args.slice(0, -4), output].join(' ') });

  const ff = spawn('ffmpeg', args);
  let buf = '';
  let errTail = '';
  let block: Record<string, string> = {};
  let cancelled = false;
  let finished = false;

  ff.stdout.on('data', (chunk: Buffer) => {
    buf += chunk.toString();
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const i = line.indexOf('=');
      if (i < 0) continue;
      const k = line.slice(0, i).trim();
      const v = line.slice(i + 1).trim();
      block[k] = v;
      if (k === 'progress') {
        const us = Number(block.out_time_us ?? block.out_time_ms);
        const t = Number.isFinite(us) && us > 0 ? us / 1e6 : 0;
        send({
          type: 'progress',
          percent: info.duration ? Math.min(99.9, (t / info.duration) * 100) : null,
          time: t,
          speed: block.speed && block.speed !== 'N/A' ? block.speed : null,
        });
        block = {};
      }
    }
  });

  ff.stderr.on('data', (d: Buffer) => (errTail = (errTail + d.toString()).slice(-4000)));

  ff.on('error', (e) => {
    finished = true;
    console.error('No se pudo iniciar ffmpeg:', e.message);
    send({ type: 'error', message: isErrnoCode(e, 'ENOENT') ? MISSING_TOOL : 'No se pudo comprimir el video' });
    res.end();
  });

  ff.on('close', (code) => {
    if (finished) return;
    finished = true;
    if (cancelled) {
      fs.rm(output, { force: true }, () => {});
      return;
    }
    if (code === 0) {
      outputs.add(output);
      send({ type: 'done', output, size: fs.statSync(output).size, originalSize: info.size });
    } else {
      fs.rm(output, { force: true }, () => {});
      console.error(`ffmpeg terminó con código ${code}:`, lastLine(errTail));
      send({ type: 'error', message: 'No se pudo comprimir el video. Prueba con otro destino o con otro archivo.' });
    }
    res.end();
  });

  // Si el cliente cancela (cierra la conexión), matamos ffmpeg y borramos el archivo parcial
  res.on('close', () => {
    if (!finished && ff.exitCode === null) {
      cancelled = true;
      ff.kill('SIGKILL');
    }
  });
});

app.post('/api/reveal', (req: Request, res: Response<RevealResponse | ApiError>) => {
  const body: unknown = req.body;
  const parsed = RevealRequestSchema.safeParse(body);
  const p = parsed.success ? parsed.data.path : '';
  if (!outputs.has(p) || !fs.existsSync(p)) return void res.status(404).json({ error: 'Archivo no encontrado' });
  const [cmd, args]: [string, string[]] =
    process.platform === 'darwin'
      ? ['open', ['-R', p]]
      : process.platform === 'win32'
        ? ['explorer', [`/select,${p}`]]
        : ['xdg-open', [path.dirname(p)]];
  spawn(cmd, args, { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
  res.json({ ok: true });
});

// Abre el selector de archivos nativo (Finder / Explorador) y devuelve la ruta elegida.
// Un solo diálogo a la vez; si el cliente se desconecta, se cierra el diálogo.
let picking = false;
app.post('/api/pick', async (_req, res: Response<PickResponse | ApiError>) => {
  if (picking) return void res.status(409).json({ error: 'Ya hay un selector de archivos abierto' });
  picking = true;
  const controller = new AbortController();
  res.on('close', () => controller.abort());
  try {
    res.json({ path: await pickVideoFile(controller.signal) });
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: errorMessage(e) });
  } finally {
    picking = false;
  }
});

// Busca en el disco un archivo soltado en la página (el navegador no expone su ruta)
app.post('/api/locate', async (req: Request, res: Response<LocateResponse | ApiError>) => {
  const body: unknown = req.body;
  const parsed = LocateRequestSchema.safeParse(body);
  if (!parsed.success) return void res.status(400).json(validationError(parsed.error));
  try {
    res.json({ path: await locateFile(parsed.data) });
  } catch (e) {
    res.status(500).json({ error: errorMessage(e) });
  }
});

// Rutas /api desconocidas → JSON, no el index.html
app.use('/api', (_req, res: Response<ApiError>) => {
  res.status(404).json({ error: 'Endpoint inexistente' });
});

// JSON mal formado (u otro error de Express) → ApiError en español
const onError: ErrorRequestHandler = (err: unknown, _req, res: Response<ApiError>, next) => {
  if (res.headersSent) return next(err);
  const isBadJson = err instanceof SyntaxError || (err instanceof Error && 'type' in err && err.type === 'entity.parse.failed');
  res.status(isBadJson ? 400 : 500).json({ error: isBadJson ? 'El body no es un JSON válido' : 'Error interno del servidor' });
};

// --- Producción: servimos la UI compilada (npm run build && npm start) ---

// Buscamos la raíz del proyecto: funciona tanto con tsx (server/) como compilado (dist-server/server/)
function findRoot(dir: string): string {
  if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
  const parent = path.dirname(dir);
  return parent === dir ? process.cwd() : findRoot(parent);
}
const dist = path.join(findRoot(path.dirname(fileURLToPath(import.meta.url))), 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(onError);

// Solo escucha en localhost: nadie más en tu red puede usarlo
app.listen(PORT, '127.0.0.1', () => {
  console.log(`API lista en http://127.0.0.1:${PORT}`);
  if (fs.existsSync(dist)) console.log(`Abre http://127.0.0.1:${PORT} en el navegador`);
});
