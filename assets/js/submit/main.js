/**
 * Add a test (submit.html): an example per question type, a checker for a
 * test written in Markdown (figures included), and two ways to send it in.
 */

import { byId, el } from '../core/dom.js';
import { mountThemeToggle } from '../core/theme.js';
import { plural } from '../core/format.js';
import { loadDraft, saveDraft } from '../core/drafts.js';
import { courseLabel, loadCatalog } from '../core/catalog.js';
import { parseTest } from '../quiz/markdown.js';
import { FORMATS, summarize } from '../quiz/model.js';
import { EXAMPLES } from './examples.js';
import { mailUrl, newFileUrl, submissionPath, testName, uploadUrl } from './submission.js';
import { zip } from './zip.js';

const tabs = byId('example-tabs');
const about = byId('example-about');
const exampleCode = byId('example-code');
const copyExample = byId('example-copy');
const tryExample = byId('example-try');

const courseSelect = byId('course');
const codeField = byId('course-code-field');
const codeInput = byId('course-code');
const titleInput = byId('test-title');
const source = byId('source');
const pickFolder = byId('pick-folder');
const pickFile = byId('pick-file');
const figureList = byId('figures');
const status = byId('check');
const tryButton = byId('try');
const missing = byId('missing');
const submitLink = byId('submit');
const submitNote = byId('submit-note');
const downloadButton = byId('download');
const mailLink = byId('mail');

const OTHER = 'other';
const FIGURE = /\.(png|jpe?g|gif|svg|webp)$/i;
const TEST_FILE = /\.(md|markdown|txt)$/i;

let courses = [];
let figures = new Map(); // path relative to the test file -> Blob
let parsed = null; // the latest parseTest result
let ready = false; // read cleanly, every figure present

mountThemeToggle(byId('bar-actions'));

const cleanPath = (path) => path.trim().replace(/^\.\//, '');
const isRemote = (path) => /^(?:[a-z]+:|\/)/i.test(path.trim());

/** Brief confirmation on a button: "Copied". */
function flash(button, label) {
  button.dataset.label ??= button.textContent;
  button.textContent = label;
  setTimeout(() => {
    button.textContent = button.dataset.label;
  }, 1600);
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* ── Examples ──────────────────────────────────────────────────────────── */

const sources = new Map();
let shown = null;

async function showExample(example) {
  shown = example;
  [...tabs.children].forEach((button, i) =>
    button.setAttribute('aria-pressed', String(EXAMPLES[i] === example))
  );
  about.textContent = example.about;
  tryExample.href = `quiz.html?${new URLSearchParams({
    file: example.file,
    title: `${FORMATS[example.format].label} example`,
    back: 'submit',
  })}`;

  if (!sources.has(example.file)) {
    const response = await fetch(example.file, { cache: 'no-cache' });
    sources.set(example.file, response.ok ? await response.text() : `Could not load ${example.file}.`);
  }
  if (shown === example) exampleCode.textContent = sources.get(example.file);
}

tabs.replaceChildren(
  ...EXAMPLES.map((example) =>
    el('button', {
      type: 'button',
      text: FORMATS[example.format].label,
      'aria-pressed': 'false',
      on: { click: () => showExample(example) },
    })
  )
);

copyExample.addEventListener('click', async () => {
  flash(copyExample, (await copy(exampleCode.textContent)) ? 'Copied' : 'Copy failed');
});

/* ── Your test ─────────────────────────────────────────────────────────── */

function details() {
  return {
    course: courses.find((course) => course.id === courseSelect.value) ?? null,
    code: courseSelect.value === OTHER ? codeInput.value.trim() : '',
    title: titleInput.value.trim(),
  };
}

const testText = () => `${source.value.replace(/\s+$/, '')}\n`;

let saving = null;
/** Kept in this browser (figures too), so the page survives a trip to the quiz. */
function save() {
  clearTimeout(saving);
  saving = setTimeout(() => {
    saveDraft({
      text: source.value,
      files: [...figures].map(([path, blob]) => ({ path, blob })),
      course: courseSelect.value,
      code: codeInput.value,
      title: titleInput.value,
    }).catch(() => {}); // private windows may refuse; the page still works
  }, 250);
}

function report(kind, message, problems = []) {
  status.className = `check is-${kind}`;
  status.replaceChildren(el('p', { text: message }));
  if (problems.length) status.append(el('ul', {}, problems.map((problem) => el('li', { text: problem }))));
}

function showFigures() {
  const names = [...figures.keys()];
  figureList.textContent = names.length
    ? `${plural(names.length, 'figure')} from the folder: ${names.slice(0, 5).join(', ')}${
        names.length > 5 ? ` and ${names.length - 5} more` : ''
      }`
    : '';
}

function check() {
  ready = false;
  parsed = source.value.trim() ? parseTest(source.value) : null;

  if (!parsed) {
    report('idle', 'Paste a test above, or open its folder.');
    return update();
  }

  const problems = [...parsed.issues];
  for (const { line, path } of parsed.images) {
    if (isRemote(path) || figures.has(cleanPath(path))) continue;
    problems.push({
      line,
      message: figures.size
        ? `The figure ${path} is not in the folder you opened.`
        : `The figure ${path} is not loaded. Open the test's folder so its figures come along.`,
    });
  }

  if (problems.length) {
    problems.sort((a, b) => a.line - b.line);
    report('bad', `${plural(problems.length, 'thing')} to fix:`,
      problems.map(({ line, message }) => `Line ${line}: ${message}`));
  } else {
    const summary = summarize(parsed.questions);
    const formats = summary.formats.map((format) => FORMATS[format].label).join(', ');
    const used = new Set(parsed.images.map(({ path }) => cleanPath(path)));
    ready = true;
    report('good',
      `Ready: ${plural(summary.count, 'question')}, ${plural(summary.points, 'point')} (${formats})` +
        (used.size ? `, ${plural(used.size, 'figure')}.` : '.'));
  }
  update();
}

const usesFigures = () => parsed.images.some(({ path }) => !isRemote(path));

/** Buttons follow the form: Try needs a question, Submit a clean test with a course and title. */
function update() {
  const { course, code, title } = details();
  codeField.classList.toggle('hidden', courseSelect.value !== OTHER);
  tryButton.disabled = !parsed?.questions.length;
  downloadButton.disabled = !source.value.trim();
  mailLink.href = mailUrl({ course, code, title });

  let reason = '';
  if (ready && !course && !code) reason = 'Choose the course to submit.';
  else if (ready && !title) reason = 'Give the test a title to submit.';
  missing.textContent = reason;

  if (ready && !reason) {
    if (usesFigures()) {
      submitLink.href = uploadUrl();
      submitLink.dataset.route = 'upload';
    } else {
      const { href, prefilled } = newFileUrl(submissionPath({ course, code, title }), testText());
      submitLink.href = href;
      submitLink.dataset.route = prefilled ? 'prefilled' : 'paste';
    }
    submitLink.removeAttribute('aria-disabled');
  } else {
    submitLink.removeAttribute('href');
    submitLink.setAttribute('aria-disabled', 'true');
  }
}

function changed() {
  save();
  check();
}

/* ── Opening a folder or file ──────────────────────────────────────────── */

/**
 * The files of an opened or dropped folder, as { path, file } with "/"
 * paths: the shallowest Markdown file is the test, and the images under its
 * folder are its figures.
 */
async function open(entries) {
  const tests = entries
    .filter(({ path }) => TEST_FILE.test(path))
    .sort((a, b) => a.path.split('/').length - b.path.split('/').length || a.path.localeCompare(b.path));
  if (!tests.length) {
    report('bad', 'There is no .md file in what you opened.');
    return;
  }

  const base = tests[0].path.slice(0, tests[0].path.lastIndexOf('/') + 1);
  figures = new Map(
    entries
      .filter(({ path }) => path.startsWith(base) && FIGURE.test(path))
      .map(({ path, file }) => [path.slice(base.length), file])
  );
  source.value = await tests[0].file.text();
  showFigures();
  changed();
}

/** Every file under a dropped folder (or the dropped file itself). */
async function filesUnder(entry, prefix = '') {
  if (entry.isFile) {
    const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
    return [{ path: prefix + entry.name, file }];
  }
  const reader = entry.createReader();
  const children = [];
  for (;;) {
    const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
    if (!batch.length) break;
    children.push(...batch);
  }
  const nested = await Promise.all(children.map((child) => filesUnder(child, `${prefix}${entry.name}/`)));
  return nested.flat();
}

pickFolder.addEventListener('change', () => {
  open([...pickFolder.files].map((file) => ({ path: file.webkitRelativePath || file.name, file })));
  pickFolder.value = '';
});
pickFile.addEventListener('change', () => {
  const [file] = pickFile.files;
  if (file) open([{ path: file.name, file }]);
  pickFile.value = '';
});

source.addEventListener('dragover', (event) => event.preventDefault());
source.addEventListener('drop', async (event) => {
  // Entries must be taken while the event lasts; plain text drops fall through.
  const entries = [...(event.dataTransfer?.items ?? [])]
    .filter((item) => item.kind === 'file')
    .map((item) => item.webkitGetAsEntry?.())
    .filter(Boolean);
  if (!entries.length) return;
  event.preventDefault();
  open((await Promise.all(entries.map((entry) => filesUnder(entry)))).flat());
});

source.addEventListener('input', changed);
for (const input of [courseSelect, codeInput, titleInput]) {
  input.addEventListener('input', () => {
    save();
    update();
  });
}

/* ── Trying and sending ────────────────────────────────────────────────── */

tryButton.addEventListener('click', async () => {
  const { course, title } = details();
  try {
    clearTimeout(saving);
    await saveDraft({
      text: source.value,
      files: [...figures].map(([path, blob]) => ({ path, blob })),
      course: courseSelect.value,
      code: codeInput.value,
      title: titleInput.value,
    });
  } catch {
    report('bad', 'This browser will not keep the test (a private window?), so it cannot be tried here.');
    return;
  }
  location.href = `quiz.html?${new URLSearchParams({
    draft: '1',
    title: title || parsed?.title || 'Your test',
    course: course?.title ?? '',
    back: 'submit',
  })}`;
});

/**
 * The test as a folder in a .zip, laid out the way the site keeps it
 * (<course folder>/<test>/<test>.md plus figures), ready to email or to
 * drop onto GitHub.
 */
async function downloadZip() {
  const { course, code, title } = details();
  const path = submissionPath({ course, code, title }).replace(/^courses\//, '');
  const folder = path.slice(0, path.lastIndexOf('/') + 1);
  const encoder = new TextEncoder();

  const used = new Set((parsed?.images ?? []).map(({ path: image }) => cleanPath(image)));
  const files = [{ path, bytes: encoder.encode(testText()) }];
  for (const [figure, blob] of figures) {
    if (used.has(figure)) files.push({ path: folder + figure, bytes: new Uint8Array(await blob.arrayBuffer()) });
  }

  const url = URL.createObjectURL(new Blob([zip(files)], { type: 'application/zip' }));
  el('a', { href: url, download: `${testName(title || parsed?.title)}.zip` }).click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

downloadButton.addEventListener('click', downloadZip);

// The link opens GitHub in a new tab; copying starts first, while this tab has focus.
submitLink.addEventListener('click', (event) => {
  if (!submitLink.hasAttribute('href')) {
    event.preventDefault();
    return;
  }

  const route = submitLink.dataset.route;
  if (route === 'upload') {
    downloadZip();
    submitNote.textContent =
      'Unzip the download and drag the folder it holds onto the GitHub page that opened, then propose the change.';
    return;
  }

  const steps = 'commit it, then propose the change and open the pull request.';
  copy(testText()).then((copied) => {
    submitNote.textContent =
      route === 'prefilled'
        ? `GitHub opened in a new tab with your test filled in. There, ${steps}`
        : copied
          ? `Your test is copied. Paste it into the editor that opened on GitHub, ${steps}`
          : `Copy your test from the box above, paste it into the editor that opened on GitHub, ${steps}`;
  });
});

/* ── Bootstrap ─────────────────────────────────────────────────────────── */

async function init() {
  showExample(EXAMPLES[0]);

  const [draft, catalog] = await Promise.all([
    loadDraft().catch(() => null),
    loadCatalog().catch(() => []), // still usable: "Another course" takes a code
  ]);
  courses = catalog;

  courseSelect.replaceChildren(
    el('option', { value: '', text: 'Choose a course' }),
    ...courses.map((course) => {
      const { codes, name } = courseLabel(course);
      return el('option', { value: course.id, text: `${codes} – ${name}` });
    }),
    el('option', { value: OTHER, text: 'Another course' })
  );

  if (draft) {
    source.value = draft.text ?? '';
    titleInput.value = draft.title ?? '';
    codeInput.value = draft.code ?? '';
    figures = new Map((draft.files ?? []).map(({ path, blob }) => [path, blob]));
    if ([...courseSelect.options].some((option) => option.value === draft.course)) {
      courseSelect.value = draft.course;
    }
    showFigures();
  }

  check();
}

init();
