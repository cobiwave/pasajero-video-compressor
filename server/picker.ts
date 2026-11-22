import { spawn } from 'node:child_process';

// Abre el diálogo nativo del sistema para elegir un video y devuelve su ruta absoluta.
// El navegador no expone rutas reales de archivos; como el servidor corre en la misma
// máquina, abrimos el diálogo desde acá. Los comandos son fijos: no reciben input del usuario.

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'm4v', 'mkv', 'webm', 'avi', 'mts', 'm2ts', 'wmv', 'flv', 'mpg', 'mpeg'];

interface Command {
  cmd: string;
  args: string[];
  /** Códigos de salida que significan "el usuario canceló". */
  cancelCodes: number[];
}

// macOS: `activate` trae el diálogo de osascript al frente; cancelar sale con código 1 (error -128)
const MAC_SCRIPT = [
  'activate',
  'POSIX path of (choose file with prompt "Elegí un video para comprimir" of type {"public.movie", "public.mpeg-4", "com.apple.quicktime-movie", "org.matroska.mkv", "org.webmproject.webm"})',
];

// Windows: OpenFileDialog de .NET con una ventana dueña "TopMost" para que aparezca adelante del navegador
const WIN_SCRIPT = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
$owner = New-Object System.Windows.Forms.Form -Property @{ TopMost = $true; ShowInTaskbar = $false }
$d = New-Object System.Windows.Forms.OpenFileDialog
$d.Title = 'Elegí un video para comprimir'
$d.Filter = 'Videos|${VIDEO_EXTENSIONS.map((e) => `*.${e}`).join(';')}|Todos los archivos|*.*'
if ($d.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $d.FileName; exit 0 }
exit 1
`;

function commandsFor(platform: NodeJS.Platform): Command[] {
  if (platform === 'darwin') {
    return [{ cmd: 'osascript', args: MAC_SCRIPT.flatMap((line) => ['-e', line]), cancelCodes: [1] }];
  }
  if (platform === 'win32') {
    return [{ cmd: 'powershell.exe', args: ['-NoProfile', '-STA', '-Command', WIN_SCRIPT], cancelCodes: [1] }];
  }
  // Linux: probamos zenity y, si no está, kdialog
  return [
    {
      cmd: 'zenity',
      args: [
        '--file-selection',
        '--title=Elegí un video para comprimir',
        `--file-filter=Videos | ${VIDEO_EXTENSIONS.map((e) => `*.${e}`).join(' ')}`,
        '--file-filter=Todos los archivos | *',
      ],
      cancelCodes: [1],
    },
    {
      cmd: 'kdialog',
      args: ['--getopenfilename', '.', VIDEO_EXTENSIONS.map((e) => `*.${e}`).join(' ')],
      cancelCodes: [1],
    },
  ];
}

class NotFound extends Error {}

function runDialog({ cmd, args, cancelCodes }: Command, signal: AbortSignal): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { signal, windowsHide: true });
    let out = '';
    let err = '';
    p.stdout.on('data', (d: Buffer) => (out += d.toString('utf8')));
    p.stderr.on('data', (d: Buffer) => (err += d.toString('utf8')));
    p.on('error', (e) => {
      if (e.name === 'AbortError') resolve(null);
      else if ('code' in e && e.code === 'ENOENT') reject(new NotFound(cmd));
      else reject(e);
    });
    p.on('close', (code) => {
      // Solo sacamos el salto de línea final: la ruta puede terminar en espacios
      const path = out.replace(/\r?\n$/, '');
      if (code === 0 && path) resolve(path);
      else if (code !== null && cancelCodes.includes(code)) resolve(null);
      else if (signal.aborted) resolve(null);
      else reject(new Error(err.trim().split('\n').pop() || `${cmd} terminó con código ${code}`));
    });
  });
}

/** Devuelve la ruta elegida, o null si el usuario canceló. */
export async function pickVideoFile(signal: AbortSignal): Promise<string | null> {
  for (const command of commandsFor(process.platform)) {
    try {
      return await runDialog(command, signal);
    } catch (e) {
      if (e instanceof NotFound) continue;
      throw e;
    }
  }
  throw new Error('No se encontró un selector de archivos en el sistema. En Linux instalá zenity o kdialog.');
}
