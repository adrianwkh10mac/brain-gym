// ===== 迷宫：把小球滑到出口 =====
BrainGym.register({
  id: 'maze',
  name: '迷宫',
  icon: '🌀',
  tone: 'peach',
  tag: '眼力+耐心',
  desc: '滑动屏幕（或用方向按钮）移动小球，走到右下角的星星就赢。小球会一路滑到岔路口才停。',
  practice: [
    { key: 'e', label: '8×8', params: { size: 8 } },
    { key: 'm', label: '12×12', params: { size: 12 } },
    { key: 'h', label: '16×16', params: { size: 16 } },
    { key: 'x', label: '24×24', params: { size: 24 } },
    { key: 'xx', label: '30×30 疯狂', params: { size: 30 } },
  ],
  // 上限 30：再大手机上通道就细到看不清了
  challenge(lv) {
    return { size: Math.min(6 + Math.round(lv * 0.5), 30) };
  },
  start(host, params, api) {
    const size = params.size;
    const m = BrainGym.gen.maze(size, size);
    const CELL = 10;
    const W = size * CELL;
    let cur = m.start;
    let steps = 0;

    // 方向: 1上 2右 4下 8左
    const DIRS = { 1: [0, -1], 2: [1, 0], 4: [0, 1], 8: [-1, 0] };
    const OPP = { 1: 4, 2: 8, 4: 1, 8: 2 };

    const wrap = document.createElement('div');
    wrap.className = 'maze-wrap';
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `-1 -1 ${W + 2} ${W + 2}`);
    svg.classList.add('maze-svg');

    // 画墙
    let d = '';
    for (let i = 0; i < size * size; i++) {
      const x = (i % size) * CELL, y = Math.floor(i / size) * CELL;
      if (m.walls[i] & 1) d += `M${x} ${y}h${CELL}`;
      if (m.walls[i] & 2) d += `M${x + CELL} ${y}v${CELL}`;
      if (m.walls[i] & 4) d += `M${x} ${y + CELL}h${CELL}`;
      if (m.walls[i] & 8) d += `M${x} ${y}v${CELL}`;
    }
    const wallsPath = document.createElementNS(svgNS, 'path');
    wallsPath.setAttribute('d', d);
    wallsPath.classList.add('maze-walls');
    svg.appendChild(wallsPath);

    // 轨迹
    const trail = document.createElementNS(svgNS, 'path');
    trail.classList.add('maze-trail');
    let trailD = `M${CELL / 2} ${CELL / 2}`;
    trail.setAttribute('d', trailD);
    svg.appendChild(trail);

    // 出口星星
    const exit = document.createElementNS(svgNS, 'text');
    exit.textContent = '⭐';
    exit.setAttribute('x', (size - 0.5) * CELL);
    exit.setAttribute('y', (size - 0.5) * CELL);
    exit.classList.add('maze-exit');
    svg.appendChild(exit);

    // 小球
    const ball = document.createElementNS(svgNS, 'circle');
    ball.setAttribute('r', CELL * 0.32);
    ball.classList.add('maze-ball');
    svg.appendChild(ball);
    function placeBall() {
      ball.setAttribute('cx', (cur % size) * CELL + CELL / 2);
      ball.setAttribute('cy', Math.floor(cur / size) * CELL + CELL / 2);
    }
    placeBall();

    wrap.appendChild(svg);
    host.appendChild(wrap);

    // 方向按钮
    const pad = document.createElement('div');
    pad.className = 'maze-pad';
    pad.innerHTML = `
      <button class="pad-btn" data-dir="1">▲</button>
      <div class="pad-mid">
        <button class="pad-btn" data-dir="8">◀</button>
        <button class="pad-btn" data-dir="2">▶</button>
      </div>
      <button class="pad-btn" data-dir="4">▼</button>`;
    pad.querySelectorAll('.pad-btn').forEach(b => {
      b.onclick = () => move(Number(b.dataset.dir));
    });
    host.appendChild(pad);

    function openDirs(cell) {
      const out = [];
      for (const bit of [1, 2, 4, 8]) if (!(m.walls[cell] & bit)) out.push(bit);
      return out;
    }

    // 沿方向滑行，遇到墙 / 岔路口 / 拐角 / 终点才停
    function move(dir) {
      if (m.walls[cur] & dir) return;
      let moved = false;
      while (!(m.walls[cur] & dir)) {
        const [dx, dy] = DIRS[dir];
        cur = cur + dy * size + dx;
        moved = true;
        trailD += `L${(cur % size) * CELL + CELL / 2} ${Math.floor(cur / size) * CELL + CELL / 2}`;
        if (cur === m.end) break;
        const opens = openDirs(cur).filter(b => b !== OPP[dir]);
        if (!(opens.length === 1 && opens[0] === dir)) break; // 岔路/拐角停下
      }
      if (!moved) return;
      steps++;
      trail.setAttribute('d', trailD);
      placeBall();
      api.setInfo(`已走 <b class="info-big">${steps}</b> 段`);
      if (cur === m.end) api.win({ detail: `🌀 ${size}×${size} 迷宫 · ${steps} 段路走出来` });
    }

    // 滑动手势
    let touchStart = null;
    const onTouchStart = e => { touchStart = [e.touches[0].clientX, e.touches[0].clientY]; };
    const onTouchEnd = e => {
      if (!touchStart) return;
      const dx = e.changedTouches[0].clientX - touchStart[0];
      const dy = e.changedTouches[0].clientY - touchStart[1];
      touchStart = null;
      if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
      move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 8) : (dy > 0 ? 4 : 1));
    };
    wrap.addEventListener('touchstart', onTouchStart, { passive: true });
    wrap.addEventListener('touchend', onTouchEnd, { passive: true });

    // 键盘方向键
    const onKey = e => {
      const map = { ArrowUp: 1, ArrowRight: 2, ArrowDown: 4, ArrowLeft: 8 };
      if (map[e.key]) { e.preventDefault(); move(map[e.key]); }
    };
    document.addEventListener('keydown', onKey);

    api.setInfo('滑动屏幕或按 ▲▼◀▶ 移动');
    return () => document.removeEventListener('keydown', onKey);
  },
});
