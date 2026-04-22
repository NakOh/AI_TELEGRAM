import { useEffect, useState } from '../lib/teact/teact';

import type { CategoryKey } from '../util/categoryClassifier';

import useLastCallback from './useLastCallback';

const STORAGE_KEY = 'hiddenCategoriesV1';
const listeners = new Set<() => void>();
let currentHidden: Set<CategoryKey> = readStored();

function readStored(): Set<CategoryKey> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr as CategoryKey[] : []);
  } catch {
    return new Set();
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...currentHidden]));
  } catch {
    // ignore
  }
}

export default function useHiddenCategories() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick(Date.now());
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const hiddenCategories = currentHidden;

  const toggleHidden = useLastCallback((key: CategoryKey) => {
    const next = new Set(currentHidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    currentHidden = next;
    persist();
    listeners.forEach((l) => l());
  });

  return { hiddenCategories, toggleHidden };
}
