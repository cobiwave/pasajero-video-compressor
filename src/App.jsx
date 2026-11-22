import { useEffect, useRef, useState } from "react";

const PRESETS = {
	linkedin: {
		label: "LinkedIn",
		hint: "Recomendado",
		crf: 26,
		fps: 60,
		width: 1920,
		preset: "slow",
		audio: false,
	},
	light: {
		label: "Más liviano",
		hint: "720p · 30 fps",
		crf: 28,
		fps: 30,
		width: 1280,
		preset: "slow",
		audio: false,
	},
	quality: {
		label: "Más calidad",
		hint: "Pesa más",
		crf: 23,
		fps: 60,
		width: 1920,
		preset: "slow",
		audio: false,
	},
};

const STORAGE_KEY = "video-compressor:settings";

const loadSettings = () => {
	try {
		return {
			...PRESETS.linkedin,
			...JSON.parse(localStorage.getItem(STORAGE_KEY)),
		};
	} catch {
		return PRESETS.linkedin;
	}
};

const formatBytes = (b) => {
	if (!b && b !== 0) return "—";
	const u = ["B", "KB", "MB", "GB"];
	const i = Math.min(
		u.length - 1,
		Math.floor(Math.log(Math.max(b, 1)) / Math.log(1024)),
	);
	return `${(b / 1024 ** i).toFixed(i > 1 ? 1 : 0)} ${u[i]}`;
};

const formatTime = (s) => {
	if (!s) return "0:00";
	const m = Math.floor(s / 60);
	return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

export default function App() {
	const [health, setHealth] = useState(null);
	const [input, setInput] = useState("");
	const [info, setInfo] = useState(null);
	const [settings, setSettings] = useState(loadSettings);
	const [status, setStatus] = useState("idle"); // idle | probing | running | done | error
	const [error, setError] = useState("");
	const [progress, setProgress] = useState({ percent: 0, speed: null });
	const [result, setResult] = useState(null);
	const [command, setCommand] = useState("");
	const abortRef = useRef(null);

	useEffect(() => {
		fetch("/api/health")
			.then((r) => r.json())
			.then(setHealth)
			.catch(() =>
				setHealth({
					ok: false,
					error: "No se pudo conectar con el servidor local",
				}),
			);
	}, []);

	useEffect(() => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
		} catch {}
	}, [settings]);

	const activePreset = Object.entries(PRESETS).find(([, p]) =>
		["crf", "fps", "width", "preset", "audio"].every(
			(k) => p[k] === settings[k],
		),
	)?.[0];

	const update = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

	async function analyze(e) {
		e?.preventDefault();
		if (!input.trim()) return;
		setStatus("probing");
		setError("");
		setInfo(null);
		setResult(null);
		try {
			const r = await fetch("/api/probe", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ input }),
			});
			const data = await r.json();
			if (!r.ok) throw new Error(data.error);
			setInfo(data);
			setStatus("idle");
		} catch (err) {
			setError(err.message);
			setStatus("error");
		}
	}

	async function compress() {
		const controller = new AbortController();
		abortRef.current = controller;
		setStatus("running");
		setError("");
		setResult(null);
		setProgress({ percent: 0, speed: null });

		try {
			const r = await fetch("/api/compress", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ input: info.path, ...settings }),
				signal: controller.signal,
			});
			if (!r.ok) throw new Error((await r.json()).error);

			const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
			let buf = "";
			for (;;) {
				const { value, done } = await reader.read();
				if (done) break;
				buf += value;
				const lines = buf.split("\n");
				buf = lines.pop();
				for (const line of lines) {
					if (!line) continue;
					const msg = JSON.parse(line);
					if (msg.type === "start") setCommand(msg.command);
					if (msg.type === "progress")
						setProgress({ percent: msg.percent ?? 0, speed: msg.speed });
					if (msg.type === "done") {
						setResult(msg);
						setStatus("done");
					}
					if (msg.type === "error") throw new Error(msg.message);
				}
			}
		} catch (err) {
			if (err.name === "AbortError") {
				setStatus("idle");
			} else {
				setError(err.message);
				setStatus("error");
			}
		} finally {
			abortRef.current = null;
		}
	}

	const cancel = () => abortRef.current?.abort();

	const reveal = () =>
		fetch("/api/reveal", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ path: result.output }),
		});

	const copy = (text) => navigator.clipboard?.writeText(text).catch(() => {});

	const running = status === "running";
	const saved = result
		? Math.round((1 - result.size / result.originalSize) * 100)
		: 0;

	return (
		<main className="app">
			<header className="top">
				<h1>Video Compressor</h1>
				<p className="sub">
					Screen recordings livianos para LinkedIn, con ffmpeg.
				</p>
				{health && (
					<p className={`health ${health.ok ? "ok" : "bad"}`}>
						{health.ok ? health.version : health.error}
					</p>
				)}
			</header>

			<section className="card">
				<form onSubmit={analyze} className="pathForm">
					<label htmlFor="path">Ruta del video</label>
					<div className="row">
						<input
							id="path"
							type="text"
							placeholder="/Users/jacobo/Desktop/grabacion.mov"
							value={input}
							onChange={(e) => setInput(e.target.value)}
							disabled={running}
							spellCheck={false}
							autoComplete="off"
						/>
						<button
							type="submit"
							className="secondary"
							disabled={running || !input.trim()}
						>
							{status === "probing" ? "Analizando…" : "Analizar"}
						</button>
					</div>
					<p className="hint">
						Mac: clic derecho en el archivo + <kbd>⌥ Option</kbd> → “Copiar como
						nombre de ruta”. Windows: <kbd>Shift</kbd> + clic derecho → “Copiar
						como ruta”.
					</p>
				</form>

				{info && (
					<dl className="meta">
						<div>
							<dt>Archivo</dt>
							<dd title={info.path}>{info.name}</dd>
						</div>
						<div>
							<dt>Resolución</dt>
							<dd>
								{info.width}×{info.height}
							</dd>
						</div>
						<div>
							<dt>FPS</dt>
							<dd>{info.fps}</dd>
						</div>
						<div>
							<dt>Duración</dt>
							<dd>{formatTime(info.duration)}</dd>
						</div>
						<div>
							<dt>Peso</dt>
							<dd>{formatBytes(info.size)}</dd>
						</div>
						<div>
							<dt>Audio</dt>
							<dd>{info.hasAudio ? "Sí" : "No"}</dd>
						</div>
					</dl>
				)}
			</section>

			<section className={`card ${!info ? "dim" : ""}`}>
				<h2>Configuración</h2>
				<div className="presets">
					{Object.entries(PRESETS).map(([key, p]) => (
						<button
							key={key}
							type="button"
							className={`preset ${activePreset === key ? "active" : ""}`}
							onClick={() => setSettings({ ...p })}
							disabled={running}
						>
							<strong>{p.label}</strong>
							<span>{p.hint}</span>
						</button>
					))}
				</div>

				<div className="grid">
					<label className="field wide">
						<span>
							Calidad (CRF) <b>{settings.crf}</b>
						</span>
						<input
							type="range"
							min="18"
							max="32"
							value={settings.crf}
							onChange={(e) => update("crf", Number(e.target.value))}
							disabled={running}
						/>
						<small>
							Menor = más calidad y más peso. 23–28 es el rango ideal.
						</small>
					</label>

					<label className="field">
						<span>Ancho máximo</span>
						<select
							value={settings.width}
							onChange={(e) => update("width", Number(e.target.value))}
							disabled={running}
						>
							<option value={1280}>1280 px (720p)</option>
							<option value={1920}>1920 px (1080p)</option>
							<option value={2560}>2560 px (1440p)</option>
							<option value={0}>Original</option>
						</select>
					</label>

					<label className="field">
						<span>FPS máximo</span>
						<select
							value={settings.fps}
							onChange={(e) => update("fps", Number(e.target.value))}
							disabled={running}
						>
							<option value={30}>30 fps</option>
							<option value={60}>60 fps (animaciones fluidas)</option>
							<option value={0}>Original</option>
						</select>
					</label>

					<label className="field">
						<span>Velocidad de compresión</span>
						<select
							value={settings.preset}
							onChange={(e) => update("preset", e.target.value)}
							disabled={running}
						>
							<option value="veryfast">Rápida (archivo más grande)</option>
							<option value="medium">Media</option>
							<option value="slow">Lenta (archivo más chico)</option>
						</select>
					</label>

					<label className="field check">
						<input
							type="checkbox"
							checked={settings.audio}
							onChange={(e) => update("audio", e.target.checked)}
							disabled={running}
						/>
						<span>Mantener audio</span>
					</label>
				</div>

				<div className="actions">
					{running ? (
						<button type="button" className="danger" onClick={cancel}>
							Cancelar
						</button>
					) : (
						<button
							type="button"
							className="primary"
							onClick={compress}
							disabled={!info || !health?.ok}
						>
							Comprimir video
						</button>
					)}
				</div>

				{running && (
					<div
						className="progress"
						role="progressbar"
						aria-valuenow={Math.round(progress.percent)}
					>
						<div className="bar">
							<div style={{ width: `${progress.percent}%` }} />
						</div>
						<p>
							{progress.percent.toFixed(0)}%
							{progress.speed && ` · ${progress.speed}`}
						</p>
					</div>
				)}

				{error && <p className="error">{error}</p>}
			</section>

			{result && (
				<section className="card result">
					<h2>Listo</h2>
					<div className="sizes">
						<span>{formatBytes(result.originalSize)}</span>
						<span className="arrow">→</span>
						<strong>{formatBytes(result.size)}</strong>
						<span className={`badge ${saved < 0 ? "neg" : ""}`}>
							{saved >= 0 ? `−${saved}%` : `+${Math.abs(saved)}%`}
						</span>
					</div>
					<code className="out">{result.output}</code>
					<div className="actions">
						<button type="button" className="primary" onClick={reveal}>
							Mostrar en carpeta
						</button>
						<button
							type="button"
							className="secondary"
							onClick={() => copy(result.output)}
						>
							Copiar ruta
						</button>
					</div>
					{command && (
						<details>
							<summary>Comando ffmpeg usado</summary>
							<pre>{command}</pre>
						</details>
					)}
				</section>
			)}
		</main>
	);
}
