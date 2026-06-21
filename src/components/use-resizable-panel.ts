import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Drag-to-resize height for a bottom panel, persisted per page in localStorage.
 * Returns the current height and a pointer-down handler for a top-edge grip;
 * dragging up grows the panel, down shrinks it.
 */
export function useResizablePanel(storageKey: string, initial = 320, min = 140) {
  const [height, setHeight] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    const n = saved ? Number(saved) : Number.NaN;
    return Number.isFinite(n) ? n : initial;
  });
  const start = useRef<{ y: number; h: number } | null>(null);
  const latest = useRef(height);
  latest.current = height;

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!start.current) return;
      const dy = start.current.y - e.clientY; // up = positive → taller
      const max = window.innerHeight - 120;
      setHeight(Math.min(Math.max(start.current.h + dy, min), max));
    },
    [min],
  );

  const onPointerUp = useCallback(() => {
    start.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    document.body.style.userSelect = "";
    localStorage.setItem(storageKey, String(Math.round(latest.current)));
  }, [onPointerMove, storageKey]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      start.current = { y: e.clientY, h: latest.current };
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [onPointerMove, onPointerUp],
  );

  useEffect(
    () => () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    },
    [onPointerMove, onPointerUp],
  );

  return { height, onPointerDown };
}
