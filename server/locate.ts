import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { LocateRequest } from '../shared/types.js';

// Cuando se suelta un archivo en la página, el navegador solo da su nombre, tamaño y
// fecha de modificación, nunca la ruta. Como el servidor corre en la misma máquina,
// lo buscamos en el disco: primero con Spotlight (macOS) y si no, recorriendo las
// carpetas habituales. Coincide si el nombre y el tamaño son iguales; entre varios
// candidatos gana el de fecha más cercana.

/** Diferencia de fecha tolerada: algunos sistemas de archivos guardan segundos, no ms. */
const MTIME_TOLERANCE_MS = 2000;
const SPOTLIGHT_TIMEOUT_MS = 5000;
const WALK_MAX_DEPTH = 4;
const WALK_MAX_ENTRIES = 50_000;
const WALK_ROOTS = ['Desktop', 'Downloads', 'Movies', 'Videos', 'Documents', 'Pictures'];
const WALK_SKIP = new Set(['node_modules', 'Library', 'AppData']);

interface Candidate {
  path: string;
  mtimeDiff: number;
}

async function check(file: string, target: LocateRequest): Promise<Candidate | null> {
  try {
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size !== target.size) return null;
    return { path: file, mtimeDiff: Math.abs(stat.mtimeMs - target.lastModified) };
  } catch {
    return null;
  }
}

/** El más cercano en fecha; si ninguno está dentro de la tolerancia, igual sirve si es el único. */
function best(candidates: Candidate[]): string | null {
  const sorted = [...candidates].sort((a, b) => a.mtimeDiff - b.mtimeDiff);
  const first = sorted[0];
  if (!first) return null;
  if (first.mtimeDiff <= MTIME_TOLERANCE_MS || sorted.length === 1) return first.path;
  return null;
}

/** Rutas que Spotlight conoce con ese nombre. Lista vacía si no hay mdfind o falla. */
function spotlight(name: string): Promise<string[]> {
  if (process.platform !== 'darwin') return Promise.resolve([]);
  return new Promise((resolve) => {
    // Sin shell: el nombre va como un único argumento
    const p = spawn('mdfind', ['-name', name], { timeout: SPOTLIGHT_TIMEOUT_MS });
    let out = '';
    p.stdout.on('data', (d: Buffer) => (out += d.toString('utf8')));
    p.on('error', () => resolve([]));
    p.on('close', () => resolve(out.split('\n').filter((line) => path.basename(line) === name)));
  });
}

/** Recorre las carpetas habituales del usuario buscando archivos con ese nombre. */
async function walk(name: string): Promise<string[]> {
  const home = os.homedir();
  const found: string[] = [];
  let visited = 0;
  const queue: { dir: string; depth: number }[] = WALK_ROOTS.map((d) => ({ dir: path.join(home, d), depth: 0 }));
  queue.push({ dir: home, depth: WALK_MAX_DEPTH }); // la raíz del home, sin bajar

  while (queue.length > 0 && visited < WALK_MAX_ENTRIES) {
    const next = queue.shift();
    if (!next) break;
    let entries;
    try {
      entries = await fs.readdir(next.dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      visited++;
      if (entry.name.startsWith('.')) continue;
      const full = path.join(next.dir, entry.name);
      if (entry.isFile() && entry.name === name) found.push(full);
      else if (entry.isDirectory() && next.depth < WALK_MAX_DEPTH && !WALK_SKIP.has(entry.name)) {
        queue.push({ dir: full, depth: next.depth + 1 });
      }
    }
  }
  return found;
}

/** Devuelve la ruta del archivo, o null si no se encontró. */
export async function locateFile(target: LocateRequest): Promise<string | null> {
  // El nombre viene del navegador: nunca debería traer separadores, pero por las dudas
  if (target.name !== path.basename(target.name)) return null;

  for (const search of [spotlight, walk]) {
    const paths = [...new Set(await search(target.name))];
    const candidates = (await Promise.all(paths.map((p) => check(p, target)))).filter(
      (c): c is Candidate => c !== null,
    );
    const match = best(candidates);
    if (match) return match;
  }
  return null;
}
