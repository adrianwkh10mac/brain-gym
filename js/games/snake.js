// ===== 贪吃蛇：吃到目标数量的水果就通关 =====
BrainGym.register({
  id: 'snake',
  name: '贪吃蛇',
  icon: '🐍',
  tone: 'mint',
  tag: '反应',
  cat: 'arcade',
  desc: '滑动屏幕（或方向键）控制小蛇吃水果，吃够目标数量就通关。别撞墙、别咬到自己！',
  practice: [
    { key: 'e', label: '慢速', params: { speed: 220, target: 15 } },
    { key: 'm', label: '中速', params: { speed: 170, target: 20 } },
    { key: 'h', label: '快速', params: { speed: 130, target: 25 } },
    { key: 'x', label: '极速', params: { speed: 95, target: 30 } },
  ],
  // 闯关：越来越快、目标越来越多（速度保底 80ms/步）
  // 每 10 关是 BOSS 关：满场岩石阵 + 会逃跑的星星
  challenge(lv) {
    const boss = lv % 10 === 0 ? 1 : 0;
    return {
      speed: Math.max(70, 230 - lv * 3.2) + (boss ? 25 : 0),
      target: boss ? Math.min(8 + Math.floor(lv / 10) * 2, 20) : Math.min(8 + Math.round(lv * 1.5), 80),
      rocks: boss ? Math.min(5 + Math.floor(lv / 8) * 2, 17) : 0,
      boss,
    };
  },
  start(host, params, api) {
    const { randInt } = BrainGym.utils;
    const N = 17;
    const FOODS = ['🍎', '🍓', '🍇', '🍊', '🍑', '🥕'];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssSize = Math.min(390, window.innerWidth * 0.94);
    const canvas = document.createElement('canvas');
    canvas.className = 'arcade-canvas';
    canvas.width = canvas.height = Math.round(cssSize * dpr);
    canvas.style.height = canvas.style.width = cssSize + 'px';
    host.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const CELL = canvas.width / N;

    // 方向按钮（复用迷宫的样式）
    const pad = document.createElement('div');
    pad.className = 'maze-pad';
    pad.innerHTML = `
      <button class="pad-btn" data-d="0,-1">▲</button>
      <div class="pad-mid">
        <button class="pad-btn" data-d="-1,0">◀</button>
        <button class="pad-btn" data-d="1,0">▶</button>
      </div>
      <button class="pad-btn" data-d="0,1">▼</button>`;
    pad.querySelectorAll('.pad-btn').forEach(b => {
      b.onclick = () => { const [x, y] = b.dataset.d.split(',').map(Number); turn(x, y); };
    });
    host.appendChild(pad);

    let snake = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }];
    let dir = { x: 1, y: 0 };
    let pending = [];         // 输入队列，避免一步内连转两次咬到自己
    let food = null, foodEmoji = FOODS[0];
    let eaten = 0, acc = 0, last = 0, over = false;
    let raf = null, moveCtr = 0;
    const prefix = params.boss ? '👑 BOSS 关 · ' : '';

    // BOSS 关的岩石阵（避开出生走廊）
    const rocks = [];
    while (rocks.length < (params.rocks || 0)) {
      const p = { x: randInt(N), y: randInt(N) };
      if (Math.abs(p.y - 8) <= 1 && p.x >= 2 && p.x <= 12) continue;
      if (rocks.some(r => r.x === p.x && r.y === p.y)) continue;
      rocks.push(p);
    }
    const blocked = p =>
      snake.some(s => s.x === p.x && s.y === p.y) ||
      rocks.some(r => r.x === p.x && r.y === p.y);

    function placeFood() {
      let p;
      do { p = { x: randInt(N), y: randInt(N) }; }
      while (blocked(p));
      food = p;
      foodEmoji = params.boss ? '⭐' : FOODS[randInt(FOODS.length)];
    }
    placeFood();

    function turn(x, y) {
      const lastDir = pending.length ? pending[pending.length - 1] : dir;
      if (x === -lastDir.x && y === -lastDir.y) return; // 不能原地掉头
      if (x === lastDir.x && y === lastDir.y) return;
      if (pending.length < 3) pending.push({ x, y });
    }

    function stepGame() {
      if (pending.length) dir = pending.shift();
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      if (head.x < 0 || head.x >= N || head.y < 0 || head.y >= N ||
        snake.some(s => s.x === head.x && s.y === head.y) ||
        rocks.some(r => r.x === head.x && r.y === head.y)) {
        over = true;
        api.fail(`撞到了！吃到 ${eaten} / ${params.target} 个${params.boss ? '星星' : '水果'}`);
        return;
      }
      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        eaten++;
        api.setInfo(`${prefix}${params.boss ? '⭐' : '🍎'} <b class="info-big">${eaten}</b> / ${params.target}`);
        if (eaten >= params.target) {
          over = true;
          draw();
          api.win({ detail: params.boss ? `👑 星星狂欢通关 · 蛇长 ${snake.length} 格` : `🐍 蛇长 ${snake.length} 格` });
          return;
        }
        placeFood();
        moveCtr = 0;
      } else {
        snake.pop();
        // BOSS 关：星星每 7 步逃到新位置
        if (params.boss && ++moveCtr >= 7) {
          moveCtr = 0;
          placeFood();
        }
      }
    }

    function draw() {
      const css = getComputedStyle(document.documentElement);
      const white = css.getPropertyValue('--white').trim() || '#fff';
      const soft = css.getPropertyValue('--soft').trim() || '#FBF3E8';
      ctx.fillStyle = white;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = soft;
      for (let y = 0; y < N; y++)
        for (let x = (y % 2); x < N; x += 2)
          ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      // 岩石 + 水果
      ctx.font = `${CELL * 0.85}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      rocks.forEach(r => ctx.fillText('🪨', (r.x + 0.5) * CELL, (r.y + 0.55) * CELL));
      ctx.fillText(foodEmoji, (food.x + 0.5) * CELL, (food.y + 0.55) * CELL);
      // 蛇身（渐变薄荷绿圆角）
      snake.forEach((s, i) => {
        const t = i / snake.length;
        ctx.fillStyle = i === 0 ? '#4CC4A3' : `rgba(125, 219, 192, ${1 - t * 0.55})`;
        const pad2 = CELL * 0.08;
        const r = CELL * 0.3;
        const x = s.x * CELL + pad2, y = s.y * CELL + pad2, w = CELL - pad2 * 2;
        ctx.beginPath();
        ctx.roundRect(x, y, w, w, r);
        ctx.fill();
      });
      // 蛇头眼睛
      const h = snake[0];
      ctx.fillStyle = '#FFF';
      const ex = (h.x + 0.5) * CELL, ey = (h.y + 0.5) * CELL, off = CELL * 0.18;
      const px = dir.y !== 0 ? off : 0, py = dir.x !== 0 ? off : 0;
      ctx.beginPath();
      ctx.arc(ex - px + dir.x * off, ey - py + dir.y * off, CELL * 0.11, 0, 7);
      ctx.arc(ex + px + dir.x * off, ey + py + dir.y * off, CELL * 0.11, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#5B4A56';
      ctx.beginPath();
      ctx.arc(ex - px + dir.x * off * 1.3, ey - py + dir.y * off * 1.3, CELL * 0.055, 0, 7);
      ctx.arc(ex + px + dir.x * off * 1.3, ey + py + dir.y * off * 1.3, CELL * 0.055, 0, 7);
      ctx.fill();
    }

    function loop(t) {
      if (over) return;
      if (!last) last = t;
      acc += t - last;
      last = t;
      while (acc >= params.speed && !over) {
        acc -= params.speed;
        stepGame();
      }
      draw();
      raf = requestAnimationFrame(loop);
    }

    // 拖动跟随：手指按住画面拖动，蛇头持续转向手指所在方向（类似摇杆）
    let touchAnchor = null;
    const DEAD_ZONE = 14; // 手指移动小于这个距离时不转向，避免手抖误触发
    const followDir = (cx, cy) => {
      if (!touchAnchor) return;
      const dx = cx - touchAnchor[0];
      const dy = cy - touchAnchor[1];
      if (Math.abs(dx) < DEAD_ZONE && Math.abs(dy) < DEAD_ZONE) return;
      if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 1 : -1, 0);
      else turn(0, dy > 0 ? 1 : -1);
      touchAnchor = [cx, cy];
    };
    const onTS = e => { touchAnchor = [e.touches[0].clientX, e.touches[0].clientY]; };
    const onTM = e => { e.preventDefault(); followDir(e.touches[0].clientX, e.touches[0].clientY); };
    const onTE = () => { touchAnchor = null; };
    canvas.addEventListener('touchstart', onTS, { passive: true });
    canvas.addEventListener('touchmove', onTM, { passive: false });
    canvas.addEventListener('touchend', onTE, { passive: true });
    canvas.addEventListener('touchcancel', onTE, { passive: true });
    const onKey = e => {
      const m = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
      if (m[e.key]) { e.preventDefault(); turn(m[e.key][0], m[e.key][1]); }
    };
    document.addEventListener('keydown', onKey);

    api.setInfo(`${prefix}${params.boss ? '⭐' : '🍎'} <b class="info-big">0</b> / ${params.target}`);
    raf = requestAnimationFrame(loop);
    return () => {
      over = true;
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
    };
  },
});
