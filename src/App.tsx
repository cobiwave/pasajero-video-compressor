import { useState } from 'react';
import { PRESETS } from '../shared/presets';
import type { Status } from '../shared/types';
import { PathInput } from './components/PathInput';
import { PresetPicker } from './components/PresetPicker';
import { ProgressBar } from './components/ProgressBar';
import { ResultCard } from './components/ResultCard';
import { Section } from './components/Section';
import { SettingsForm } from './components/SettingsForm';
import { VideoMeta } from './components/VideoMeta';
import { useCompress } from './hooks/useCompress';
import { useHealth } from './hooks/useHealth';
import { useProbe } from './hooks/useProbe';
import { useSettings } from './hooks/useSettings';
import { limitWarnings } from './lib/limits';

const STATUS_LABELS: Record<Status, string> = {
  idle: 'En espera',
  probing: 'Analizando',
  running: 'Comprimiendo',
  done: 'Listo',
  error: 'Error',
};

export default function App() {
  const health = useHealth();
  const [input, setInput] = useState('');
  const probe = useProbe();
  const job = useCompress();
  const { settings, preset, modified, choosePreset, update } = useSettings();

  const { info } = probe;
  const running = job.phase === 'running';
  const status: Status = probe.probing
    ? 'probing'
    : running
      ? 'running'
      : probe.error || job.phase === 'error'
        ? 'error'
        : job.phase === 'done'
          ? 'done'
          : 'idle';

  const analyze = () => {
    job.reset();
    void probe.analyze(input);
  };

  const warnings = limitWarnings(preset.limits, preset.label, info, settings);
  const resultWarnings = job.result
    ? limitWarnings(preset.limits, preset.label, null, settings, job.result.size)
    : [];

  return (
    <main className="app">
      <header className="top">
        <div className="topBar">
          <span className="wordmark">PASAJERO</span>
          <span className={`status status-${status}`}>{STATUS_LABELS[status]}</span>
        </div>
        <h1>
          Video <em>Compressor</em>
        </h1>
        <p className="sub">Videos livianos para redes sociales y la web, con ffmpeg. Todo queda en tu máquina.</p>
        {health && (
          <p className={`health ${health.ok ? 'ok' : 'bad'}`}>{health.ok ? health.version : health.error}</p>
        )}
      </header>

      <Section index="01" title="Fuente">
        <PathInput
          value={input}
          onChange={setInput}
          onSubmit={analyze}
          disabled={running}
          probing={probe.probing}
          error={probe.error}
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

      <Section index="03" title="Ajustes" dim={!info}>
        <SettingsForm settings={settings} update={update} disabled={running} />

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

        {running && <ProgressBar progress={job.progress} duration={info?.duration ?? 0} />}
        {job.error && (
          <p className="error" role="alert">
            {job.error}
          </p>
        )}
      </Section>

      {job.result && (
        <Section index="04" title="Salida" className="done">
          <ResultCard result={job.result} command={job.command} warnings={resultWarnings} />
        </Section>
      )}

      <footer className="foot">PASAJERO · Estudio de cine y fotografía</footer>
    </main>
  );
}
