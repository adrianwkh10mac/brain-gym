// ===== 极速飞车：变道躲车冲终点；每 10 关是魔王卡车 BOSS 关 =====
BrainGym.register({
  id: 'racer',
  name: '极速飞车',
  icon: '🏎️',
  tone: 'peach',
  tag: '反应',
  cat: 'arcade',
  desc: '点屏幕左/右半边（或方向键）变道，躲开前方车辆，坚持开到终点！每 10 关会遇到横着晃的魔王大卡车。',
  practice: [
    { key: 'e', label: '兜风', params: { dist: 400, speed: 260, ramp: 6, boss: 0 } },
    { key: 'm', label: '赶路', params: { dist: 600, speed: 320, ramp: 8, boss: 0 } },
    { key: 'h', label: '飙车', params: { dist: 800, speed: 380, ramp: 10, boss: 0 } },
    { key: 'x', label: '魔王卡车', params: { dist: 700, speed: 340, ramp: 9, boss: 1 } },
  ],
  // 闯关：距离和速度增加（封顶保证反应得过来）；每 10 关 BOSS
  challenge(lv) {
    const boss = lv % 10 === 0 ? 1 : 0;
    return {
      dist: Math.min(300 + lv * 45, 2550),
      speed: Math.min(240 + lv * 7.4, 610),
      ramp: Math.min(6 + Math.round(lv * 0.4), 26),
      boss,
    };
  },
  start(host, params, api) {
    const { randInt } = BrainGym.utils;
    const LANES = 4;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.min(390, window.innerWidth * 0.94);
    const ch = Math.min(500, window.innerHeight * 0.55);
    const canvas = document.createElement('canvas');
    canvas.className = 'arcade-canvas';
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    host.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const M = 18 * dpr;                 // 路边草地宽
    const laneW = (W - 2 * M) / LANES;
    const CAR_W = laneW * 0.62, CAR_H = CAR_W * 1.7;

    const COLORS = ['#8EC9F5', '#C3B3F5', '#FFD98E', '#7DDBC0', '#F783AC'];
    const FLOWERS = ['#F783AC', '#FFD98E', '#C3B3F5', '#FF9E80'];
    let lane = 1, laneX = laneAt(1);
    let speed = params.speed * dpr;
    let dist = 0, lineOffset = 0;
    let cars = [];          // {x, y, w, h, color, truck, sway}
    let spawnAt = 0, truckAt = params.boss ? 40 : Infinity;
    let over = false, raf = null, last = 0;

    function laneAt(l) { return M + (l + 0.5) * laneW; }
    function steer(d) { lane = Math.max(0, Math.min(LANES - 1, lane + d)); }

    function spawn() {
      // BOSS 关普通车最多封 1 条道（卡车已经占 2 条），普通关最多 2 条
      const maxBlock = params.boss ? 1 : 2;
      const block = 1 + (Math.random() < 0.45 && maxBlock > 1 ? 1 : 0);
      const lanes = [];
      while (lanes.length < block) {
        const l = randInt(LANES);
        if (!lanes.includes(l)) lanes.push(l);
      }
      lanes.forEach(l => cars.push({
        x: laneAt(l), y: -CAR_H - randInt(60) * dpr,
        w: CAR_W, h: CAR_H,
        color: COLORS[randInt(COLORS.length)], truck: false, sway: 0,
      }));
    }
    function spawnTruck() {
      const l = randInt(LANES - 1);
      cars.push({
        x: laneAt(l) + laneW / 2, y: -CAR_H * 2.2,
        w: laneW * 1.62, h: CAR_H * 1.9,
        color: '#8A5CC7', truck: true, sway: Math.random() * 6,
      });
    }

    function update(dt) {
      speed += params.ramp * dpr * dt;
      const dy = speed * dt;
      dist += dy / (40 * dpr);
      lineOffset = (lineOffset + dy) % (90 * dpr);
      cars.forEach(c => {
        c.y += dy * (c.truck ? 0.42 : 0.55);
        if (c.truck) {
          c.sway += dt;
          c.x += Math.sin(c.sway * 1.6) * laneW * 0.9 * dt; // 魔王卡车左右晃
          c.x = Math.max(M + c.w / 2, Math.min(W - M - c.w / 2, c.x));
        }
      });
      cars = cars.filter(c => c.y < H + c.h);
      if (dist >= spawnAt) {
        spawn();
        spawnAt = dist + 26 + speed / (34 * dpr) + (params.boss ? 10 : 0);
      }
      if (dist >= truckAt) {
        spawnTruck();
        truckAt = dist + 60;
      }
      laneX += (laneAt(lane) - laneX) * Math.min(1, dt * 14);
      const px = laneX, py = H - CAR_H * 0.95;
      for (const c of cars) {
        if (Math.abs(c.x - px) < (c.w + CAR_W) * 0.41 && Math.abs(c.y - py) < (c.h + CAR_H) * 0.41) {
          over = true;
          api.fail(`${c.truck ? '被魔王卡车撞了' : '撞车了'}！开了 ${Math.floor(dist)} / ${params.dist} 米`);
          return;
        }
      }
      api.setInfo(`${params.boss ? '👑 BOSS 关 · ' : ''}🏁 <b class="info-big">${Math.floor(dist)}</b> / ${params.dist} 米`);
      if (dist >= params.dist) {
        over = true;
        api.win({ detail: `🏎️ 冲线时速 ${Math.round(speed / dpr / 4)} 码${params.boss ? ' · 甩掉了魔王卡车 👑' : ''}` });
      }
    }

    function drawCar(c, isPlayer) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, c.w * 0.22);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.roundRect(-c.w * 0.3, -c.h * 0.3, c.w * 0.6, c.h * 0.2, c.w * 0.08);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(-c.w * 0.3, c.h * 0.14, c.w * 0.6, c.h * 0.16, c.w * 0.08);
      ctx.fill();
      if (c.truck) {
        ctx.font = `${c.w * 0.32}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👑', 0, -c.h * 0.02);
      }
      ctx.restore();
    }

    function draw() {
      // 草地 + 小花
      ctx.fillStyle = '#9BDDB8';
      ctx.fillRect(0, 0, M, H);
      ctx.fillRect(W - M, 0, M, H);
      for (let i = 0; i < 8; i++) {
        const fy = ((i * 140 * dpr + lineOffset * 1.2) % (H + 60 * dpr)) - 30 * dpr;
        ctx.fillStyle = FLOWERS[i % FLOWERS.length];
        ctx.beginPath();
        ctx.arc(M / 2, fy, 4 * dpr, 0, 7);
        ctx.arc(W - M / 2, H - fy, 4 * dpr, 0, 7);
        ctx.fill();
      }
      // 路面
      ctx.fillStyle = '#6B6470';
      ctx.fillRect(M, 0, W - 2 * M, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 3 * dpr;
      ctx.setLineDash([34 * dpr, 56 * dpr]);
      for (let l = 1; l < LANES; l++) {
        ctx.beginPath();
        ctx.moveTo(M + l * laneW, lineOffset - 90 * dpr);
        ctx.lineTo(M + l * laneW, H);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      // 终点线
      const remain = params.dist - dist;
      if (remain < 60) {
        const y = H * (1 - remain / 60);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        for (let i = 0; i < LANES * 2; i++) {
          ctx.fillRect(M + i * laneW / 2, y - 14 * dpr + (i % 2) * 7 * dpr, laneW / 2, 7 * dpr);
        }
      }
      cars.forEach(c => drawCar(c, false));
      drawCar({ x: laneX, y: H - CAR_H * 0.95, w: CAR_W, h: CAR_H, color: '#FF6B81' }, true);
    }

    function loop(t) {
      if (over) return;
      if (!last) last = t;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      update(dt);
      if (!over) { draw(); raf = requestAnimationFrame(loop); }
    }

    const onPointer = e => {
      const rect = canvas.getBoundingClientRect();
      steer((e.clientX - rect.left) < rect.width / 2 ? -1 : 1);
    };
    canvas.addEventListener('pointerdown', onPointer);
    const onKey = e => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); steer(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); steer(1); }
    };
    document.addEventListener('keydown', onKey);

    api.setInfo(`🏁 <b class="info-big">0</b> / ${params.dist} 米 · 点左右变道`);
    raf = requestAnimationFrame(loop);
    return () => {
      over = true;
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
    };
  },
});
