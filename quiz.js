const params = new URLSearchParams(location.search);
const file = params.get('file');
const title = params.get('title') || 'Quiz';

document.getElementById('quiz-title').textContent = title;

let questions = [];
let current = 0;
let score = 0;
let answered = false;

// ── Parser ────────────────────────────────────────────────────────────────────
// Question files are plain JSON: an array of pre-grouped items, each either
//   { type: 'single', text, context, section, options: [{ text, correct, note }] }
// or
//   { type: 'group', section, context, positiveLabel, negativeLabel,
//     statements: [{ text, answerIsPositive, positiveNote, negativeNote }] }
// A "group" is one question with several binary sub-statements (e.g.
// True/False, Yes/No) — rendered as a single card with one checkbox per
// statement (check = positiveLabel, leave unchecked = negativeLabel).

function parseQuestions(text) {
  const items = JSON.parse(text);
  if (!Array.isArray(items)) throw new Error('Question file must be a JSON array.');
  return items;
}

function totalPoints(items) {
  return items.reduce((sum, it) => sum + (it.type === 'group' ? it.statements.length : 1), 0);
}

function isOpenType(it) { return it.type === 'open'; }

// ── Shuffle helpers ───────────────────────────────────────────────────────────

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function prepareQuestions(items) {
  return shuffle(items.map(it => {
    if (it.type === 'group') return { ...it, statements: shuffle([...it.statements]) };
    if (it.type === 'open')  return { ...it };
    return { ...it, options: shuffle([...it.options]) };
  }));
}

// ── Rich text (inline images) ────────────────────────────────────────────────

const IMAGE_TOKEN = /\[image:\s*([^\]]+)\]/g;

function resolveAsset(p) {
  if (/^https?:\/\//.test(p) || p.startsWith('/')) return p;
  const baseDir = file.slice(0, file.lastIndexOf('/') + 1);
  return baseDir + p;
}

// Appends text + <img> nodes for any [image: path] tokens found in str.
function richRender(target, str) {
  let lastIndex = 0;
  let m;
  IMAGE_TOKEN.lastIndex = 0;
  while ((m = IMAGE_TOKEN.exec(str))) {
    if (m.index > lastIndex) {
      target.appendChild(document.createTextNode(str.slice(lastIndex, m.index)));
    }
    const img = document.createElement('img');
    img.src = resolveAsset(m[1].trim());
    img.className = 'inline-image';
    img.alt = '';
    target.appendChild(img);
    lastIndex = IMAGE_TOKEN.lastIndex;
  }
  if (lastIndex < str.length) {
    target.appendChild(document.createTextNode(str.slice(lastIndex)));
  }
}

// Renders question context, splitting out any "Code:" listing into its own
// monospace box so indentation/line breaks are preserved instead of being
// reflowed into a single line.
function renderContext(container, context) {
  const codeMatch = context.match(/^([\s\S]*?\bCode(?:\s*\([^)]*\))?:)\n([\s\S]+)$/);

  if (!codeMatch) {
    const ctx = document.createElement('p');
    ctx.className = 'question-context';
    richRender(ctx, context);
    container.appendChild(ctx);
    return;
  }

  const ctx = document.createElement('p');
  ctx.className = 'question-context';
  richRender(ctx, codeMatch[1]);
  container.appendChild(ctx);

  const pre = document.createElement('pre');
  pre.className = 'code-block';
  pre.textContent = codeMatch[2];
  container.appendChild(pre);
}

// ── Math rendering ────────────────────────────────────────────────────────────

function renderMath(el) {
  if (window.renderMathInElement) {
    renderMathInElement(el, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
      ],
      throwOnError: false,
    });
  }
}

// KaTeX loads asynchronously — poll until ready then re-render if needed
let mathQueue = null;
document.addEventListener('DOMContentLoaded', () => {
  const interval = setInterval(() => {
    if (window.renderMathInElement) {
      clearInterval(interval);
      if (mathQueue) { renderMath(mathQueue); mathQueue = null; }
    }
  }, 50);
});

function renderMathWhenReady(el) {
  if (window.renderMathInElement) {
    renderMath(el);
  } else {
    mathQueue = el;
  }
}

// ── Render ────────────────────────────────────────────────────────────────────

function updateProgress() {
  const pct = (current / questions.length) * 100;
  document.getElementById('progress-bar').style.width = pct + '%';
  document.getElementById('progress-text').textContent =
    `Question ${current + 1} of ${questions.length}`;
}

function renderQuestion() {
  const q = questions[current];
  if (q.type === 'group') renderGroupQuestion(q);
  else if (q.type === 'open') renderOpenQuestion(q);
  else renderSingleQuestion(q);
}

function renderSingleQuestion(q) {
  answered = false;

  const area = document.getElementById('quiz-area');
  area.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'card question-card';

  if (q.context) renderContext(card, q.context);

  const qText = document.createElement('p');
  qText.className = 'question-text';
  richRender(qText, q.text);
  card.appendChild(qText);

  const ul = document.createElement('ul');
  ul.className = 'options';
  ul.id = 'options';

  q.options.forEach((opt, i) => {
    const li = document.createElement('li');
    li.className = 'option';
    const span = document.createElement('span');
    span.className = 'opt-text';
    richRender(span, opt.text);
    li.appendChild(span);
    li.addEventListener('click', () => selectOption(i));
    ul.appendChild(li);
  });

  card.appendChild(ul);

  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn btn-next hidden';
  nextBtn.id = 'next-btn';
  nextBtn.textContent = current + 1 < questions.length ? 'Next question' : 'See results';
  nextBtn.addEventListener('click', advance);
  card.appendChild(nextBtn);

  area.appendChild(card);
  renderMathWhenReady(card);
  updateProgress();
}

function renderGroupQuestion(q) {
  answered = false;

  const area = document.getElementById('quiz-area');
  area.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'card question-card';

  if (q.section) {
    const heading = document.createElement('p');
    heading.className = 'group-title';
    heading.textContent = q.section;
    card.appendChild(heading);
  }

  if (q.context) renderContext(card, q.context);

  const instr = document.createElement('p');
  instr.className = 'group-instructions';
  instr.textContent = `Check every statement that is ${q.positiveLabel}, then submit:`;
  card.appendChild(instr);

  const list = document.createElement('ul');
  list.className = 'statement-list';
  list.id = 'statement-list';

  q.statements.forEach((st, i) => {
    const li = document.createElement('li');
    li.className = 'statement';

    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.i = i;
    label.appendChild(checkbox);

    const span = document.createElement('span');
    span.className = 'statement-text';
    richRender(span, st.text);
    label.appendChild(span);

    li.appendChild(label);
    list.appendChild(li);
  });

  card.appendChild(list);

  const checkBtn = document.createElement('button');
  checkBtn.className = 'btn';
  checkBtn.id = 'check-btn';
  checkBtn.textContent = 'Submit answers';
  checkBtn.addEventListener('click', () => gradeGroup(q));
  card.appendChild(checkBtn);

  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn btn-next hidden';
  nextBtn.id = 'next-btn';
  nextBtn.textContent = current + 1 < questions.length ? 'Next question' : 'See results';
  nextBtn.addEventListener('click', advance);
  card.appendChild(nextBtn);

  area.appendChild(card);
  renderMathWhenReady(card);
  updateProgress();
}

function renderOpenQuestion(q) {
  answered = false;

  const area = document.getElementById('quiz-area');
  area.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'card question-card';

  if (q.section) {
    const heading = document.createElement('p');
    heading.className = 'group-title';
    heading.textContent = q.section;
    card.appendChild(heading);
  }

  if (q.context) renderContext(card, q.context);

  const qText = document.createElement('p');
  qText.className = 'question-text';
  richRender(qText, q.text);
  card.appendChild(qText);

  const textarea = document.createElement('textarea');
  textarea.className = 'open-answer';
  textarea.placeholder = 'Write your answer here…';
  card.appendChild(textarea);

  const submitBtn = document.createElement('button');
  submitBtn.className = 'btn';
  submitBtn.textContent = 'Submit answer';
  submitBtn.addEventListener('click', () => {
    if (answered) return;
    answered = true;
    textarea.disabled = true;
    submitBtn.classList.add('hidden');

    const answerBox = document.createElement('div');
    answerBox.className = 'open-correct-answer';
    const label = document.createElement('p');
    label.className = 'open-correct-label';
    label.textContent = 'Answer:';
    answerBox.appendChild(label);
    const answerText = document.createElement('p');
    richRender(answerText, q.answer);
    answerBox.appendChild(answerText);
    card.insertBefore(answerBox, nextBtn);

    renderMath(card);
    nextBtn.classList.remove('hidden');
  });
  card.appendChild(submitBtn);

  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn btn-next hidden';
  nextBtn.textContent = current + 1 < questions.length ? 'Next question' : 'See results';
  nextBtn.addEventListener('click', advance);
  card.appendChild(nextBtn);

  area.appendChild(card);
  renderMathWhenReady(card);
  updateProgress();
}

function gradeGroup(q) {
  if (answered) return;
  answered = true;

  const items = document.querySelectorAll('#statement-list .statement');
  items.forEach((li, i) => {
    const st = q.statements[i];
    const checkbox = li.querySelector('input[type=checkbox]');
    const userSaysPositive = checkbox.checked;
    checkbox.disabled = true;

    const correct = userSaysPositive === st.answerIsPositive;
    li.classList.add(correct ? 'correct' : 'wrong');

    const verdict = document.createElement('span');
    verdict.className = 'verdict';
    verdict.textContent = ' — ' + (st.answerIsPositive ? q.positiveLabel : q.negativeLabel);
    li.querySelector('.statement-text').appendChild(verdict);

    const note = document.createElement('span');
    note.className = 'note';
    richRender(note, st.answerIsPositive ? st.positiveNote : st.negativeNote);
    li.appendChild(note);

    if (correct) score++;
  });

  renderMath(document.getElementById('quiz-area'));

  document.getElementById('check-btn').classList.add('hidden');
  document.getElementById('next-btn').classList.remove('hidden');
}

function selectOption(i) {
  if (answered) return;
  answered = true;

  const q = questions[current];
  const items = document.querySelectorAll('.option');

  items.forEach((li, idx) => {
    const opt = q.options[idx];
    if (opt.correct) {
      li.classList.add('correct');
      if (opt.note) {
        const note = document.createElement('span');
        note.className = 'note';
        richRender(note, opt.note);
        li.appendChild(note);
      }
    } else if (idx === i) {
      li.classList.add('wrong');
      if (opt.note) {
        const note = document.createElement('span');
        note.className = 'note';
        richRender(note, opt.note);
        li.appendChild(note);
      }
    }
    li.style.cursor = 'default';
  });

  if (q.options[i].correct) score++;

  // Re-render math inside newly added notes
  renderMath(document.getElementById('quiz-area'));

  document.getElementById('next-btn').classList.remove('hidden');
}

function advance() {
  current++;
  if (current >= questions.length) showResults();
  else renderQuestion();
}

let maxScore = 0;

function showResults() {
  document.getElementById('quiz-area').classList.add('hidden');
  const pct = Math.round((score / maxScore) * 100);
  document.getElementById('score-text').textContent =
    `You scored ${score} / ${maxScore} (${pct}%)`;
  document.getElementById('progress-bar').style.width = '100%';
  document.getElementById('progress-text').textContent = 'Complete';
  document.getElementById('results').classList.remove('hidden');
}

document.getElementById('restart-btn').addEventListener('click', () => {
  current = 0;
  score = 0;
  questions = prepareQuestions(questions);
  document.getElementById('results').classList.add('hidden');
  document.getElementById('quiz-area').classList.remove('hidden');
  renderQuestion();
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function init() {
  if (!file) {
    document.getElementById('loading').textContent = 'No file specified.';
    return;
  }
  try {
    const res = await fetch(file);
    if (!res.ok) throw new Error(res.statusText);
    const text = await res.text();
    const items = parseQuestions(text);
    if (!items.length) throw new Error('No questions parsed.');
    questions = prepareQuestions(items);
    maxScore = totalPoints(items);
    document.getElementById('loading').remove();
    renderQuestion();
  } catch (e) {
    document.getElementById('loading').textContent = 'Failed to load: ' + e.message;
  }
}

init();
