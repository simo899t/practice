# Exam Practice

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

The pages fetch their tests and the course list, so open them through a
server rather than as files.

Four pages: `index.html` lists the courses (narrowed to one subject by the
Tags filter), `course.html?id=<course id>` shows one course's tests and
archive, `quiz.html` runs a test, and `submit.html` lets anyone write and
send in a new one (see below). Subjects and their coloured tags come from
the course codes (`AI501, DS843` → AI and DS).

## Layout

```
courses/
  manifest.json                 course list, tests and archive (see sync below)
  test_template/test.md         starting point for a new test
  <COURSE_FOLDER>/
    <test>/                     one transcribed test
      <test>.md                 the questions, in Markdown
      <original>.pdf            linked from the course list
      assets/                   figures used by the questions
    archive/                    older exams, project descriptions, other files
examples/                       one small test per question type, shown on submit.html
assets/                         css, js, fonts, favicon
tools/sync-manifest.mjs         keeps manifest.json in step with the folders
```

A course folder belongs to the manifest course whose `id` it starts with
(`AI512_ML` → `AI512`).

## Adding a test

1. Copy `courses/test_template/` into the course folder, rename the folder
   and its `test.md` (e.g. `exam2025-jan/exam2025-jan.md`) and put the
   original PDF next to it. Folders still called `test_template` are
   ignored, so work in progress stays off the site.
2. Write the questions (format below).
3. Run `npm run sync -- --add`. The new entry takes its title from the
   file's `# Title` line; hand-written titles, ids and order in
   `courses/manifest.json` are kept on every later sync, while counts,
   formats and PDF links are refreshed. Sync also prints any problems in
   the file, with line numbers.

### Test format

A test is a Markdown file. Each question starts with a `##` heading, which
is also its label on the site:

```markdown
# Exam January 2025

## Question 1
Which data structure finds a value by its key in O(1) time on average?

- [ ] A sorted array
- [x] A hash table
  > The hash of the key points straight at its bucket.

## Question 2: Logic
> Let $p$ and $q$ be propositions.

Which statements are true?

- [true] $p \lor \neg p$ is a tautology.
- [false] If $p$ is false, then $p \land q$ is true.
  > $p \land q$ needs both to be true.

## Question 3
Why does binary search only work on a sorted array?

### Answer
Each step drops the half that cannot contain the key.
```

- **Multiple choice:** options marked `[x]` (right, exactly one) and `[ ]`.
- **True / false:** statements marked `[true]` or `[false]`. `[yes]`/`[no]`
  and `[correct]`/`[incorrect]` work too and become the button labels.
- **Written answer:** a question with no options; the model answer, if
  written up, goes under `### Answer` and people mark themselves against it.
- A quoted line (`  > …`) indented under an option or statement is its note,
  shown after answering. Other indented lines continue the option.
- Quoted lines (`> …`) right under the heading are the setup, shown above
  the question.

In any text: `$…$` and `$$…$$` for maths (KaTeX; keep each formula on one
line), `![](assets/figure.png)` for a figure from the test's `assets/`
folder, `*emphasis*` and `**bold**`, and fenced ```` ``` ```` blocks for code
listings. Line breaks are kept as written.

### From the site

`submit.html` ("Add a test" in the header) shows an example of each question
type from `examples/`, checks a test question by question as it is written,
and runs it as a quiz straight from the browser, figures included. A test
can be pasted, or opened as a file or as a whole folder with its figures.

- **Submit on GitHub:** a test without figures opens GitHub's new-file page at
  `courses/<COURSE_FOLDER>/<test>/<test>.md`, filled in when it is short and
  pasted from the clipboard otherwise. A test with figures is downloaded as a
  .zip laid out the same way, to drop onto GitHub's upload page for
  `courses/`. Without write access GitHub turns either into a pull request.
- **Email:** for people without GitHub, a mail to the maintainer with the
  course and title filled in; the .zip, or just the exam PDF, goes in as an
  attachment.

After merging or receiving a test, run `npm run sync -- --add` as above.

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

GitHub Pages lets browsers keep files for ten minutes, so every stylesheet,
script and favicon URL carries a hash of its contents (`?v=…`), and an import
map does the same for the modules the pages import. `npm run stamp` (or `npm run sync`)
updates them; `npm test` fails if one is stale. The course list and the tests
are always fetched fresh.

## Fonts

Instrument Sans (interface), Newsreader (question text, next to the KaTeX
maths) and JetBrains Mono (course codes and code listings) are self-hosted
from `assets/fonts/` under the SIL Open Font License (licence texts
alongside).
