import { useState } from 'react';
import { RevealResponseSchema } from '../../shared/schemas';
import type { DoneMessage, RevealRequest } from '../../shared/types';
import { messageOf, postJson } from '../lib/api';
import { formatBytes } from '../lib/format';

interface Props {
  result: DoneMessage;
  command: string;
  warnings: string[];
}

export function ResultCard({ result, command, warnings }: Props) {
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const saved = Math.round((1 - result.size / result.originalSize) * 100);

  const reveal = async () => {
    setError('');
    try {
      const body: RevealRequest = { path: result.output };
      await postJson('/api/reveal', body, RevealResponseSchema);
    } catch (e) {
      setError(messageOf(e));
    }
  };

  const copy = () => {
    navigator.clipboard
      ?.writeText(result.output)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  return (
    <div className="result">
      <div className="sizes">
        <span className="before">{formatBytes(result.originalSize)}</span>
        <span className="arrow" aria-hidden>
          →
        </span>
        <strong>{formatBytes(result.size)}</strong>
        <span className={`badge ${saved < 0 ? 'neg' : ''}`}>{saved >= 0 ? `−${saved}%` : `+${Math.abs(saved)}%`}</span>
      </div>
      <code className="out">{result.output}</code>

      {warnings.length > 0 && (
        <ul className="warnings">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <div className="actions">
        <button type="button" className="primary" onClick={reveal}>
          Mostrar en carpeta
        </button>
        <button type="button" className="secondary" onClick={copy}>
          {copied ? 'Copiada' : 'Copiar ruta'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}

      {command && (
        <details>
          <summary>Comando ffmpeg usado</summary>
          <pre>{command}</pre>
        </details>
      )}
    </div>
  );
}
