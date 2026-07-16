// ===== 水果碰碰：同样的水果碰在一起会合成更大的（合成大西瓜玩法）=====
BrainGym.register({
  id: 'fruit',
  name: '水果碰碰',
  icon: '🍉',
  tone: 'pink',
  tag: '合成',
  cat: 'arcade',
  desc: '点击（或拖动瞄准后松手）从上方丢水果，两个一样的水果碰到会合成更大的！合出目标水果就赢，堆到顶上的红线就输。',
  practice: [
    { key: 'e', label: '合出🍐', params: { target: 5, drops: 130 } },
    { key: 'm', label: '合出🍍', params: { target: 7, drops: 150 } },
    { key: 'h', label: '合出🍉', params: { target: 9, drops: 170 } },
    { key: 'x', label: '合出🍉（捣乱版）', params: { target: 9, drops: 130, boss: 1 } },
  ],
  // 闯关：目标水果越来越大，丢的次数从第一关就开始收紧（不再无限丢）
  // 每 10 关 BOSS：每丢 5 个就混进一颗合不了的铁栗子捣乱
  challenge(lv) {
    const target = Math.min(4 + Math.ceil(lv / 4), 9);
    const drops = Math.max(35, 180 - lv * 3);
    return { target, drops, boss: lv % 10 === 0 ? 1 : 0 };
  },
  start(host, params, api) {
    const { randInt } = BrainGym.utils;
    const FRUITS = ['🍒', '🍓', '🍇', '🍊', '🍎', '🍐', '🍑', '🍍', '🍈', '🍉'];
    const TINTS = ['#F7D2DE', '#F9C1CE', '#DCC8F0', '#FFDFB8', '#FFC9C9', '#D6EDC9', '#FFD4C4', '#FBE9AE', '#D8F0D0', '#CFEFC4'];
    const RADII = [13, 17, 22, 27, 33, 39, 46, 53, 61, 70];

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.min(390, window.innerWidth * 0.94);
    const ch = Math.min(500, window.innerHeight * 0.56);
    const canvas = document.createElement('canvas');
    canvas.className = 'arcade-canvas';
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    host.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const U = W / 390;
    const LOSE_Y = 112 * U;      // 红线（比以前更靠上，篮子空间变小，更容易堆满）
    const G = 1900 * U;
    const spawnRange = () => Math.min(6, Math.max(4, params.target - 3));

    let fruits = [];            // {x, y, vx, vy, tier, r}
    let curTier = randInt(spawnRange()), nextTier = randInt(spawnRange());
    let aimX = W / 2;
    let drops = 0, score = 0, best = 0;
    let dropCooldown = 0, overflowTime = 0;
    let over = false, raf = null, last = 0;

    function radius(t) { return RADII[t] * U; }

    function drop() {
      if (over || dropCooldown > 0) return;
      if (params.drops && drops >= params.drops) return;
      // BOSS 关：每第 5 个丢下去的是合不了的铁栗子
      const isNut = params.boss && (drops + 1) % 5 === 0;
      const r = isNut ? 26 * U : radius(curTier);
      const x = Math.max(r + 4 * U, Math.min(W - r - 4 * U, aimX));
      if (isNut) {
        fruits.push({ x, y: 30 * U, vx: 0, vy: 60 * U, tier: -1, r });
      } else {
        fruits.push({ x, y: 30 * U, vx: 0, vy: 60 * U, tier: curTier, r });
        curTier = nextTier;
        nextTier = randInt(spawnRange());
      }
      drops++;
      dropCooldown = 0.45;
      updateInfo();
    }

    function merge(a, b) {
      const t = a.tier + 1;
      const nx = (a.x + b.x) / 2, ny = (a.y + b.y) / 2;
      fruits = fruits.filter(f => f !== a && f !== b);
      if (t < FRUITS.length) {
        fruits.push({ x: nx, y: ny, vx: 0, vy: -120 * U, tier: t, r: radius(t) });
        best = Math.max(best, t);
        score += (t + 1) * 10;
        updateInfo();
        if (t >= params.target) {
          over = true;
          draw();
          api.win({ detail: `${FRUITS[t]} 合成成功 · 得分 ${score} · 丢了 ${drops} 个` });
        }
      }
    }

    function physics(dt) {
      for (const f of fruits) {
        f.vy += G * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.vx *= 0.995;
      }
      // 迭代解决碰撞（简化物理，稳定优先）
      for (let iter = 0; iter < 4; iter++) {
        for (const f of fruits) {
          if (f.x - f.r < 0) { f.x = f.r; f.vx = Math.abs(f.vx) * 0.4; }
          if (f.x + f.r > W) { f.x = W - f.r; f.vx = -Math.abs(f.vx) * 0.4; }
          if (f.y + f.r > H) { f.y = H - f.r; f.vy = -Math.abs(f.vy) * 0.18; f.vx *= 0.92; }
        }
        for (let i = 0; i < fruits.length; i++) {
          for (let j = i + 1; j < fruits.length; j++) {
            const a = fruits[i], b = fruits[j];
            const dx = b.x - a.x, dy = b.y - a.y;
            const d = Math.hypot(dx, dy), min = a.r + b.r;
            if (d < min && d > 0.001) {
              if (a.tier === b.tier && a.tier >= 0 && iter === 0) { merge(a, b); return; }
              const nx = dx / d, ny = dy / d;
              const push = (min - d) / 2;
              const ma = a.r * a.r, mb = b.r * b.r, tot = ma + mb;
              a.x -= nx * push * (mb / tot) * 1.9;
              a.y -= ny * push * (mb / tot) * 1.9;
              b.x += nx * push * (ma / tot) * 1.9;
              b.y += ny * push * (ma / tot) * 1.9;
              // 速度沿法线做一点交换衰减
              const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
              if (rv < 0) {
                const imp = -rv * 0.35;
                a.vx -= nx * imp * (mb / tot); a.vy -= ny * imp * (mb / tot);
                b.vx += nx * imp * (ma / tot); b.vy += ny * imp * (ma / tot);
              }
            }
          }
        }
      }
    }

    function update(dt) {
      dropCooldown = Math.max(0, dropCooldown - dt);
      physics(dt);
      if (over) return;
      // 爆仓判定：有水果安静地停在红线以上
      const bad = fruits.some(f => f.y - f.r < LOSE_Y && Math.abs(f.vy) < 30 * U && f.vy >= -30 * U);
      overflowTime = bad ? overflowTime + dt : 0;
      if (overflowTime > 2) {
        over = true;
        api.fail(`堆到顶啦！最大合到 ${FRUITS[best]} · 得分 ${score}`);
        return;
      }
      // 次数用尽且没合出目标
      if (params.drops && drops >= params.drops && dropCooldown <= 0) {
        const calm = fruits.every(f => Math.abs(f.vy) < 40 * U);
        if (calm) {
          over = true;
          api.fail(`次数用完了！差一点合出 ${FRUITS[params.target]}`);
        }
      }
    }

    function updateInfo() {
      let html = `${params.boss ? '👑 铁栗子捣乱 · ' : ''}目标 ${FRUITS[params.target]} · 得分 <b class="info-big">${score}</b>`;
      if (params.drops) html += ` <span class="info-limit">🫳 剩 ${Math.max(0, params.drops - drops)} 次</span>`;
      api.setInfo(html);
    }

    function draw() {
      const css = getComputedStyle(document.documentElement);
      ctx.fillStyle = css.getPropertyValue('--white').trim() || '#fff';
      ctx.fillRect(0, 0, W, H);
      // 果篮渐变（顶部粉粉的）
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, 'rgba(249, 168, 196, 0.16)');
      bg.addColorStop(0.4, 'rgba(255, 217, 142, 0.07)');
      bg.addColorStop(1, 'rgba(125, 219, 192, 0.12)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      // 红线
      ctx.strokeStyle = overflowTime > 0 ? '#E8506E' : 'rgba(232, 80, 110, 0.35)';
      ctx.lineWidth = 2.5 * U;
      ctx.setLineDash([10 * U, 8 * U]);
      ctx.beginPath();
      ctx.moveTo(0, LOSE_Y);
      ctx.lineTo(W, LOSE_Y);
      ctx.stroke();
      ctx.setLineDash([]);
      // 水果
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const f of fruits) {
        ctx.fillStyle = f.tier < 0 ? '#E3D9CB' : TINTS[f.tier];
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, 7);
        ctx.fill();
        ctx.font = `${f.r * 1.35}px sans-serif`;
        ctx.fillText(f.tier < 0 ? '🌰' : FRUITS[f.tier], f.x, f.y + f.r * 0.06);
      }
      // 瞄准中的水果 + 下一个预告
      if (!over && (!params.drops || drops < params.drops)) {
        const isNut = params.boss && (drops + 1) % 5 === 0;
        const r = isNut ? 26 * U : radius(curTier);
        const x = Math.max(r + 4 * U, Math.min(W - r - 4 * U, aimX));
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = isNut ? '#E3D9CB' : TINTS[curTier];
        ctx.beginPath(); ctx.arc(x, 30 * U, r, 0, 7); ctx.fill();
        ctx.font = `${r * 1.35}px sans-serif`;
        ctx.fillText(isNut ? '🌰' : FRUITS[curTier], x, 30 * U + r * 0.06);
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = '#9A8794';
        ctx.setLineDash([4 * U, 8 * U]);
        ctx.beginPath(); ctx.moveTo(x, 30 * U + r); ctx.lineTo(x, H); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ctx.font = `${16 * U}px sans-serif`;
        ctx.fillStyle = '#9A8794';
        ctx.fillText(`下一个 ${FRUITS[nextTier]}`, W - 56 * U, 20 * U);
      }
    }

    function loop(t) {
      if (!last) last = t;
      const dt = Math.min(0.03, (t - last) / 1000);
      last = t;
      update(dt);
      draw();
      if (!over) raf = requestAnimationFrame(loop);
    }

    // 操作：移动瞄准，松手/点击丢下
    let aiming = false;
    canvas.addEventListener('pointerdown', e => { aiming = true; aim(e); });
    canvas.addEventListener('pointermove', e => { if (aiming) aim(e); });
    canvas.addEventListener('pointerup', e => { aiming = false; aim(e); drop(); });
    function aim(e) {
      const rect = canvas.getBoundingClientRect();
      aimX = (e.clientX - rect.left) / rect.width * W;
    }

    updateInfo();
    raf = requestAnimationFrame(loop);
    return () => {
      over = true;
      if (raf) cancelAnimationFrame(raf);
    };
  },
});
