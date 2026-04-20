type RefreshResumePayload = {
  floor: number;
  coins: number;
  minigameSceneKey?: string | null;
};

const REFRESH_RESUME_KEY = 'casino.dev.refreshResume';
const REFRESH_RESUME_ENABLED_KEY = 'casino.dev.refreshResume.enabled';

export function shouldEnableRefreshResume(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

export function setRefreshResume(payload: RefreshResumePayload): void {
  if (typeof window === 'undefined' || !window.sessionStorage || !isRefreshResumeEnabled()) {
    return;
  }
  try {
    window.sessionStorage.setItem(REFRESH_RESUME_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage write failures in dev helper.
  }
}

export function consumeRefreshResume(): RefreshResumePayload | null {
  if (typeof window === 'undefined' || !window.sessionStorage || !isRefreshResumeEnabled()) {
    return null;
  }
  // Safety: apply refresh resume only for real browser reloads.
  const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  const isReload = navEntry?.type === 'reload'
    || ((performance as Performance & { navigation?: { type?: number } }).navigation?.type === 1);
  if (!isReload) {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(REFRESH_RESUME_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(REFRESH_RESUME_KEY);
    const parsed = JSON.parse(raw) as Partial<RefreshResumePayload>;
    if (
      typeof parsed.floor === 'number'
      && typeof parsed.coins === 'number'
    ) {
      return {
        floor: Math.max(1, Math.floor(parsed.floor)),
        coins: Math.max(0, Math.floor(parsed.coins)),
        minigameSceneKey: typeof parsed.minigameSceneKey === 'string' ? parsed.minigameSceneKey : null,
      };
    }
  } catch {
    // Ignore malformed storage values.
  }
  return null;
}

export function clearRefreshResume(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.removeItem(REFRESH_RESUME_KEY);
  } catch {
    // Ignore storage clear failures.
  }
}

export function isRefreshResumeEnabled(): boolean {
  if (typeof window === 'undefined' || !window.localStorage || !shouldEnableRefreshResume()) {
    return false;
  }
  const raw = window.localStorage.getItem(REFRESH_RESUME_ENABLED_KEY);
  return raw !== '0';
}

export function setRefreshResumeEnabled(enabled: boolean): void {
  if (typeof window === 'undefined' || !window.localStorage || !shouldEnableRefreshResume()) {
    return;
  }
  try {
    window.localStorage.setItem(REFRESH_RESUME_ENABLED_KEY, enabled ? '1' : '0');
    if (!enabled) {
      clearRefreshResume();
    }
  } catch {
    // Ignore storage write failures.
  }
}
