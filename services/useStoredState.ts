import { useCallback, useRef, useState, type SetStateAction } from 'react';
import { loadState } from './readingState';

export const useStoredState = <T,>(key: string, decode: (value: unknown) => T, fallback: T) => {
  const [initial] = useState(() => loadState(key, decode, fallback));
  const [value, setValue] = useState(initial.value);
  const current = useRef(initial.value);
  const [warning, setWarning] = useState(initial.warning);
  const update = useCallback((next: SetStateAction<T>) => {
    // Persist before the caller returns: a reload must not race a React effect.
    // Resolve functional updates outside React's replayable state updater.
    const resolved = typeof next === 'function' ? (next as (previous: T) => T)(current.current) : next;
    current.current = resolved;
    if (initial.writable) {
      try { localStorage.setItem(key, JSON.stringify(resolved)); setWarning(''); }
      catch { setWarning('変更をこの端末に保存できませんでした。画面を閉じると失われる場合があります。'); }
    }
    setValue(resolved);
  }, [key, initial.writable]);
  return [value, update, warning] as const;
};
