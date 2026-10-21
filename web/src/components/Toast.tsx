"use client";

import { useEffect, useRef } from "react";

export const TOAST_MS = 10_000;

export function Toast({ message, onUndo, onDone }: { message: string; onUndo: () => void; onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const timer = setTimeout(() => done.current(), TOAST_MS);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <div className="toast" role="status">
      <span>{message}</span>
      <button type="button" onClick={onUndo}>Undo</button>
    </div>
  );
}
