/**
 * Turns a file dropped into courses/<course>/archive/ into a readable
 * manifest entry, e.g.
 *
 *   "ai512-project-description-2023.pdf"
 *     -> { title: "AI512 Project Description 2023", kind: "Project", year: 2023 }
 *
 * The guesses are only a starting point: titles and kinds written by hand in
 * the manifest are never overwritten. Pure functions, no file system access.
 */

/** Checked in order, so "exam-answers" is filed as solutions, not as an exam. */
const KINDS = [
  ['Solutions', /solution|answers?|\bkey\b|l(?:ø|oe)sning/i],
  ['Project', /proje[ck]t/i],
  ['Assignment', /assignment|exercise|homework|hand-?in|opgave|obligator/i],
  ['Exam', /exam|eksamen|midterm|quiz|\btest\b/i],
  ['Slides', /slides?|lecture|forel(?:æ|ae)sning/i],
  ['Notes', /notes?|summary|cheat-?sheet|noter/i],
];

export const ARCHIVE_KINDS = [...KINDS.map(([kind]) => kind), 'Document'];

export function archiveKind(fileName) {
  const words = fileName.replace(/[-_.]+/g, ' ');
  for (const [kind, pattern] of KINDS) if (pattern.test(words)) return kind;
  return 'Document';
}

/** The first plausible year in the name (1900–2099), or null. */
export function archiveYear(fileName) {
  const match = fileName.match(/(?:^|\D)((?:19|20)\d{2})(?!\d)/);
  return match ? Number(match[1]) : null;
}

export function archiveTitle(fileName) {
  return fileName
    .replace(/\.[^.]+$/, '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => {
      if (/^[a-z]{2,3}\d{3}$/i.test(word)) return word.toUpperCase(); // course codes
      if (word === word.toLowerCase()) return word.charAt(0).toUpperCase() + word.slice(1);
      return word;
    })
    .join(' ');
}

export function describeArchiveFile(fileName) {
  const year = archiveYear(fileName);
  return {
    title: archiveTitle(fileName),
    kind: archiveKind(fileName),
    ...(year ? { year } : {}),
  };
}
