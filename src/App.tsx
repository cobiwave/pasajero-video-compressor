import { useState } from 'react';
import { PRESETS } from "../shared/presets";
import type { Status } from "../shared/types";
import { DropZone } from "./components/DropZone";
import { PresetPicker } from "./components/PresetPicker";
import { ProgressBar } from "./components/ProgressBar";
import { ResultCard } from "./components/ResultCard";
import { Section } from "./components/Section";
import { SettingsForm } from "./components/SettingsForm";
import { VideoMeta } from "./components/VideoMeta";
import { useCompress } from "./hooks/useCompress";
import { useHealth } from "./hooks/useHealth";
import { usePickFile } from "./hooks/usePickFile";
import { useProbe } from "./hooks/useProbe";
import { useSettings } from "./hooks/useSettings";
import { limitWarnings } from "./lib/limits";

const STATUS_LABELS: Record<Status, string> = {
	idle: "En espera",
	probing: "Analizando",
	running: "Comprimiendo",
	done: "Listo",
	error: "Error",
};

export default function App() {
	const health = useHealth();
	const probe = useProbe();
	const picker = usePickFile();
	const job = useCompress();
	const { settings, preset, modified, choosePreset, update } = useSettings();
	const [showAdvanced, setShowAdvanced] = useState(false);

	const { info } = probe;
	const running = job.phase === "running";
	const status: Status = probe.probing
		? "probing"
		: running
			? "running"
			: probe.error || job.phase === "error"
				? "error"
				: job.phase === "done"
					? "done"
					: "idle";

	const analyze = (path: string) => {
		job.reset();
		void probe.analyze(path);
	};

	// Clic → Finder / Explorador; archivo soltado → se busca en el disco. Con la ruta, se analiza.
	const choose = async (getPath: Promise<string | null>) => {
		const path = await getPath;
		if (path) analyze(path);
	};

	const warnings = limitWarnings(preset.limits, preset.label, info, settings);
	const resultWarnings = job.result
		? limitWarnings(
				preset.limits,
				preset.label,
				null,
				settings,
				job.result.size,
			)
		: [];

	return (
		<main className="app">
			<header className="container top">
				<p className="wordmark">PASAJERO</p>
				<span className={`status status-${status}`}>
					{STATUS_LABELS[status]}
				</span>
				<h1 className="title">Video Compressor</h1>
				<div className="intro">
					<p>
						Videos ligeros para redes sociales y la web. Tu video nunca sale de
						tu equipo.
					</p>
					{health && !health.ok && (
						<p className="health" role="alert">
							{health.error}
						</p>
					)}
				</div>
			</header>

			<Section index="01" title="Fuente">
				<DropZone
					current={info?.name ?? null}
					onPick={() => void choose(picker.pick())}
					onDropFile={(file) => void choose(picker.locate(file))}
					onDropPath={analyze}
					disabled={running}
					busyLabel={
						picker.busy
							? "Buscando el video…"
							: probe.probing
								? "Analizando…"
								: null
					}
					error={picker.error || probe.error}
				/>
				{info && <VideoMeta info={info} />}
			</Section>

			<Section index="02" title="Destino" aside={preset.platform} dim={!info}>
				<PresetPicker
					presets={PRESETS}
					activeId={preset.id}
					modified={modified}
					onChoose={choosePreset}
					disabled={running}
				/>
			</Section>

			<Section index="03" title="Comprimir" dim={!info}>
				<button
					type="button"
					className="toggle"
					aria-expanded={showAdvanced}
					onClick={() => setShowAdvanced((v) => !v)}
				>
					Ajustes avanzados
				</button>
				{showAdvanced && (
					<SettingsForm settings={settings} update={update} disabled={running} />
				)}

				{warnings.length > 0 && (
					<ul className="warnings">
						{warnings.map((w) => (
							<li key={w}>{w}</li>
						))}
					</ul>
				)}

				<div className="actions">
					{running ? (
						<button type="button" className="danger" onClick={job.cancel}>
							Cancelar
						</button>
					) : (
						<button
							type="button"
							className="primary"
							onClick={() => info && void job.compress(info.path, settings)}
							disabled={!info || !health?.ok}
						>
							Comprimir video
						</button>
					)}
				</div>

				{running && (
					<ProgressBar progress={job.progress} duration={info?.duration ?? 0} />
				)}
				{job.error && (
					<p className="error" role="alert">
						{job.error}
					</p>
				)}
			</Section>

			{job.result && (
				<Section index="04" title="Salida" className="done">
					<ResultCard result={job.result} warnings={resultWarnings} />
				</Section>
			)}

			<footer className="container foot">
				<p>PASAJERO STUDIO</p>
			</footer>
		</main>
	);
}
