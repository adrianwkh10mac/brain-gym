// ===== 彩虹连线 Flow：把同色圆点连起来，铺满整个棋盘 =====
BrainGym.register({
  id: 'flow',
  name: '彩虹连线',
  icon: '🌈',
  tone: 'pink',
  tag: '路径规划',
  desc: '按住拖动，把两个同色圆点用一条线连起来。线不能交叉，而且要把整个棋盘铺满！',
  practice: [
    { key: 'e', label: '5×5', params: { size: 5 } },
    { key: 'm', label: '6×6', params: { size: 6 } },
    { key: 'h', label: '7×7', params: { size: 7 } },
    { key: 'x', label: '9×9', params: { size: 9 } },
    { key: 'xx', label: '10×10 疯狂', params: { size: 10 } },
  ],
  challenge(lv) {
    return { size: Math.min(5 + Math.floor((lv - 1) / 4), 14) };
  },
  start(host, params, api) {
    const COLORS = ['#F06292', '#4FC3F7', '#FFB74D', '#81C784', '#BA68C8', '#FF8A65',
      '#4DB6AC', '#F9CE55', '#7986CB', '#E57373', '#AED581', '#9575CD', '#4DD0E1', '#F48FB1'];
    const size = params.size;
    const CELL = 40;
    const W = size * CELL;
    const puzzle = BrainGym.gen.flow(size);
    const pairs = puzzle.pairs.map((p, i) => ({
      color: COLORS[i % COLORS.length],
      a: p.cells[0],
      b: p.cells[p.cells.length - 1],
    }));
    const endpointOf = {}; // cell -> pairIdx
    pairs.forEach((p, i) => { endpointOf[p.a] = i; endpointOf[p.b] = i; });

    const paths = pairs.map(() => []);
    let drawing = null;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${W}`);
    svg.classList.add('flow-svg');

    // 网格线
    let gd = '';
    for (let i = 0; i <= size; i++) {
      gd += `M0 ${i * CELL}H${W}M${i * CELL} 0V${W}`;
    }
    const gridPath = document.createElementNS(svgNS, 'path');
    gridPath.setAttribute('d', gd);
    gridPath.classList.add('flow-grid');
    svg.appendChild(gridPath);

    const cx = c => (c % size) * CELL + CELL / 2;
    const cy = c => Math.floor(c / size) * CELL + CELL / 2;

    // 每对一条折线
    const lines = pairs.map(p => {
      const pl = document.createElementNS(svgNS, 'polyline');
      pl.classList.add('flow-line');
      pl.setAttribute('stroke', p.color);
      svg.appendChild(pl);
      return pl;
    });
    // 圆点端点
    pairs.forEach((p, i) => {
      for (const c of [p.a, p.b]) {
        const dot = document.createElementNS(svgNS, 'circle');
        dot.setAttribute('cx', cx(c));
        dot.setAttribute('cy', cy(c));
        dot.setAttribute('r', CELL * 0.31);
        dot.setAttribute('fill', p.color);
        dot.classList.add('flow-dot');
        dot.dataset.pair = i;
        svg.appendChild(dot);
      }
    });

    host.appendChild(svg);

    function cellAt(e) {
      const rect = svg.getBoundingClientRect();
      const c = Math.min(size - 1, Math.max(0, Math.floor((e.clientX - rect.left) / rect.width * size)));
      const r = Math.min(size - 1, Math.max(0, Math.floor((e.clientY - rect.top) / rect.height * size)));
      return r * size + c;
    }
    function findInPath(cell) {
      for (let i = 0; i < paths.length; i++) {
        const k = paths[i].indexOf(cell);
        if (k !== -1) return [i, k];
      }
      return null;
    }
    function connected(i) {
      const path = paths[i];
      if (path.length < 2) return false;
      const ends = [path[0], path[path.length - 1]];
      return ends.includes(pairs[i].a) && ends.includes(pairs[i].b);
    }

    function onDown(e) {
      e.preventDefault();
      svg.setPointerCapture(e.pointerId);
      const cell = cellAt(e);
      if (endpointOf[cell] !== undefined) {
        drawing = endpointOf[cell];
        paths[drawing] = [cell];
        render();
        return;
      }
      const hit = findInPath(cell);
      if (hit) {
        drawing = hit[0];
        paths[drawing] = paths[drawing].slice(0, hit[1] + 1);
        render();
      }
    }

    function onMove(e) {
      if (drawing === null) return;
      const target = cellAt(e);
      let guard = size * 2;
      // 快速滑动会跳格：沿直线逐格补上
      while (guard-- > 0) {
        const path = paths[drawing];
        const last = path[path.length - 1];
        if (last === target) break;
        const lr = Math.floor(last / size), lc = last % size;
        const tr = Math.floor(target / size), tc = target % size;
        let next;
        if (lr === tr) next = last + (tc > lc ? 1 : -1);
        else if (lc === tc) next = last + (tr > lr ? size : -size);
        else break; // 斜着滑，忽略
        if (!step(next)) break;
      }
    }

    // 把线延伸一格，处理回退/切断/到达终点，成功返回 true
    function step(next) {
      const path = paths[drawing];
      const last = path[path.length - 1];
      // 回退一格
      if (path.length >= 2 && next === path[path.length - 2]) {
        path.pop();
        render();
        return true;
      }
      // 撞到别的颜色的圆点：过不去
      if (endpointOf[next] !== undefined && endpointOf[next] !== drawing) return false;
      // 撞到自己的线：截断回去
      const selfIdx = path.indexOf(next);
      if (selfIdx !== -1) {
        paths[drawing] = path.slice(0, selfIdx + 1);
        render();
        return true;
      }
      // 撞到别人的线：把别人从这格起剪断
      const hit = findInPath(next);
      if (hit) paths[hit[0]] = paths[hit[0]].slice(0, hit[1]);
      path.push(next);
      // 连到自己另一个端点：这条完成
      if (endpointOf[next] === drawing && path.length >= 2 &&
        ((path[0] === pairs[drawing].a && next === pairs[drawing].b) ||
          (path[0] === pairs[drawing].b && next === pairs[drawing].a))) {
        drawing = null;
        render();
        checkWin();
        return false;
      }
      render();
      return true;
    }

    function onUp() {
      drawing = null;
      checkWin();
    }

    function render() {
      pairs.forEach((p, i) => {
        lines[i].setAttribute('points', paths[i].map(c => `${cx(c)},${cy(c)}`).join(' '));
        lines[i].classList.toggle('done', connected(i));
      });
      const covered = new Set();
      paths.forEach(path => path.forEach(c => covered.add(c)));
      const done = pairs.filter((_, i) => connected(i)).length;
      api.setInfo(`连通 <b class="info-big">${done}</b> / ${pairs.length} · 覆盖 ${Math.round(covered.size / (size * size) * 100)}%`);
    }

    function checkWin() {
      const covered = new Set();
      paths.forEach(path => path.forEach(c => covered.add(c)));
      if (covered.size === size * size && pairs.every((_, i) => connected(i))) {
        api.win({ detail: `🌈 ${size}×${size} · ${pairs.length} 条彩虹全部接通` });
      }
    }

    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', onUp);
    render();
  },
});
