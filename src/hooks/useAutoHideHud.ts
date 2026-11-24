import { useEffect, useState } from 'react';

/**
 * Automatically fades out secondary HUD controls after `delayMs` of inactivity
 * while Demo Drive is actively playing, revealing them immediately on pointer/touch/key input.
 */
export function useAutoHideHud(isDriving: boolean, delayMs = 4200): boolean {
  const [isIdle, setIsIdle] = useState(false);

  useEffect(() => {
    if (!isDriving) {
      setIsIdle(false);
      return;
    }

    let timeoutId: number | undefined;

    const resetTimer = () => {
      setIsIdle(false);
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => {
        setIsIdle(true);
      }, delayMs);
    };

    resetTimer();

    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'touchstart',
      'keydown',
      'wheel',
    ];

    events.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));

    return () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [isDriving, delayMs]);

  return isIdle;
}
