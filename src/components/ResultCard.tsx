import { useState } from 'react';
import { RevealResponseSchema } from '../../shared/schemas';
import type { DoneMessage, RevealRequest } from '../../shared/types';
import { messageOf, postJson } from '../lib/api';
import { formatBytes } from '../lib/format';

interface Props {
  result: DoneMessage;
  warnings: string[];
}

/** Nombre del archivo, sin la carpeta (sirve para rutas de Mac, Linux y Windows). */
const fileName = (p: string): string => p.split(/[\\/]/).pop() ?? p;

export function ResultCard({ result, warnings }: Props) {
  const [error, setError] = useState('');
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
      <p className="out">
        Se guardó junto al original como <strong>{fileName(result.output)}</strong>
      </p>

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
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
