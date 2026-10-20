"use client";

import { useEffect } from "react";

export const TOAST_MS = 10_000;

export function Toast({ message, onUndo, onDone }: { message: string; onUndo: () => void; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, TOAST_MS);
    return () => clearTimeout(timer);
  }, [message, onDone]);

  return (
    <div className="toast" role="status">
      <span>{message}</span>
      <button type="button" onClick={onUndo}>Undo</button>
    </div>
  );
}
