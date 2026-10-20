const PREFIX = 'servio.demo.';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

export function loadDemoState<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw, (_k, v) => (typeof v === 'string' && ISO_DATE.test(v) ? new Date(v) : v)) as T) : null;
  } catch {
    return null;
  }
}

export function saveDemoState(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
  }
}

export function clearDemoState(): void {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
  } catch {
  }
}
