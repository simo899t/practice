/**
 * Where a finished test goes: a pull request on GitHub, or an email for
 * people without a GitHub account. Pure helpers, no DOM.
 */

export const REPO = 'simo899t/practice';
export const BRANCH = 'main';
export const EMAIL = 'simon@cogito.dk';

// GitHub can fill in a new file from the link itself, but very long links
// are refused, so bigger tests are pasted from the clipboard instead.
const MAX_LINK = 7000;

/** "Exam June 2025 (Part I)" -> "exam-june-2025-part-i" */
export function slugify(title) {
  return String(title ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** A course's folder, read off a file it already has: courses/AI512_ML/… -> "AI512_ML". */
export function courseFolder(course) {
  const file = course.tests?.[0]?.file ?? course.archive?.[0]?.file;
  return file?.split('/')[1] ?? course.id;
}

const codeFolder = (code) => String(code ?? '').toUpperCase().replace(/[^A-Z0-9]+/g, '') || 'NEW';

/** The test's folder name, also used for its file: "exam-may-2023". */
export const testName = (title) => slugify(title) || 'new-test';

/**
 * Where `npm run sync -- --add` picks a test up: courses/<course folder>/<test>/<test>.md.
 * A course that is not on the site yet gets a folder named after its code.
 */
export function submissionPath({ course = null, code = '', title = '' }) {
  const folder = course ? courseFolder(course) : codeFolder(code);
  const name = testName(title);
  return `courses/${folder}/${name}/${name}.md`;
}

/**
 * GitHub's "new file" page for a test without figures, filled in when the
 * link stays short enough. Without write access GitHub turns the commit into
 * a fork and a pull request.
 * @returns {{href: string, prefilled: boolean}}
 */
export function newFileUrl(path, contents) {
  const url = new URL(`https://github.com/${REPO}/new/${BRANCH}`);
  url.searchParams.set('filename', path);

  const filled = new URL(url);
  filled.searchParams.set('value', contents);
  return filled.href.length <= MAX_LINK
    ? { href: filled.href, prefilled: true }
    : { href: url.href, prefilled: false };
}

/**
 * GitHub's upload page for courses/, for a test with figures: the download
 * holds <course folder>/<test>/…, and that folder is dropped onto the page.
 */
export function uploadUrl() {
  return `https://github.com/${REPO}/upload/${BRANCH}/courses`;
}

/** A mail with the details filled in; the .zip or the exam PDF goes in as an attachment. */
export function mailUrl({ course = null, code = '', title = '' }) {
  const courseName = course?.title ?? code.trim();
  const subject = ['New test', courseName, title.trim()].filter(Boolean).join(': ');
  const body = [
    `Course: ${courseName || '…'}`,
    `Test: ${title.trim() || '…'}`,
    '',
    'Attached: the test as a .zip, or the exam as a PDF.',
  ].join('\n');
  return `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
