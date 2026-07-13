// ===== 数字华容道：滑动方块排回顺序 =====
BrainGym.register({
  id: 'slide',
  name: '数字华容道',
  icon: '🧩',
  tone: 'yellow',
  tag: '空间思维',
  desc: '点击空格旁边的数字把它滑过去，把所有数字排回 1、2、3…的顺序。',
  practice: [
    { key: 'e', label: '3×3', params: { n: 3 } },
    { key: 'm', label: '4×4', params: { n: 4 } },
    { key: 'h', label: '5×5', params: { n: 5 } },
    { key: 'x', label: '6×6 疯狂', params: { n: 6 } },
  ],
  // 闯关：尺寸递增到 6×6，之后步数预算越收越紧（保底 = 格数×10，高手可完成）
  challenge(lv) {
    const n = lv <= 2 ? 3 : lv <= 5 ? 4 : lv <= 10 ? 5 : lv <= 25 ? 6 : 7;
    const budget = lv <= 8 ? 0 : Math.max(n * n * 8, 900 - (lv - 8) * 15);
    return { n, budget };
  },
  start(host, params, api) {
    const n = params.n;
    let tiles = BrainGym.gen.slide(n);
    let moves = 0;

    const board = document.createElement('div');
    board.className = 'slide-board';
    board.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    host.appendChild(board);

    function updateInfo() {
      let html = `步数 <b class="info-big">${moves}</b>`;
      if (params.budget) html += ` <span class="info-limit">🎯 预算 ${params.budget} 步</span>`;
      api.setInfo(html);
    }

    function render() {
      board.innerHTML = '';
      tiles.forEach((v, i) => {
        const cell = document.createElement('button');
        cell.className = v === 0 ? 'slide-cell blank' : 'slide-cell';
        if (v !== 0) {
          cell.textContent = v;
          if (v === i + 1) cell.classList.add('inplace');
          cell.onclick = () => tryMove(i);
        }
        board.appendChild(cell);
      });
    }

    function tryMove(i) {
      const b = tiles.indexOf(0);
      const r1 = Math.floor(i / n), c1 = i % n, r2 = Math.floor(b / n), c2 = b % n;
      if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return;
      [tiles[i], tiles[b]] = [tiles[b], tiles[i]];
      moves++;
      render();
      updateInfo();
      if (tiles.slice(0, -1).every((v, idx) => v === idx + 1)) {
        api.win({ detail: `🧩 共用了 ${moves} 步` });
        return;
      }
      if (params.budget && moves >= params.budget) {
        api.fail('步数预算用完啦！下次想好再动手～');
      }
    }

    render();
    updateInfo();
  },
});
