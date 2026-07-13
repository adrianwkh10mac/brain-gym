// ===== 数独：经典 9×9，支持笔记模式 =====
BrainGym.register({
  id: 'sudoku',
  name: '数独',
  icon: '9️⃣',
  tone: 'mint',
  tag: '逻辑推理',
  desc: '每行、每列、每个九宫格都要填齐 1~9 且不重复。✏️ 笔记模式可以先记候选数。',
  practice: [
    { key: 'e', label: '简单', params: { holes: 40 } },
    { key: 'm', label: '中等', params: { holes: 46 } },
    { key: 'h', label: '困难', params: { holes: 50 } },
    { key: 'x', label: '地狱', params: { holes: 54 } },
  ],
  // 闯关：挖洞渐多；深关允许的错误次数越来越少
  challenge(lv) {
    return {
      holes: Math.min(30 + Math.round(lv * 0.68), 64),
      maxMistakes: lv < 18 ? 3 : lv < 38 ? 2 : 1,
    };
  },
  start(host, params, api) {
    api.setInfo('🎲 出题中…');
    let puzzle, solution, current, notes;
    let selected = -1, mistakes = 0, pencil = false;
    let cells = [], keyBtns = [];
    let cancelled = false;

    const genTimer = setTimeout(() => {
      if (cancelled) return;
      const p = BrainGym.gen.sudoku(params.holes);
      puzzle = p.puzzle; solution = p.solution;
      current = puzzle.slice();
      notes = Array.from({ length: 81 }, () => new Set());
      build();
      render();
    }, 30);

    function build() {
      const board = document.createElement('div');
      board.className = 'sudoku-board';
      for (let i = 0; i < 81; i++) {
        const b = document.createElement('button');
        b.className = 'sudoku-cell';
        const r = Math.floor(i / 9), c = i % 9;
        if (r % 3 === 0) b.classList.add('bt');
        if (c % 3 === 0) b.classList.add('bl');
        if (r === 8) b.classList.add('bb');
        if (c === 8) b.classList.add('br');
        b.onclick = () => { selected = i; render(); };
        board.appendChild(b);
        cells.push(b);
      }
      host.appendChild(board);

      const pad = document.createElement('div');
      pad.className = 'sudoku-pad';
      for (let v = 1; v <= 9; v++) {
        const k = document.createElement('button');
        k.className = 'pad-key';
        k.innerHTML = `${v}<small></small>`;
        k.onclick = () => input(v);
        pad.appendChild(k);
        keyBtns.push(k);
      }
      const erase = document.createElement('button');
      erase.className = 'pad-key pad-tool';
      erase.textContent = '⌫';
      erase.onclick = () => {
        if (selected < 0 || puzzle[selected] !== 0) return;
        current[selected] = 0;
        notes[selected].clear();
        render();
      };
      pad.appendChild(erase);
      const pen = document.createElement('button');
      pen.className = 'pad-key pad-tool';
      pen.textContent = '✏️';
      pen.onclick = () => { pencil = !pencil; pen.classList.toggle('on', pencil); updateInfo(); };
      pad.appendChild(pen);
      host.appendChild(pad);
    }

    function input(v) {
      if (selected < 0 || puzzle[selected] !== 0) return;
      if (pencil) {
        if (current[selected] !== 0) return;
        if (notes[selected].has(v)) notes[selected].delete(v);
        else notes[selected].add(v);
        render();
        return;
      }
      if (current[selected] === v) return;
      current[selected] = v;
      notes[selected].clear();
      if (v !== solution[selected]) {
        mistakes++;
        cells[selected].classList.remove('flash-wrong'); void cells[selected].offsetWidth;
        cells[selected].classList.add('flash-wrong');
        if (params.maxMistakes && mistakes >= params.maxMistakes) {
          render();
          setTimeout(() => api.fail(`错了 ${mistakes} 次，差一点点！`), 400);
          return;
        }
      } else {
        // 填对了：清掉同行/列/宫里这个数字的笔记
        const r = Math.floor(selected / 9), c = selected % 9;
        for (let i = 0; i < 81; i++) {
          const ir = Math.floor(i / 9), ic = i % 9;
          if (ir === r || ic === c ||
            (Math.floor(ir / 3) === Math.floor(r / 3) && Math.floor(ic / 3) === Math.floor(c / 3))) {
            notes[i].delete(v);
          }
        }
      }
      render();
      if (current.every((x, i) => x === solution[i])) {
        api.win({ detail: `9️⃣ 挖了 ${params.holes} 个洞 · 失误 ${mistakes} 次` });
      }
    }

    function updateInfo() {
      let html = `${pencil ? '✏️ 笔记模式' : '🖊️ 填写模式'}`;
      if (params.maxMistakes) html += ` <span class="info-limit">💔 错误 ${mistakes}/${params.maxMistakes}</span>`;
      else if (mistakes) html += ` · 失误 ${mistakes} 次`;
      api.setInfo(html);
    }

    function render() {
      updateInfo();
      const selVal = selected >= 0 ? current[selected] : 0;
      const selR = Math.floor(selected / 9), selC = selected % 9;
      const remain = new Array(10).fill(9);
      current.forEach(v => { if (v) remain[v]--; });
      keyBtns.forEach((k, idx) => {
        k.querySelector('small').textContent = Math.max(0, remain[idx + 1]);
        k.classList.toggle('used-up', remain[idx + 1] <= 0);
      });
      for (let i = 0; i < 81; i++) {
        const b = cells[i];
        const v = current[i];
        const r = Math.floor(i / 9), c = i % 9;
        b.classList.toggle('given', puzzle[i] !== 0);
        b.classList.toggle('sel', i === selected);
        b.classList.toggle('peer', selected >= 0 && i !== selected &&
          (r === selR || c === selC ||
            (Math.floor(r / 3) === Math.floor(selR / 3) && Math.floor(c / 3) === Math.floor(selC / 3))));
        b.classList.toggle('same', v !== 0 && v === selVal && i !== selected);
        b.classList.toggle('wrong', v !== 0 && puzzle[i] === 0 && v !== solution[i]);
        if (v !== 0) {
          b.textContent = v;
        } else if (notes[i] && notes[i].size) {
          b.innerHTML = '<span class="notes">' +
            [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<i>${notes[i].has(n) ? n : ''}</i>`).join('') +
            '</span>';
        } else {
          b.textContent = '';
        }
      }
    }

    return () => { cancelled = true; clearTimeout(genTimer); };
  },
});
