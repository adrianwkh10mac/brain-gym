// ===== 皇后谜题 Queens：每行/列/色区一只皇后，互不相邻 =====
BrainGym.register({
  id: 'queens',
  name: '皇后谜题',
  icon: '👑',
  tone: 'yellow',
  tag: '逻辑演绎',
  desc: '每行、每列、每个色区恰好放一只 👑，而且任何两只皇后都不能挨着（包括斜角）。点一下画 ✖ 排除，点两下放皇后。',
  practice: [
    { key: 'e', label: '6×6', params: { n: 6 } },
    { key: 'm', label: '7×7', params: { n: 7 } },
    { key: 'h', label: '8×8', params: { n: 8 } },
    { key: 'x', label: '10×10', params: { n: 10 } },
    { key: 'xx', label: '11×11 疯狂', params: { n: 11 } },
  ],
  challenge(lv) {
    return { n: Math.min(5 + Math.ceil(lv / 2), 11) };
  },
  start(host, params, api) {
    const REGION_COLORS = ['#FFD6E0', '#C9EEE3', '#FFE9B8', '#DCD2F7', '#FFDCC9',
      '#C9E4F7', '#E3F0C9', '#F7D2E8', '#D2F7F0', '#EEE0C9', '#D9E2F5'];
    api.setInfo('🎲 出题中…');
    const n = params.n;
    let state = [];   // 0 空 1 ✖ 2 👑
    let cellEls = [];
    let puzzle = null;
    let cancelled = false;

    const genTimer = setTimeout(() => {
      if (cancelled) return;
      puzzle = BrainGym.gen.queens(n);
      if (!puzzle) { api.fail('出题失败了，换一关试试'); return; }
      state = new Array(n * n).fill(0);
      build();
      render();
    }, 30);

    function build() {
      const board = document.createElement('div');
      board.className = 'queens-board';
      board.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
      for (let i = 0; i < n * n; i++) {
        const b = document.createElement('button');
        b.className = 'queens-cell';
        b.style.background = REGION_COLORS[puzzle.regions[i] % REGION_COLORS.length];
        // 色区边界描粗
        const r = Math.floor(i / n), c = i % n;
        if (r === 0 || puzzle.regions[i - n] !== puzzle.regions[i]) b.classList.add('bt');
        if (c === 0 || puzzle.regions[i - 1] !== puzzle.regions[i]) b.classList.add('bl');
        if (r === n - 1) b.classList.add('bb');
        if (c === n - 1) b.classList.add('br');
        b.onclick = () => {
          state[i] = (state[i] + 1) % 3;
          render();
        };
        board.appendChild(b);
        cellEls.push(b);
      }
      host.appendChild(board);

      const tip = document.createElement('p');
      tip.className = 'queens-tip';
      tip.textContent = '点击：空 → ✖ → 👑 → 空';
      host.appendChild(tip);
    }

    function render() {
      const queens = [];
      state.forEach((v, i) => { if (v === 2) queens.push(i); });
      // 找冲突
      const bad = new Set();
      for (let a = 0; a < queens.length; a++) {
        for (let b = a + 1; b < queens.length; b++) {
          const qa = queens[a], qb = queens[b];
          const ra = Math.floor(qa / n), ca = qa % n, rb = Math.floor(qb / n), cb = qb % n;
          if (ra === rb || ca === cb ||
            puzzle.regions[qa] === puzzle.regions[qb] ||
            (Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1)) {
            bad.add(qa); bad.add(qb);
          }
        }
      }
      state.forEach((v, i) => {
        const b = cellEls[i];
        b.textContent = v === 1 ? '✕' : v === 2 ? '👑' : '';
        b.classList.toggle('mark', v === 1);
        b.classList.toggle('queen', v === 2);
        b.classList.toggle('bad', bad.has(i));
      });
      api.setInfo(`已放 <b class="info-big">${queens.length}</b> / ${n} 只皇后` +
        (bad.size ? ' <span class="info-limit">⚠️ 有冲突</span>' : ''));
      if (queens.length === n && bad.size === 0) {
        api.win({ detail: `👑 ${n}×${n} 皇后全部就位，零冲突` });
      }
    }

    return () => { cancelled = true; clearTimeout(genTimer); };
  },
});
