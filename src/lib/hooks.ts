import { useEffect, useState } from 'react';

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Run an async loader keyed by `key`; aborts stale requests. */
export function useAsync<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<{ data?: T; error?: unknown; loading: boolean }>({ loading: !!key });
  useEffect(() => {
    if (!key) {
      setState({ loading: false });
      return;
    }
    const ctrl = new AbortController();
    setState((s) => ({ data: s.data, loading: true }));
    load(ctrl.signal)
      .then((data) => !ctrl.signal.aborted && setState({ data, loading: false }))
      .catch((error) => !ctrl.signal.aborted && setState({ error, loading: false }));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

export function useMediaQuery(q: string): boolean {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}
