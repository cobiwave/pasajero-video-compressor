import express from 'express';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT) || 5174;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

// Archivos generados en esta sesión (solo estos se pueden "mostrar en carpeta")
const outputs = new Set();

const PRESETS = ['ultrafast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower'];
const WIDTHS = [0, 1280, 1920, 2560];
const FPS = [0, 24, 30, 60];

// Ejecuta un comando y devuelve stdout (sin shell: los argumentos no se interpretan)
const run = (cmd, args) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', (e) =>
      reject(e.code === 'ENOENT' ? new Error(`No se encontró "${cmd}". ¿Está instalado ffmpeg?`) : e)
    );
    p.on('close', (code) =>
      code === 0 ? resolve(out) : reject(new Error(lastLine(err) || `${cmd} terminó con código ${code}`))
    );
  });

const lastLine = (s) => s.trim().split('\n').filter(Boolean).pop() || '';

// Acepta rutas pegadas desde Finder/Explorer/Terminal: comillas, "\ " y ~
function cleanPath(raw = '') {
  let p = String(raw).trim().replace(/^['"]|['"]$/g, '');
  if (!/^[a-zA-Z]:\\/.test(p)) p = p.replace(/\\ /g, ' ');
  if (p.startsWith('file://')) p = fileURLToPath(p);
  return p.replace(/^~(?=$|[\\/])/, os.homedir());
}

function resolveInput(raw) {
  const p = path.resolve(cleanPath(raw));
  if (!raw || !fs.existsSync(p)) throw new Error('No existe ningún archivo en esa ruta');
  if (!fs.statSync(p).isFile()) throw new Error('La ruta apunta a una carpeta, no a un video');
  return p;
}

async function probe(input) {
  const json = JSON.parse(
    await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', input])
  );
  const v = (json.streams || []).find((s) => s.codec_type === 'video');
  if (!v) throw new Error('El archivo no tiene una pista de video');
  const [n, d] = (v.avg_frame_rate && v.avg_frame_rate !== '0/0' ? v.avg_frame_rate : v.r_frame_rate || '0/1')
    .split('/')
    .map(Number);
  return {
    path: input,
    name: path.basename(input),
    duration: Number(json.format?.duration) || 0,
    size: Number(json.format?.size) || fs.statSync(input).size,
    width: v.width,
    height: v.height,
    fps: d ? Math.round((n / d) * 100) / 100 : 0,
    codec: v.codec_name,
    hasAudio: json.streams.some((s) => s.codec_type === 'audio'),
  };
}

function uniqueOutput(input) {
  const dir = path.dirname(input);
  const base = path.basename(input, path.extname(input));
  let out = path.join(dir, `${base}-compressed.mp4`);
  for (let i = 2; fs.existsSync(out); i++) out = path.join(dir, `${base}-compressed-${i}.mp4`);
  return out;
}

app.get('/api/health', async (_req, res) => {
  try {
    const v = await run('ffmpeg', ['-hide_banner', '-version']);
    res.json({ ok: true, version: v.split('\n')[0] });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

app.post('/api/probe', async (req, res) => {
  try {
    res.json(await probe(resolveInput(req.body?.input)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/compress', async (req, res) => {
  let info;
  try {
    info = await probe(resolveInput(req.body?.input));
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const crf = Math.round(Number(req.body.crf ?? 26));
  const fps = Number(req.body.fps ?? 60);
  const width = Number(req.body.width ?? 1920);
  const preset = String(req.body.preset ?? 'slow');
  const audio = Boolean(req.body.audio);

  if (!(crf >= 16 && crf <= 36)) return res.status(400).json({ error: 'CRF fuera de rango (16–36)' });
  if (!PRESETS.includes(preset)) return res.status(400).json({ error: 'Preset inválido' });
  if (!WIDTHS.includes(width)) return res.status(400).json({ error: 'Ancho inválido' });
  if (!FPS.includes(fps)) return res.status(400).json({ error: 'FPS inválido' });

  // Solo reducimos: nunca escalamos hacia arriba ni duplicamos frames
  const filters = [];
  if (width && info.width > width) filters.push(`scale=${width}:-2`);
  else if (info.width % 2 || info.height % 2) filters.push('scale=trunc(iw/2)*2:trunc(ih/2)*2');
  if (fps && info.fps > fps + 0.5) filters.push(`fps=${fps}`);

  const output = uniqueOutput(info.path);
  const args = [
    '-hide_banner', '-y',
    '-i', info.path,
    ...(filters.length ? ['-vf', filters.join(',')] : []),
    '-c:v', 'libx264',
    '-crf', String(crf),
    '-preset', preset,
    '-pix_fmt', 'yuv420p',
    ...(audio && info.hasAudio ? ['-c:a', 'aac', '-b:a', '128k'] : ['-an']),
    '-movflags', '+faststart',
    '-progress', 'pipe:1', '-nostats',
    output,
  ];

  res.writeHead(200, {
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no',
  });
  const send = (msg) => res.write(JSON.stringify(msg) + '\n');
  send({ type: 'start', output, info, command: ['ffmpeg', ...args.slice(0, -4), output].join(' ') });

  const ff = spawn('ffmpeg', args);
  let buf = '';
  let errTail = '';
  let block = {};
  let cancelled = false;
  let finished = false;

  ff.stdout.on('data', (chunk) => {
    buf += chunk;
    const lines = buf.split('\n');
    buf = lines.pop();
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

  ff.stderr.on('data', (d) => (errTail = (errTail + d).slice(-4000)));

  ff.on('error', (e) => {
    finished = true;
    send({ type: 'error', message: e.code === 'ENOENT' ? 'No se encontró ffmpeg en el sistema' : e.message });
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
      send({ type: 'error', message: lastLine(errTail) || `ffmpeg terminó con código ${code}` });
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

app.post('/api/reveal', (req, res) => {
  const p = req.body?.path;
  if (!outputs.has(p) || !fs.existsSync(p)) return res.status(404).json({ error: 'Archivo no encontrado' });
  const [cmd, args] =
    process.platform === 'darwin'
      ? ['open', ['-R', p]]
      : process.platform === 'win32'
        ? ['explorer', [`/select,${p}`]]
        : ['xdg-open', [path.dirname(p)]];
  spawn(cmd, args, { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
  res.json({ ok: true });
});

// En modo producción (npm run build && npm start) servimos la UI desde acá
const dist = path.join(__dirname, 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// Solo escucha en localhost: nadie más en tu red puede usarlo
app.listen(PORT, '127.0.0.1', () => {
  console.log(`API lista en http://127.0.0.1:${PORT}`);
  if (fs.existsSync(dist)) console.log(`Abrí http://127.0.0.1:${PORT} en el navegador`);
});
