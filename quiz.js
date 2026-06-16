const params = new URLSearchParams(location.search);
const file = params.get('file');
const title = params.get('title') || 'Quiz';

document.getElementById('quiz-title').textContent = title;

let questions = [];
let current = 0;
let score = 0;
let answered = false;

// ── Parser ────────────────────────────────────────────────────────────────────

function parseTxt(text) {
  const qs = [];
  const lines = text.split('\n');
  let q = null;
  let opt = null;
  let currentContext = '';  // context lines between ## header and first numbered question
  let currentSection = '';
  let inCodeBlock = false;  // true once a "Code:" marker is seen, until reset

  const flushOpt = () => {
    if (opt && q) q.options.push(opt);
    opt = null;
  };
  const flushQ = () => {
    flushOpt();
    if (q && q.options.length) qs.push(q);
    q = null;
  };

  for (let raw of lines) {
    const line = raw.trimEnd();

    // Dividers — ignore
    if (/^={3,}/.test(line) || /^-{3,}/.test(line)) continue;

    // Section header — reset context accumulator, capture section title
    if (/^##/.test(line)) {
      flushQ();
      currentContext = '';
      inCodeBlock = false;
      currentSection = line.replace(/^#+\s*/, '').replace(/\s*\(\d+\s*questions?\)\s*$/i, '').trim();
      continue;
    }

    // Numbered question: "1. Some text…"
    const qMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (qMatch) {
      flushQ();
      q = { text: qMatch[2].trim(), context: currentContext.trim(), section: currentSection, options: [] };
      inCodeBlock = false;
      continue;
    }

    // Option line: "   1) [CORRECT] text"
    const optMatch = line.match(/^\s+(\d+)\)\s+\[(CORRECT|WRONG)\]\s+(.+)/);
    if (optMatch && q) {
      flushOpt();
      opt = { text: optMatch[3].trim(), correct: optMatch[2] === 'CORRECT', note: '' };
      continue;
    }

    // Note line: "        -> text"
    const noteMatch = line.match(/^\s+->\s+(.+)/);
    if (noteMatch && opt) {
      opt.note = noteMatch[1].trim();
      continue;
    }

    // Context line — accumulate between section header and first question.
    // Lines from "Code:" onward keep their original indentation/newlines so
    // code listings stay intact instead of being smashed into one line.
    if (!q && line.trim() && !/^Format|^Total|^AI[0-9]/.test(line)) {
      if (inCodeBlock) {
        currentContext += '\n' + raw.trimEnd();
      } else if (/Code(\s*\([^)]*\))?:\s*$/.test(line.trim())) {
        inCodeBlock = true;
        currentContext += (currentContext ? ' ' : '') + line.trim();
      } else {
        currentContext += (currentContext ? ' ' : '') + line.trim();
      }
    }
  }

  flushQ();
  return qs;
}

// ── Grouping ──────────────────────────────────────────────────────────────────
// Consecutive True/False statements that share the same section header are
// grouped into a single "check all that are true" question.

function isBinaryTF(q) {
  return q.options.length === 2 && q.options.every(o =>
    /^true$/i.test(o.text.trim()) || /^false$/i.test(o.text.trim())
  );
}

function groupStatements(raw) {
  const items = [];
  let curGroup = null;

  raw.forEach(q => {
    if (isBinaryTF(q) && q.section) {
      if (!curGroup || curGroup.section !== q.section) {
        curGroup = { type: 'group', section: q.section, context: q.context, statements: [] };
        items.push(curGroup);
      }
      const trueOpt = q.options.find(o => /^true$/i.test(o.text.trim()));
      const falseOpt = q.options.find(o => /^false$/i.test(o.text.trim()));
      curGroup.statements.push({
        text: q.text,
        answerIsTrue: trueOpt.correct,
        trueNote: trueOpt.note,
        falseNote: falseOpt.note,
      });
    } else {
      items.push({ type: 'single', ...q });
      curGroup = null;
    }
  });

  return items;
}

function totalPoints(items) {
  return items.reduce((sum, it) => sum + (it.type === 'group' ? it.statements.length : 1), 0);
}

// ── Shuffle helpers ───────────────────────────────────────────────────────────

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function prepareQuestions(items) {
  return shuffle(items.map(it => it.type === 'group'
    ? { ...it, statements: shuffle([...it.statements]) }
    : { ...it, options: shuffle([...it.options]) }
  ));
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
  instr.textContent = 'Check every statement that is TRUE, then submit:';
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

function gradeGroup(q) {
  if (answered) return;
  answered = true;

  const items = document.querySelectorAll('#statement-list .statement');
  items.forEach((li, i) => {
    const st = q.statements[i];
    const checkbox = li.querySelector('input[type=checkbox]');
    const userSaysTrue = checkbox.checked;
    checkbox.disabled = true;

    const correct = userSaysTrue === st.answerIsTrue;
    li.classList.add(correct ? 'correct' : 'wrong');

    const verdict = document.createElement('span');
    verdict.className = 'verdict';
    verdict.textContent = st.answerIsTrue ? ' — True' : ' — False';
    li.querySelector('.statement-text').appendChild(verdict);

    const note = document.createElement('span');
    note.className = 'note';
    richRender(note, st.answerIsTrue ? st.trueNote : st.falseNote);
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
    const raw = parseTxt(text);
    if (!raw.length) throw new Error('No questions parsed.');
    const items = groupStatements(raw);
    questions = prepareQuestions(items);
    maxScore = totalPoints(items);
    document.getElementById('loading').remove();
    renderQuestion();
  } catch (e) {
    document.getElementById('loading').textContent = 'Failed to load: ' + e.message;
  }
}

init();
