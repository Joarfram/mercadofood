"use client";
import { useEffect, useState } from "react";
import { DemoState, loadState, saveState } from "./store";

export function useDemoState() {
  const [state, setState] = useState<DemoState>(loadState);
  useEffect(() => {
    const sync = () => setState(loadState());
    window.addEventListener("storage", sync);
    window.addEventListener("mercadofood-state", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("mercadofood-state", sync);
    };
  }, []);
  const update = (next: DemoState | ((current: DemoState) => DemoState)) => {
    const value = typeof next === "function" ? next(loadState()) : next;
    saveState(value);
    setState(value);
  };
  return { state, update };
}
