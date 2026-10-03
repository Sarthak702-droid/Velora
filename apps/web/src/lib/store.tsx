"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { DemoState } from "@velora/types";
import { seed } from "./data";
const KEY = "velora-demo-v1";
type Store = {
  state: DemoState;
  update: (f: (s: DemoState) => DemoState) => void;
  reset: () => void;
};
const C = createContext<Store | null>(null);
export function Providers({ children }: { children: ReactNode }) {
  const [query] = useState(() => new QueryClient());
  const [state, setState] = useState(seed);
  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const s = JSON.parse(raw);
          if (
            s.version === 1 &&
            Array.isArray(s.queue) &&
            Array.isArray(s.appointments)
          )
            setState(s);
        }
      } catch {
        localStorage.removeItem(KEY);
      }
    };
    read();
    const listener = (e: StorageEvent) => {
      if (e.key === KEY) read();
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);
  const update = useCallback(
    (f: (s: DemoState) => DemoState) => {
      let current = state;
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) current = JSON.parse(raw);
      } catch {}
      const next = { ...f(current), revision: current.revision + 1 };
      localStorage.setItem(KEY, JSON.stringify(next));
      setState(next);
      query.invalidateQueries();
    },
    [state, query],
  );
  const reset = () => {
    const next = seed();
    localStorage.setItem(KEY, JSON.stringify(next));
    localStorage.removeItem("velora-customer-queue");
    localStorage.removeItem("velora-customer-booking");
    setState(next);
    query.clear();
  };
  return (
    <QueryClientProvider client={query}>
      <C.Provider value={{ state, update, reset }}>{children}</C.Provider>
    </QueryClientProvider>
  );
}
export function useDemo() {
  const c = useContext(C);
  if (!c) throw Error("Missing provider");
  return c;
}
