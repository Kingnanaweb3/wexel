"use client";

import { useCallback, useEffect, useState } from "react";

// Starred stocks, kept on this device.
const KEY = "wexel-watchlist";

function read(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}

export function useWatchlist() {
  const [list, setList] = useState<string[]>([]);

  useEffect(() => {
    setList(read());
    const sync = () => setList(read());
    window.addEventListener("wexel-watchlist", sync);
    return () => window.removeEventListener("wexel-watchlist", sync);
  }, []);

  const toggle = useCallback((id: string) => {
    const cur = read();
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
    window.dispatchEvent(new Event("wexel-watchlist"));
  }, []);

  return { list, has: (id: string) => list.includes(id), toggle };
}
