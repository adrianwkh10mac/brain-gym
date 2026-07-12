// ===== 水果消消乐：交换相邻水果，凑齐 3 个以上同种连成一排就会消除 =====
BrainGym.register({
  id: 'match3',
  name: '水果消消乐',
  icon: '🍓',
  tone: 'yellow',
  tag: '消除',
  cat: 'arcade',
  desc: '点一个水果，再点旁边相邻的一个来交换位置。凑齐 3 个或以上同种水果连成一排（横或竖）就会消除，掉分！步数用完前拿到目标分数就算过关。',
  practice: [
    { key: 'e', label: '简单', params: { n: 6, colors: 4, moves: 22, target: 55 } },
    { key: 'm', label: '中等', params: { n: 7, colors: 5, moves: 22, target: 90 } },
    { key: 'h', label: '困难', params: { n: 8, colors: 5, moves: 20, target: 130 } },
    { key: 'x', label: '地狱', params: { n: 8, colors: 6, moves: 18, target: 170 } },
  ],
  // 闯关：棋盘渐大、水果种类渐多（更难凑match）、步数渐少、目标分渐高
  challenge(lv) {
    const n = Math.min(6 + Math.floor(lv / 8), 9);
    const colors = Math.min(4 + Math.floor(lv / 6), 7);
    const moves = Math.max(14, 22 - Math.floor(lv / 5));
    const target = Math.round(45 + lv * 8.5);
    return { n, colors, moves, target };
  },
  start(host, params, api) {
    const { randInt } = BrainGym.utils;
    const FRUITS = ['🍓', '🍋', '🍇', '🍊', '🍉', '🍒', '🥝'];
    const n = params.n, COLORS = Math.min(params.colors, FRUITS.length);

    let grid = new Array(n * n).fill(0);
    let cellEls = [];
    let sel = null;
    let score = 0;
    let movesLeft = params.moves;
    let busy = false;
    let cancelled = false;
    const timers = [];

    function setT(fn, ms) {
      const id = setTimeout(() => { if (!cancelled) fn(); }, ms);
      timers.push(id);
      return id;
    }

    const idx = (r, c) => r * n + c;
    const randColor = () => randInt(COLORS);

    function findMatches() {
      const matched = new Set();
      for (let r = 0; r < n; r++) {
        let runStart = 0;
        for (let c = 1; c <= n; c++) {
          if (c < n && grid[idx(r, c)] === grid[idx(r, runStart)] && grid[idx(r, c)] !== -1) continue;
          if (c - runStart >= 3) for (let k = runStart; k < c; k++) matched.add(idx(r, k));
          runStart = c;
        }
      }
      for (let c = 0; c < n; c++) {
        let runStart = 0;
        for (let r = 1; r <= n; r++) {
          if (r < n && grid[idx(r, c)] === grid[idx(runStart, c)] && grid[idx(r, c)] !== -1) continue;
          if (r - runStart >= 3) for (let k = runStart; k < r; k++) matched.add(idx(k, c));
          runStart = r;
        }
      }
      return matched;
    }

    function swapProducesMatch(a, b) {
      [grid[a], grid[b]] = [grid[b], grid[a]];
      const has = findMatches().size > 0;
      [grid[a], grid[b]] = [grid[b], grid[a]];
      return has;
    }

    function hasValidMove() {
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
          const v = grid[idx(r, c)];
          if (v !== -1) { grid[idx(write, c)] = v; write--; }
        }
        for (let r = write; r >= 0; r--) grid[idx(r, c)] = randColor();
      }
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
        el.textContent = v === -1 ? '' : FRUITS[v];
        el.classList.toggle('sel', sel === i);
        el.classList.toggle('pop', !!(highlightSet && highlightSet.has(i)));
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
      if (busy || cancelled || grid[i] === -1) return;
      if (sel === null) { sel = i; render(); return; }
      if (sel === i) { sel = null; render(); return; }
      const sr = Math.floor(sel / n), sc = sel % n, r = Math.floor(i / n), c = i % n;
      const adjacent = Math.abs(sr - r) + Math.abs(sc - c) === 1;
      if (!adjacent) { sel = i; render(); return; }
      const a = sel, b = i;
      sel = null;
      [grid[a], grid[b]] = [grid[b], grid[a]];
      const matched = findMatches();
      if (!matched.size) {
        [grid[a], grid[b]] = [grid[b], grid[a]];
        render();
        shake(a, b);
        return;
      }
      movesLeft--;
      busy = true;
      render(matched);
      setT(() => resolveStep(matched), 220);
    }

    function resolveStep(matched) {
      matched.forEach(i => { score += 10; grid[i] = -1; });
      dropAndRefill();
      render();
      const next = findMatches();
      if (next.size) {
        render(next);
        setT(() => resolveStep(next), 220);
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
