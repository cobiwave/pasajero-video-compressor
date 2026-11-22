# Video Compressor

Interfaz en React para comprimir screen recordings con ffmpeg, pensada para videos de LinkedIn.

## Requisitos

- Node.js 18 o superior
- ffmpeg instalado y disponible en el PATH
  - macOS: `brew install ffmpeg`
  - Windows: `winget install ffmpeg`
  - Linux: `sudo apt install ffmpeg`

## Uso

```bash
npm install
npm run dev
```

Se abre http://localhost:5173. Pegá la ruta del video, tocá **Analizar** y después **Comprimir video**.
El archivo comprimido queda en la misma carpeta que el original, como `nombre-compressed.mp4`.

Para usarlo sin el modo de desarrollo:

```bash
npm run build
npm start   # http://127.0.0.1:5174
```

## Cómo funciona

- `server.js` (Express) recibe la ruta, lee el video con `ffprobe` y ejecuta `ffmpeg` (H.264, yuv420p, `+faststart`).
  El progreso le llega a la UI por streaming.
- Solo reduce la resolución y los FPS: nunca agranda el video ni duplica frames.
- El servidor escucha únicamente en `127.0.0.1`.
- Si cancelás, se detiene ffmpeg y se borra el archivo a medio hacer.
