/** Small pure formatters shared by both pages. */

export function plural(count, one, many = one + 's') {
  return `${count} ${count === 1 ? one : many}`;
}

export function percent(earned, possible) {
  if (!possible) return 0;
  return Math.round((earned / possible) * 100);
}

/** 95_000 -> "1m 35s" */
export function duration(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return mins ? `${mins}m ${secs}s` : `${secs}s`;
}

/** Letter key for an option index: 0 -> "A". */
export function optionKey(index) {
  return String.fromCharCode(65 + index);
}

/** Splits "DM507, DM578 - Algorithms" into code and name parts. */
export function splitTitle(title) {
  const at = title.indexOf(' - ');
  if (at === -1) return { code: '', name: title };
  return { code: title.slice(0, at), name: title.slice(at + 3) };
}

/** "AI501, DS843 - Intro to AI" -> { codes: "AI501, DS843", name: "Intro to AI" } */
export function courseParts(title) {
  const { code, name } = splitTitle(String(title ?? ''));
  const codes = code
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');
  return { codes, name };
}

/**
 * The subject prefixes of a course's codes, used as filter tags:
 * "AI501, DS843 - Intro to AI" -> ["AI", "DS"], "DM507 - Algorithms" -> ["DM"].
 */
export function codePrefixes(title) {
  const { codes } = courseParts(title);
  const prefixes = codes
    .split(', ')
    .map((code) => (code.match(/^[A-Za-z]+(?=\d)/)?.[0] ?? '').toUpperCase())
    .filter(Boolean);
  return [...new Set(prefixes)];
}

/**
 * Shortens to `max` characters, preferring the last word boundary as long as
 * that still keeps at least half of the budget.
 */
export function truncate(text, max = 160) {
  const clean = String(text ?? '').trim();
  if (clean.length <= max) return clean;

  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(' ');
  const kept = space >= max / 2 ? cut.slice(0, space) : cut;
  return `${kept.trimEnd()}…`;
}
