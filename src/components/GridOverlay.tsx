import { useEffect } from 'react';
import styles from './GridOverlay.module.css';

const STORAGE_KEY = 'grid-overlay';
const MAX_COLUMNS = 12;

/**
 * Overlay de la grilla, solo en desarrollo (main.tsx lo carga con
 * `import.meta.env.DEV`). Pulsa "g" para mostrarlo u ocultarlo.
 * El estado vive en un atributo de <html> y se recuerda en localStorage.
 */
export function GridOverlay() {
  useEffect(() => {
    const root = document.documentElement;

    const setVisible = (visible: boolean) => {
      root.toggleAttribute('data-grid-overlay', visible);
      try {
        localStorage.setItem(STORAGE_KEY, visible ? '1' : '0');
      } catch {
        // Sin localStorage (ventana privada): solo no se recuerda.
      }
    };

    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') setVisible(true);
    } catch {
      // Ídem.
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'g' || event.metaKey || event.ctrlKey || event.altKey) return;
      const { target } = event;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return;
      }
      setVisible(!root.hasAttribute('data-grid-overlay'));
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      root.removeAttribute('data-grid-overlay');
    };
  }, []);

  return (
    <div className={`container ${styles.overlay}`} aria-hidden="true">
      {Array.from({ length: MAX_COLUMNS }, (_, i) => (
        <div key={i} className={styles.column} />
      ))}
    </div>
  );
}
