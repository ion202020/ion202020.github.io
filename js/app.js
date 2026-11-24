/*
 * app.js — Undo 실험실 화면 동작
 *
 * 핵심 아이디어 (Stack 두 개):
 *   편집      : undoStack.push({ 편집 이름, 편집 전 이미지 }),  redoStack 비우기
 *   되돌리기  : e = undoStack.pop()  → 화면을 e.before로 복원,  redoStack.push(지금 이미지)
 *   다시 실행 : e = redoStack.pop()  → 화면을 e.after로 복원,   undoStack.push(지금 이미지)
 * 마지막에 한 편집이 가장 먼저 취소됩니다 (LIFO: Last In, First Out).
 */
(function () {
  'use strict';

  const SITE = {
    // GitHub 아이디를 넣으면 맨 아래 연락처에 링크가 생깁니다. 예: 'kyochul'
    githubUsername: 'ion202020',
  };

  const SIZE = 384;          // 합성 MRI 한 변 픽셀 수
  const MAX_HISTORY = 50;    // Undo 최대 횟수 (스냅샷 1장 ≈ 384×384×4 B ≈ 0.59 MB)

  const $ = (sel) => document.querySelector(sel);
  const canvas = $('#view');
  const ctx = canvas.getContext('2d');

  const original = generateBrain(SIZE);
  let current = original;
  let comparing = false;

  const undoStack = new Stack(MAX_HISTORY);
  const redoStack = new Stack(MAX_HISTORY);

  // ---------------- 그리기 ----------------
  function draw() {
    const img = comparing ? original : current;
    if (canvas.width !== img.width || canvas.height !== img.height) {
      canvas.width = img.width;
      canvas.height = img.height;
    }
    ctx.putImageData(img, 0, 0);
    $('#ov-mode').textContent = comparing ? 'BEFORE · 원본' : 'AFTER · 편집본';
    $('#ov-mode').classList.toggle('is-before', comparing);
    $('#ov-edits').textContent = `STACK ${undoStack.size}/${MAX_HISTORY}`;
  }

  function renderStackList(listEl, stack, emptyText) {
    listEl.textContent = '';
    const items = stack.toArrayTopFirst();
    if (items.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = emptyText;
      listEl.appendChild(li);
      return;
    }
    items.forEach((entry, i) => {
      const li = document.createElement('li');
      if (i === 0) li.className = 'is-top';
      const n = document.createElement('span');
      n.className = 'idx';
      n.textContent = String(items.length - i);
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = entry.label;
      li.append(n, name);
      if (i === 0) {
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = 'top';
        li.appendChild(tag);
      }
      listEl.appendChild(li);
    });
  }

  function renderStacks(flash) {
    renderStackList($('#undo-list'), undoStack, '비어 있음 — 편집 버튼을 눌러 push');
    renderStackList($('#redo-list'), redoStack, '비어 있음');
    $('#undo-count').textContent = undoStack.size;
    $('#redo-count').textContent = redoStack.size;
    $('#undo').disabled = undoStack.isEmpty();
    $('#redo').disabled = redoStack.isEmpty();
    if (flash) {
      const top = document.querySelector(`#${flash} li.is-top`);
      if (top) top.classList.add('just-pushed');
    }
  }

  function say(msg) {
    $('#status').textContent = msg;
  }

  function stopComparing() {
    if (!comparing) return;
    comparing = false;
    const btn = $('#compare');
    btn.setAttribute('aria-pressed', 'false');
    btn.textContent = '원본 보기';
  }

  // ---------------- Stack 연산 ----------------
  function applyEdit(id) {
    stopComparing();
    const isReset = id === 'reset';
    if (isReset && current === original) {
      say('이미 원본 상태입니다.');
      return;
    }
    const label = isReset ? '처음 상태로' : EDITS[id].label;
    const after = isReset ? original : EDITS[id].apply(current);
    const dropped = undoStack.size === MAX_HISTORY;
    undoStack.push({ label, before: current });
    redoStack.clear(); // 새 편집을 하면 "다시 실행" 기록은 의미가 없어짐
    current = after;
    draw();
    renderStacks('undo-list');
    say(`push → "${label}" 이(가) Undo 스택 꼭대기에 올라갔습니다.` + (dropped ? ` (${MAX_HISTORY}개를 넘어 가장 오래된 기록 1개는 버림)` : ''));
  }

  function undo() {
    stopComparing();
    const entry = undoStack.pop();
    if (!entry) return;
    redoStack.push({ label: entry.label, after: current });
    current = entry.before;
    draw();
    renderStacks('redo-list');
    say(`pop → "${entry.label}" 을(를) 되돌렸습니다. 남은 Undo ${undoStack.size}개.`);
  }

  function redo() {
    stopComparing();
    const entry = redoStack.pop();
    if (!entry) return;
    undoStack.push({ label: entry.label, before: current });
    current = entry.after;
    draw();
    renderStacks('undo-list');
    say(`다시 실행 → "${entry.label}" 이(가) Undo 스택으로 돌아갔습니다.`);
  }

  // ---------------- UI 연결 ----------------
  const tools = $('#tools');
  Object.entries(EDITS).forEach(([id, e]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tool';
    b.dataset.edit = id;
    b.innerHTML = `<span class="glyph" aria-hidden="true">${e.glyph}</span><span>${e.label}</span>`;
    tools.appendChild(b);
  });
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'tool tool-reset';
  resetBtn.dataset.edit = 'reset';
  resetBtn.innerHTML = '<span class="glyph" aria-hidden="true">⟲</span><span>처음 상태로</span>';
  tools.appendChild(resetBtn);

  tools.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-edit]');
    if (b) applyEdit(b.dataset.edit);
  });
  $('#undo').addEventListener('click', undo);
  $('#redo').addEventListener('click', redo);
  $('#compare').addEventListener('click', () => {
    comparing = !comparing;
    const btn = $('#compare');
    btn.setAttribute('aria-pressed', String(comparing));
    btn.textContent = comparing ? '편집본 보기' : '원본 보기';
    draw();
  });

  document.addEventListener('keydown', (ev) => {
    const mod = ev.ctrlKey || ev.metaKey;
    if (!mod) return;
    const k = ev.key.toLowerCase();
    if (k === 'z' && !ev.shiftKey) { ev.preventDefault(); undo(); }
    else if ((k === 'z' && ev.shiftKey) || k === 'y') { ev.preventDefault(); redo(); }
  });

  // Stack 클래스 실제 소스를 그대로 보여 줌 (화면과 코드가 항상 일치)
  $('#stack-src').textContent = Stack.toString();

  // ---------------- 성능 비교 ----------------
  // 같은 편집 20개를 한 뒤 마지막 1개를 되돌리는 비용 비교:
  //   (A) 스택: pop 한 번 + 저장해 둔 스냅샷 그리기          → 편집 개수와 무관, O(1) + 그리기
  //   (B) 스택 없이: 원본에서 앞의 19개 편집을 다시 계산      → O(k × 픽셀 수)
  const BENCH_SEQ = ['brighten', 'contrast', 'blur', 'sharpen', 'flip', 'invert', 'darken', 'blur', 'rotate', 'contrast',
                     'sharpen', 'brighten', 'flip', 'blur', 'invert', 'rotate', 'darken', 'contrast', 'hot', 'edges'];

  function median(arr) {
    const a = arr.slice().sort((x, y) => x - y);
    return a[Math.floor(a.length / 2)];
  }

  function runBenchmark() {
    const k = BENCH_SEQ.length;
    const snaps = [original];
    for (const id of BENCH_SEQ) snaps.push(EDITS[id].apply(snaps[snaps.length - 1]));

    const off = document.createElement('canvas');
    off.width = SIZE; off.height = SIZE;
    const octx = off.getContext('2d');

    // (A) 스택 Undo
    const st = new Stack(MAX_HISTORY);
    for (let i = 0; i < k; i++) st.push({ label: BENCH_SEQ[i], before: snaps[i] });
    const REP = 400;
    let t0 = performance.now();
    for (let r = 0; r < REP; r++) {
      const e = st.pop();
      octx.putImageData(e.before, 0, 0);
      st.push(e);
    }
    const stackMs = (performance.now() - t0) / REP;

    // (B) 다시 계산
    const times = [];
    for (let r = 0; r < 7; r++) {
      t0 = performance.now();
      let img = original;
      for (let i = 0; i < k - 1; i++) img = EDITS[BENCH_SEQ[i]].apply(img);
      octx.putImageData(img, 0, 0);
      times.push(performance.now() - t0);
    }
    const replayMs = median(times);
    return { k, stackMs, replayMs };
  }

  $('#bench').addEventListener('click', () => {
    const out = $('#bench-out');
    const btn = $('#bench');
    btn.disabled = true;
    out.textContent = '측정 중…';
    setTimeout(() => {
      const { k, stackMs, replayMs } = runBenchmark();
      const ratio = replayMs / Math.max(stackMs, 1e-6);
      out.innerHTML =
        `<span class="b-a">Stack Undo <strong>${stackMs.toFixed(3)} ms</strong></span>` +
        `<span class="b-vs">vs</span>` +
        `<span class="b-b">다시 계산 <strong>${replayMs.toFixed(1)} ms</strong></span>` +
        `<span class="b-note">편집 ${k}개 중 마지막 1개를 되돌릴 때 · 약 ${Math.round(ratio).toLocaleString()}배 · 이 기기에서 측정</span>`;
      btn.disabled = false;
      window.__lastBenchmark = { k, stackMs, replayMs };
    }, 30);
  });

  // ---------------- 기타 ----------------
  if (SITE.githubUsername) {
    const a = $('#github-link');
    a.href = `https://github.com/${SITE.githubUsername}`;
    a.textContent = `github.com/${SITE.githubUsername}`;
    a.closest('li').hidden = false;
  }
  $('#year').textContent = new Date().getFullYear();

  draw();
  renderStacks();
  say('편집 버튼을 누르면 직전 이미지가 스택에 push됩니다.');
})();
