import { useEffect, useState } from '../lib/teact/teact';

import useLastCallback from './useLastCallback';

const STORAGE_KEY = 'hideForwardedMessages';

const listeners = new Set<() => void>();
let currentValue = readStored();

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function setStoredValue(value: boolean) {
  currentValue = value;
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    // Ignore storage failures
  }
  listeners.forEach((l) => l());
}

export default function useHideForwarded() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick(Date.now());
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const toggleHideForwarded = useLastCallback(() => {
    setStoredValue(!currentValue);
  });

  return { isHideForwardedMessages: currentValue, toggleHideForwarded };
}
