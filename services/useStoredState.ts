import { useCallback, useEffect, useState, type SetStateAction } from 'react';
import { loadState } from './readingState';

export const useStoredState = <T,>(key: string, decode: (value: unknown) => T, fallback: T) => {
  const [initial] = useState(() => loadState(key, decode, fallback));
  const [value, setValue] = useState(initial.value);
  const [warning, setWarning] = useState(initial.warning);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty || !initial.writable) return;
    try { localStorage.setItem(key, JSON.stringify(value)); setWarning(''); }
    catch { setWarning('変更をこの端末に保存できませんでした。画面を閉じると失われる場合があります。'); }
  }, [key, value, dirty, initial.writable]);
  const update = useCallback((next: SetStateAction<T>) => { setValue(next); setDirty(true); }, []);
  return [value, update, warning] as const;
};
