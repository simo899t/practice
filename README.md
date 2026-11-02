# Exam Drill

Practise past exams from IMADA courses — multiple choice, true/false
blocks and written answers, marked as you go. A static site: no build step,
no backend, and scores stay in the browser.

## Run it

```bash
npm run serve        # python3 -m http.server 8080 → http://localhost:8080
npm test             # node --test: data model, sessions, every test in the manifest, asset stamps
npm run sync         # refresh courses/manifest.json (+ --add for new tests and archive files)
npm run stamp        # re-stamp asset versions after editing CSS or JS (sync does this too)
```

The pages fetch JSON, so open them through a server rather than as files.

Three pages: `index.html` lists the courses as tiles grouped by subject,
`course.html?id=<course id>` shows one course's tests and archive, and
`quiz.html` runs a test. Subjects and their coloured tags come from the
course codes (`AI501, DS843` → AI and DS).

## Layout

```
courses/
  manifest.json                 course list, tests and archive (see sync below)
  test_template/template.json   starting point for a new test
  <COURSE_FOLDER>/
    <test>/                     one transcribed test
      <test>.json               the questions
      <original>.pdf            linked from the course list
      assets/                   figures used by the questions
    archive/                    older exams, project descriptions, other files
assets/                         css, js, fonts, favicon
tools/sync-manifest.mjs         keeps manifest.json in step with the folders
```

A course folder belongs to the manifest course whose `id` it starts with
(`AI512_ML` → `AI512`).

## Adding a test

1. Copy `courses/test_template/` into the course folder, rename it
   (e.g. `exam2025-jan/`) and put the original PDF next to the JSON.
   Folders still called `test_template` are ignored, so work in progress
   stays off the site.
2. Fill in the questions (formats below).
3. Run `npm run sync -- --add`, then give the new entry a proper `title` in
   `courses/manifest.json`. Hand-written titles, ids and order are kept on
   every later sync; counts, formats and PDF links are refreshed.

### Question formats

| type     | shape                                                                 |
| -------- | --------------------------------------------------------------------- |
| `single` | `section`, `context`, `text`, `options: [{ text, correct, note }]` — exactly one correct |
| `group`  | `section`, `context`, `positiveLabel`, `negativeLabel`, `statements: [{ text, answerIsPositive, positiveNote, negativeNote }]` |
| `open`   | `section`, `context`, `text`, `answer` — self-graded against the model answer |

Notes are shown after answering: for `single`, on the correct and the chosen
option; for `group`, the note on the side of the correct answer.

In any text field: `$…$` and `$$…$$` for maths (KaTeX; keep each formula on
one line), `[image: assets/figure.png]` for a figure, `*emphasis*` and
`**bold**`, and a trailing `Code:` block for listings.

## Archive

For material that is worth keeping but not worth drilling — older exams that
were never transcribed, project descriptions, assignment sheets, notes:

1. Drop the files into `courses/<COURSE_FOLDER>/archive/`.
2. Run `npm run sync -- --add`.

Each file gets a title, a kind (Exam, Project, Assignment, Solutions, Slides,
Notes or Document) and a year guessed from its name, e.g.
`ai512-project-description-2023.pdf` → “AI512 Project Description 2023 ·
Project · 2023”. Fix anything in `manifest.json`; your edits are kept. On the
site the archive sits folded under each course's tests and is included in
search.

## Caching

GitHub Pages lets browsers keep files for ten minutes, so every stylesheet and
script URL carries a hash of its contents (`?v=…`), and an import map does the
same for the modules the pages import. `npm run stamp` (or `npm run sync`)
updates them; `npm test` fails if one is stale. Course and test JSON is always
fetched fresh.

## Fonts

Newsreader and Instrument Sans are self-hosted from `assets/fonts/` under the
SIL Open Font License (licence texts alongside).
