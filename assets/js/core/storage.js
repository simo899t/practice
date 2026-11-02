/** Safe localStorage access plus the per-exam best-score record. */

const PREFIX = 'exam-drill:';

function safeGet(key) {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null; // private mode, blocked storage — treat as "nothing saved"
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(PREFIX + key, value);
    return true;
  } catch {
    return false;
  }
}

export function readJSON(key, fallback) {
  const raw = safeGet(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  return safeSet(key, JSON.stringify(value));
}

export function readString(key, fallback = null) {
  const raw = safeGet(key);
  return raw === null ? fallback : raw;
}

export function writeString(key, value) {
  return safeSet(key, value);
}

/* ── Best scores ───────────────────────────────────────────────────────── */

const SCORES_KEY = 'scores';

/** @returns {Record<string, {best: number, attempts: number, at: string}>} */
export function allScores() {
  const data = readJSON(SCORES_KEY, {});
  return data && typeof data === 'object' ? data : {};
}

export function scoreFor(examFile) {
  return allScores()[examFile] ?? null;
}

/** Records an attempt, keeping the best percentage seen. Returns the new record. */
export function recordAttempt(examFile, percent) {
  const scores = allScores();
  const prev = scores[examFile];
  const next = {
    best: Math.max(percent, prev?.best ?? 0),
    attempts: (prev?.attempts ?? 0) + 1,
    at: new Date().toISOString(),
  };
  writeJSON(SCORES_KEY, { ...scores, [examFile]: next });
  return next;
}
