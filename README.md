# PASAJERO Video Compressor

Herramienta local de PASAJERO para comprimir videos con ffmpeg y dejarlos listos para redes sociales o la web.
Pegás la ruta de un video, elegís el destino (Instagram / TikTok, X, LinkedIn, WhatsApp, Web o Máxima calidad),
ajustás lo que quieras y listo: el archivo comprimido queda al lado del original.

Todo corre en tu máquina: el video no se sube a ningún lado.

## Requisitos

- Node.js 18 o superior
- ffmpeg (incluye ffprobe) instalado y disponible en el PATH
  - macOS: `brew install ffmpeg`
  - Windows: `winget install ffmpeg`
  - Linux: `sudo apt install ffmpeg`

## Uso

```bash
npm install
npm run dev
```

Se abre http://localhost:5173.

1. Tocá **Elegir video…** para buscarlo en el Finder (Mac) o el Explorador (Windows); se analiza solo.
   También podés pegar la ruta y tocar **Analizar**: acepta rutas copiadas desde Finder, el Explorador o la
   Terminal (con comillas, `\ `, `~` o `file://`). En Linux, el selector necesita `zenity` o `kdialog`.
2. Elegí un **destino**. Cada uno carga valores recomendados y muestra los límites de la plataforma.
3. Si querés, ajustá a mano la calidad (CRF), el ancho máximo, los FPS, la velocidad y el audio.
   Si el video supera algún límite del destino, la app te avisa (pero no te impide comprimir).
4. Tocá **Comprimir video**. Podés cancelar en cualquier momento: se detiene ffmpeg y se borra el archivo a medio hacer.

El resultado se guarda en la misma carpeta que el original como `nombre-compressed.mp4`
(o `nombre-compressed-2.mp4`, `-3`… si ya existe). La configuración se recuerda entre sesiones.

Para usarla sin el modo de desarrollo:

```bash
npm run build
npm start   # http://127.0.0.1:5174
```

### Scripts

| Script              | Qué hace                                                                |
| ------------------- | ----------------------------------------------------------------------- |
| `npm run dev`       | Servidor (`tsx watch`, puerto 5174) + Vite (puerto 5173) juntos          |
| `npm run typecheck` | `tsc -b`: chequea los tipos del cliente, del servidor y de la config     |
| `npm run build`     | Compila el servidor a `dist-server/` y la UI a `dist/`                   |
| `npm start`         | Sirve la app compilada y la API desde Express                            |

## Cómo funciona

- El servidor (Express) recibe la ruta, lee el video con `ffprobe` y ejecuta `ffmpeg`:
  H.264 (`libx264`), `yuv420p` y `+faststart`. Sin audio, salvo que pidas mantenerlo (AAC 128k).
  El progreso le llega a la UI por streaming (NDJSON).
- Solo reduce la resolución y los FPS: nunca agranda el video ni duplica frames.
- El selector de archivos lo abre el servidor (que corre en tu máquina), porque el navegador no le da a la página
  la ruta real de los archivos: `osascript` en Mac, PowerShell en Windows y `zenity`/`kdialog` en Linux.
- El servidor escucha únicamente en `127.0.0.1`: nadie más en tu red puede usarlo.
- Los comandos se ejecutan sin shell y todos los parámetros se validan con `zod` contra listas cerradas.

## Estructura del proyecto

```
├── index.html              # Entrada de Vite (título y favicon)
├── public/favicon.svg
├── server/
│   ├── index.ts            # API Express: /api/health, /api/pick, /api/probe, /api/compress, /api/reveal
│   └── picker.ts           # Selector de archivos nativo (Finder / Explorador / zenity)
├── shared/                 # Código que usan el cliente y el servidor
│   ├── constants.ts        # Valores permitidos (presets de x264, anchos, FPS, CRF)
│   ├── schemas.ts          # Schemas de zod (requests, respuestas, mensajes del stream, ffprobe)
│   ├── types.ts            # Tipos derivados de las constantes y los schemas
│   └── presets.ts          # Presets por destino y límites de cada plataforma
├── src/
│   ├── main.tsx
│   ├── App.tsx             # Solo compone hooks y componentes
│   ├── App.css
│   ├── hooks/              # useHealth, usePickFile, useProbe, useCompress, useSettings
│   ├── components/         # PathInput, VideoMeta, PresetPicker, SettingsForm, ProgressBar, ResultCard
│   └── lib/                # Cliente HTTP, formato de datos y avisos de límites
├── tsconfig.json           # Raíz con project references
├── tsconfig.app.json       # Cliente (src + shared)
├── tsconfig.node.json      # vite.config.ts
├── tsconfig.server.json    # Servidor (server + shared) → dist-server/
└── vite.config.ts
```

## Límites de las plataformas

Los límites de cada destino están en `shared/presets.ts`. Los de LinkedIn salen de su ayuda oficial;
los demás vienen de fuentes de terceros que no coinciden entre sí, así que se usó el valor más conservador
y quedaron marcados con `TODO: verificar`. Las plataformas cambian sus límites seguido: revisalos de vez en cuando.
