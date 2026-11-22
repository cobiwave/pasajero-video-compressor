import type { FormEvent } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onPick: () => void;
  disabled: boolean;
  probing: boolean;
  picking: boolean;
  error: string;
}

export function PathInput({ value, onChange, onSubmit, onPick, disabled, probing, picking, error }: Props) {
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={submit} className="pathForm">
      <button type="button" className="primary pickButton" onClick={onPick} disabled={disabled || picking || probing}>
        {picking ? 'Esperando selección…' : 'Elegir video…'}
      </button>
      <label htmlFor="path" className="label or">
        o pegá la ruta del video
      </label>
      <div className="row">
        <input
          id="path"
          type="text"
          placeholder="~/Desktop/video.mov"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          spellCheck={false}
          autoComplete="off"
        />
        <button type="submit" className="secondary" disabled={disabled || probing || !value.trim()}>
          {probing ? 'Analizando…' : 'Analizar'}
        </button>
      </div>
      <p className="hint">
        Mac: clic derecho en el archivo + <kbd>⌥ Option</kbd> → “Copiar como nombre de ruta”. Windows:{' '}
        <kbd>Shift</kbd> + clic derecho → “Copiar como ruta”.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
