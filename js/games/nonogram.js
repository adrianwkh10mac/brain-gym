// ===== 数织 Nonogram：按数字提示涂格子，浮现像素画 =====
BrainGym.register({
  id: 'nonogram',
  name: '数织',
  icon: '🧶',
  tone: 'lavender',
  tag: '逻辑+像素画',
  desc: '数字表示这一行/列里连续涂色格的长度。用逻辑推出该涂哪些格子，涂完会浮现一幅像素图案！',
  practice: [
    { key: 'e', label: '5×5', params: { size: 5 } },
    { key: 'm', label: '10×10', params: { size: 10 } },
    { key: 'h', label: '15×15', params: { size: 15 } },
  ],
  challenge(lv) {
    return {
      size: lv <= 2 ? 5 : lv <= 6 ? 10 : 15,
      maxMistakes: lv < 12 ? 3 : lv < 25 ? 2 : 1,
    };
  },
  start(host, params, api) {
    api.setInfo('🎲 出题中…');
    let p = null;
    let mistakes = 0, tool = 'fill'; // fill | mark
    let state = [];   // 0 未知 1 已涂 2 打叉
    let cellEls = [], rowClueEls = [], colClueEls = [];
    let filled = 0, need = 0;

    setTimeout(() => {
      p = BrainGym.gen.nonogram(params.size);
      if (!p) { api.fail('出题失败了，换一关试试'); return; }
      need = p.solution.filter(v => v === 1).length;
      state = new Array(params.size * params.size).fill(0);
      build();
      updateInfo();
    }, 30);

    function build() {
      const size = params.size;
      const wrap = document.createElement('div');
      wrap.className = 'nono-wrap' + (size >= 15 ? ' nono-dense' : size >= 10 ? ' nono-mid' : '');
      const grid = document.createElement('div');
      grid.className = 'nono-grid';
      grid.style.gridTemplateColumns = `auto repeat(${size}, 1fr)`;

      // 左上角
      const corner = document.createElement('div');
      corner.className = 'nono-corner';
      grid.appendChild(corner);
      // 列提示
      for (let c = 0; c < size; c++) {
        const el = document.createElement('div');
        el.className = 'nono-clue nono-colclue';
        el.innerHTML = (p.colClues[c].length ? p.colClues[c] : [0]).map(v => `<span>${v}</span>`).join('');
        grid.appendChild(el);
        colClueEls.push(el);
      }
      // 每行：行提示 + 格子
      for (let r = 0; r < size; r++) {
        const rc = document.createElement('div');
        rc.className = 'nono-clue nono-rowclue';
        rc.textContent = (p.rowClues[r].length ? p.rowClues[r] : [0]).join(' ');
        grid.appendChild(rc);
        rowClueEls.push(rc);
        for (let c = 0; c < size; c++) {
          const b = document.createElement('button');
          b.className = 'nono-cell';
          if (c % 5 === 4 && c !== size - 1) b.classList.add('gr');
          if (r % 5 === 4 && r !== size - 1) b.classList.add('gb');
          const idx = r * size + c;
          b.onclick = () => tap(idx);
          grid.appendChild(b);
          cellEls.push(b);
        }
      }
      wrap.appendChild(grid);
      host.appendChild(wrap);

      // 工具切换
      const tools = document.createElement('div');
      tools.className = 'nono-tools';
      const tFill = document.createElement('button');
      tFill.className = 'btn tool-btn on';
      tFill.textContent = '🟪 涂色';
      const tMark = document.createElement('button');
      tMark.className = 'btn tool-btn';
      tMark.textContent = '✖️ 打叉';
      tFill.onclick = () => { tool = 'fill'; tFill.classList.add('on'); tMark.classList.remove('on'); };
      tMark.onclick = () => { tool = 'mark'; tMark.classList.add('on'); tFill.classList.remove('on'); };
      tools.appendChild(tFill);
      tools.appendChild(tMark);
      host.appendChild(tools);
    }

    function tap(idx) {
      if (!p || state[idx] === 1) return;
      const b = cellEls[idx];
      if (tool === 'mark') {
        state[idx] = state[idx] === 2 ? 0 : 2;
        b.classList.toggle('marked', state[idx] === 2);
        return;
      }
      // 涂色：对错即时反馈
      if (p.solution[idx] === 1) {
        state[idx] = 1;
        filled++;
        b.classList.remove('marked');
        b.classList.add('filled');
        checkLines(idx);
        updateInfo();
        if (filled === need) {
          cellEls.forEach((el, i) => { if (state[i] === 2) el.classList.remove('marked'); });
          api.win({ detail: `🧶 ${params.size}×${params.size} · 失误 ${mistakes} 次` });
        }
      } else {
        mistakes++;
        state[idx] = 2;
        b.classList.remove('flash-wrong'); void b.offsetWidth;
        b.classList.add('flash-wrong', 'marked');
        updateInfo();
        if (params.maxMistakes && mistakes >= params.maxMistakes) {
          setTimeout(() => api.fail(`错了 ${mistakes} 次！这一格其实是空的`), 400);
        }
      }
    }

    // 某行/列涂满后把提示变淡
    function checkLines(idx) {
      const size = params.size;
      const r = Math.floor(idx / size), c = idx % size;
      let rowDone = true, colDone = true;
      for (let i = 0; i < size; i++) {
        if (p.solution[r * size + i] === 1 && state[r * size + i] !== 1) rowDone = false;
        if (p.solution[i * size + c] === 1 && state[i * size + c] !== 1) colDone = false;
      }
      if (rowDone) rowClueEls[r].classList.add('done');
      if (colDone) colClueEls[c].classList.add('done');
    }

    function updateInfo() {
      let html = `已涂 <b class="info-big">${filled}</b> / ${need}`;
      if (params.maxMistakes) html += ` <span class="info-limit">💔 错误 ${mistakes}/${params.maxMistakes}</span>`;
      else if (mistakes) html += ` · 失误 ${mistakes} 次`;
      api.setInfo(html);
    }
  },
});
