import type { FormEvent } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  probing: boolean;
  error: string;
}

export function PathInput({ value, onChange, onSubmit, disabled, probing, error }: Props) {
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={submit} className="pathForm">
      <label htmlFor="path" className="label">
        Ruta del video
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
