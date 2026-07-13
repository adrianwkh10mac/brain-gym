// ===== 水果消消乐：交换相邻水果，凑齐 3 个以上同种连成一排就会消除，凑 4/5 个会有 Super Power =====
BrainGym.register({
  id: 'match3',
  name: '水果消消乐',
  icon: '🍓',
  tone: 'yellow',
  tag: '消除',
  cat: 'arcade',
  desc: '点一个水果，再点旁边相邻的一个来交换位置。凑齐 3 个以上同种水果连成一排（横或竖）就会消除，掉分！凑齐 4 个会变成💥条纹特殊水果（消除时清空整行或整列），凑齐 5 个会变成🌈彩虹炸弹（消除时清空棋盘上所有同种水果）。步数用完前拿到目标分数就算过关。',
  practice: [
    { key: 'e', label: '简单', params: { n: 6, colors: 4, moves: 22, target: 55 } },
    { key: 'm', label: '中等', params: { n: 7, colors: 5, moves: 22, target: 90 } },
    { key: 'h', label: '困难', params: { n: 8, colors: 5, moves: 20, target: 130 } },
    { key: 'x', label: '地狱', params: { n: 8, colors: 6, moves: 18, target: 170 } },
  ],
  // 闯关：棋盘渐大、水果种类渐多（更难凑match）、步数渐少、目标分渐高
  challenge(lv) {
    const n = Math.min(6 + Math.floor(lv / 10), 9);
    const colors = Math.min(4 + Math.floor(lv / 9), 7);
    const moves = Math.max(12, 24 - Math.floor(lv / 4));
    const target = Math.round(45 + lv * 8.5);
    return { n, colors, moves, target };
  },
  start(host, params, api) {
    const { randInt } = BrainGym.utils;
    const FRUITS = ['🍓', '🍋', '🍇', '🍊', '🍉', '🍒', '🥝'];
    const n = params.n, COLORS = Math.min(params.colors, FRUITS.length);

    const EMPTY = -1;
    const BOMB = -2; // grid 里的哨兵值：表示这是彩虹炸弹格子（没有固定颜色）
    // kind: 0 普通 / 1 横向条纹 / 2 纵向条纹 / 3 彩虹炸弹
    const KIND_NONE = 0, KIND_H = 1, KIND_V = 2, KIND_BOMB = 3;

    let grid = new Array(n * n).fill(0);
    let kind = new Array(n * n).fill(KIND_NONE);
    let cellEls = [];
    let sel = null;
    let score = 0;
    let movesLeft = params.moves;
    let busy = false;
    let cancelled = false;
    let currentBombTargets = null; // Map<idx, colorOrALL>，只在一次特殊交换触发期间生效
    const timers = [];

    function setT(fn, ms) {
      const id = setTimeout(() => { if (!cancelled) fn(); }, ms);
      timers.push(id);
      return id;
    }

    const idx = (r, c) => r * n + c;
    const randColor = () => randInt(COLORS);

    function findMatchesDetailed() {
      const matched = new Set();
      const runs = [];
      for (let r = 0; r < n; r++) {
        let runStart = 0;
        for (let c = 1; c <= n; c++) {
          if (c < n && grid[idx(r, c)] === grid[idx(r, runStart)] && grid[idx(r, runStart)] >= 0) continue;
          const len = c - runStart;
          if (len >= 3) {
            const cells = [];
            for (let k = runStart; k < c; k++) { cells.push(idx(r, k)); matched.add(idx(r, k)); }
            runs.push({ cells, orientation: 'h', color: grid[idx(r, runStart)], length: len });
          }
          runStart = c;
        }
      }
      for (let c = 0; c < n; c++) {
        let runStart = 0;
        for (let r = 1; r <= n; r++) {
          if (r < n && grid[idx(r, c)] === grid[idx(runStart, c)] && grid[idx(runStart, c)] >= 0) continue;
          const len = r - runStart;
          if (len >= 3) {
            const cells = [];
            for (let k = runStart; k < r; k++) { cells.push(idx(k, c)); matched.add(idx(k, c)); }
            runs.push({ cells, orientation: 'v', color: grid[idx(runStart, c)], length: len });
          }
          runStart = r;
        }
      }
      return { matched, runs };
    }
    function findMatches() { return findMatchesDetailed().matched; }

    function swapProducesMatch(a, b) {
      [grid[a], grid[b]] = [grid[b], grid[a]];
      const has = findMatches().size > 0;
      [grid[a], grid[b]] = [grid[b], grid[a]];
      return has;
    }

    function hasValidMove() {
      // 场上还有特殊水果时，跟任何相邻水果交换都是合法的一步
      for (let i = 0; i < n * n; i++) {
        if (kind[i] === KIND_NONE || grid[i] === EMPTY) continue;
        const r = Math.floor(i / n), c = i % n;
        if ((c < n - 1 && grid[idx(r, c + 1)] !== EMPTY) ||
          (c > 0 && grid[idx(r, c - 1)] !== EMPTY) ||
          (r < n - 1 && grid[idx(r + 1, c)] !== EMPTY) ||
          (r > 0 && grid[idx(r - 1, c)] !== EMPTY)) return true;
      }
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const i = idx(r, c);
          if (c < n - 1 && swapProducesMatch(i, idx(r, c + 1))) return true;
          if (r < n - 1 && swapProducesMatch(i, idx(r + 1, c))) return true;
        }
      }
      return false;
    }

    function genBoard() {
      let attempts = 0;
      do {
        kind.fill(KIND_NONE);
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            let v, tries = 0;
            do {
              v = randColor(); tries++;
            } while (tries < 30 && (
              (c >= 2 && grid[idx(r, c - 1)] === v && grid[idx(r, c - 2)] === v) ||
              (r >= 2 && grid[idx(r - 1, c)] === v && grid[idx(r - 2, c)] === v)
            ));
            grid[idx(r, c)] = v;
          }
        }
        attempts++;
      } while (!hasValidMove() && attempts < 20);
    }

    function dropAndRefill() {
      for (let c = 0; c < n; c++) {
        let write = n - 1;
        for (let r = n - 1; r >= 0; r--) {
          const i = idx(r, c);
          const v = grid[i], k = kind[i];
          if (v !== EMPTY) {
            const w = idx(write, c);
            grid[w] = v; kind[w] = k;
            write--;
          }
        }
        for (let r = write; r >= 0; r--) {
          const w = idx(r, c);
          grid[w] = randColor(); kind[w] = KIND_NONE;
        }
      }
    }

    // ---------- 特殊水果：条纹（清行/列）+ 彩虹炸弹（清同色） ----------
    function pickBombTargetColor(bombIdx) {
      if (currentBombTargets && currentBombTargets.has(bombIdx)) {
        const t = currentBombTargets.get(bombIdx);
        if (t !== null) return t;
      }
      const counts = new Array(COLORS).fill(0);
      for (let j = 0; j < n * n; j++) if (grid[j] >= 0) counts[grid[j]]++;
      let best = 0, bestCount = -1;
      for (let c = 0; c < COLORS; c++) if (counts[c] > bestCount) { bestCount = counts[c]; best = c; }
      return best;
    }

    // 从种子格子出发，反复展开：命中条纹→清整行/整列；命中炸弹→清同色（或全场）；直到不再增长
    function expandSpecials(seedSet) {
      const result = new Set(seedSet);
      const fired = new Set();
      let changed = true;
      while (changed) {
        changed = false;
        Array.from(result).forEach(i => {
          if (fired.has(i)) return;
          fired.add(i);
          const k = kind[i];
          if (k === KIND_H) {
            const r = Math.floor(i / n);
            for (let c = 0; c < n; c++) { const j = idx(r, c); if (grid[j] !== EMPTY && !result.has(j)) { result.add(j); changed = true; } }
          } else if (k === KIND_V) {
            const c = i % n;
            for (let r = 0; r < n; r++) { const j = idx(r, c); if (grid[j] !== EMPTY && !result.has(j)) { result.add(j); changed = true; } }
          } else if (k === KIND_BOMB) {
            const target = pickBombTargetColor(i);
            for (let j = 0; j < n * n; j++) {
              if (grid[j] === EMPTY || result.has(j)) continue;
              if (target === 'ALL' || grid[j] === target) { result.add(j); changed = true; }
            }
          }
        });
      }
      return result;
    }

    // 根据本次消除涉及的连线（runs），决定要新生成哪些特殊水果，anchor 优先落在玩家交换的格子上
    function planSpecials(runs, matchedSet, preferA, preferB) {
      const anchors = new Map(); // idx -> { color, kindType }
      const usedAnchors = new Set();
      const sorted = runs.slice().sort((x, y) => y.length - x.length);
      sorted.forEach(run => {
        if (run.length < 4) return;
        const kindType = run.length >= 5 ? KIND_BOMB : (run.orientation === 'h' ? KIND_H : KIND_V);
        let anchor = null;
        if (preferB != null && run.cells.includes(preferB) && !usedAnchors.has(preferB)) anchor = preferB;
        else if (preferA != null && run.cells.includes(preferA) && !usedAnchors.has(preferA)) anchor = preferA;
        else anchor = run.cells[Math.floor(run.cells.length / 2)];
        if (usedAnchors.has(anchor)) return;
        usedAnchors.add(anchor);
        anchors.set(anchor, { color: run.color, kindType });
      });
      const toClear = new Set(matchedSet);
      anchors.forEach((_, aidx) => toClear.delete(aidx));
      return { toClear, anchors };
    }

    function applyNewSpecials(anchors) {
      anchors.forEach((info, aidx) => {
        if (info.kindType === KIND_BOMB) { grid[aidx] = BOMB; kind[aidx] = KIND_BOMB; }
        else { kind[aidx] = info.kindType; } // grid 颜色保持不变
        score += 20;
      });
    }

    function build() {
      const board = document.createElement('div');
      board.className = 'match3-board';
      board.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
      for (let i = 0; i < n * n; i++) {
        const b = document.createElement('button');
        b.className = 'match3-cell';
        b.onclick = () => onTap(i);
        board.appendChild(b);
        cellEls.push(b);
      }
      host.appendChild(board);
    }

    function render(highlightSet) {
      grid.forEach((v, i) => {
        const el = cellEls[i];
        const k = kind[i];
        el.textContent = v === EMPTY ? '' : (k === KIND_BOMB ? '🌈' : FRUITS[v]);
        el.classList.toggle('sel', sel === i);
        el.classList.toggle('pop', !!(highlightSet && highlightSet.has(i)));
        el.classList.toggle('stripe-h', k === KIND_H);
        el.classList.toggle('stripe-v', k === KIND_V);
        el.classList.toggle('bomb', k === KIND_BOMB);
      });
    }

    function updateInfo() {
      api.setInfo(`目标 <b class="info-big">${score}</b> / ${params.target} 分　剩余 <span class="info-limit">${movesLeft} 步</span>`);
    }

    function shake(a, b) {
      [a, b].forEach(i => {
        const el = cellEls[i];
        el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
      });
      setT(() => { [a, b].forEach(i => cellEls[i].classList.remove('shake')); }, 300);
    }

    function onTap(i) {
      if (busy || cancelled || grid[i] === EMPTY) return;
      if (sel === null) { sel = i; render(); return; }
      if (sel === i) { sel = null; render(); return; }
      const sr = Math.floor(sel / n), sc = sel % n, r = Math.floor(i / n), c = i % n;
      const adjacent = Math.abs(sr - r) + Math.abs(sc - c) === 1;
      if (!adjacent) { sel = i; render(); return; }
      const a = sel, b = i;
      sel = null;

      // 特殊水果参与的交换：不需要凑色，直接触发能力，必定消耗一步
      if (kind[a] !== KIND_NONE || kind[b] !== KIND_NONE) {
        movesLeft--;
        busy = true;
        const bombTargets = new Map();
        if (kind[a] === KIND_BOMB && kind[b] === KIND_BOMB) {
          bombTargets.set(a, 'ALL'); bombTargets.set(b, 'ALL');
        } else if (kind[a] === KIND_BOMB) {
          bombTargets.set(a, grid[b] >= 0 ? grid[b] : null);
        } else if (kind[b] === KIND_BOMB) {
          bombTargets.set(b, grid[a] >= 0 ? grid[a] : null);
        }
        currentBombTargets = bombTargets;
        const cleared = expandSpecials(new Set([a, b]));
        currentBombTargets = null;
        score += 30; // 使用必杀技的额外奖励
        render(cleared);
        setT(() => resolveStep(cleared), 220);
        return;
      }

      [grid[a], grid[b]] = [grid[b], grid[a]];
      const { matched, runs } = findMatchesDetailed();
      if (!matched.size) {
        [grid[a], grid[b]] = [grid[b], grid[a]];
        render();
        shake(a, b);
        return;
      }
      movesLeft--;
      busy = true;
      const expanded = expandSpecials(matched);
      const { toClear, anchors } = planSpecials(runs, expanded, a, b);
      applyNewSpecials(anchors);
      render(toClear);
      setT(() => resolveStep(toClear), 220);
    }

    function resolveStep(toClear) {
      toClear.forEach(i => { score += 10; grid[i] = EMPTY; kind[i] = KIND_NONE; });
      dropAndRefill();
      render();
      const { matched: next, runs } = findMatchesDetailed();
      if (next.size) {
        const expanded = expandSpecials(next);
        const { toClear: nextClear, anchors } = planSpecials(runs, expanded, null, null);
        applyNewSpecials(anchors);
        render(nextClear);
        setT(() => resolveStep(nextClear), 220);
      } else {
        finishTurn();
      }
    }

    function finishTurn() {
      busy = false;
      updateInfo();
      if (score >= params.target) {
        api.win({ detail: `🍓 拿到 ${score} 分，剩余 ${movesLeft} 步` });
        return;
      }
      if (movesLeft <= 0) {
        api.fail(`步数用完啦，拿到了 ${score} / ${params.target} 分`);
        return;
      }
      if (!hasValidMove()) {
        genBoard();
        render();
      }
    }

    build();
    genBoard();
    render();
    updateInfo();

    return () => { cancelled = true; timers.forEach(clearTimeout); };
  },
});
