// ===== 太空战机：自动开火，拖动躲子弹，清完敌机过关；每 5 关有 BOSS =====
BrainGym.register({
  id: 'shooter',
  name: '太空战机',
  icon: '🚀',
  tone: 'lavender',
  tag: '闯关射击',
  cat: 'arcade',
  desc: '手指按住拖动战机（自动开火），躲开敌方子弹，消灭全部敌机就过关。每 5 关有一个大 BOSS！',
  practice: [
    { key: 'e', label: '新手', params: { waves: 1, perWave: 6, ehp: 1, fireRate: 2200, boss: 0 } },
    { key: 'm', label: '进阶', params: { waves: 2, perWave: 8, ehp: 1, fireRate: 1700, boss: 0 } },
    { key: 'h', label: '高手', params: { waves: 3, perWave: 10, ehp: 2, fireRate: 1300, boss: 0 } },
    { key: 'x', label: 'BOSS 战', params: { waves: 0, perWave: 0, ehp: 2, fireRate: 1100, boss: 30 } },
  ],
  // 闯关：敌机更多更硬、弹幕更密；每 5 关 BOSS（弹幕密度有保底上限）
  challenge(lv) {
    const isBoss = lv % 5 === 0;
    return {
      waves: isBoss ? 0 : Math.min(2 + Math.floor(lv / 4), 5),
      perWave: Math.min(6 + Math.floor(lv / 2), 14),
      ehp: lv < 8 ? 1 : 2,
      fireRate: Math.max(750, 2100 - lv * 60),
      boss: isBoss ? Math.min(24 + lv * 3, 180) : 0,
    };
  },
  start(host, params, api) {
    const { randInt } = BrainGym.utils;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.min(390, window.innerWidth * 0.94);
    const ch = Math.min(520, window.innerHeight * 0.58);
    const canvas = document.createElement('canvas');
    canvas.className = 'arcade-canvas';
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    host.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const U = W / 390; // 尺寸基准

    const totalWaves = params.waves;
    let wave = 0, enemies = [], ebullets = [], bullets = [], stars = [];
    let px = W / 2, py = H - 70 * U;
    let hearts = 3, inv = 0, fireAcc = 0, enemyFireAcc = 0;
    let boss = null;
    let over = false, raf = null, last = 0, killed = 0, needKill = 0;

    for (let i = 0; i < 40; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.5 + 0.5 });

    function spawnWave() {
      wave++;
      const n = params.perWave;
      for (let i = 0; i < n; i++) {
        const col = i % 5, row = Math.floor(i / 5);
        enemies.push({
          x: (col + 1) * (W / 6),
          y: -(40 + row * 52) * U,
          hp: params.ehp,
          sway: Math.random() * 6.3,
          drop: (26 + Math.random() * 10) * U, // 下压速度
        });
      }
    }
    function spawnBoss() {
      boss = { x: W / 2, y: -80 * U, hp: params.boss, maxHp: params.boss, sway: 0, phase: 0 };
    }
    if (params.boss) { needKill = 1; spawnBoss(); }
    else { needKill = totalWaves * params.perWave; spawnWave(); }

    function updateInfo() {
      const goal = params.boss ? `BOSS 血量 ${boss ? boss.hp : 0}` : `击落 ${killed}/${needKill}`;
      api.setInfo(`${'❤️'.repeat(hearts)}${'🤍'.repeat(3 - hearts)} · ${goal}`);
    }

    function hurt() {
      if (inv > 0) return;
      hearts--;
      inv = 1.6;
      updateInfo();
      if (hearts <= 0) {
        over = true;
        api.fail(params.boss ? 'BOSS 太强了，再来一次！' : `战机被击落！击落了 ${killed} 架敌机`);
      }
    }

    function update(dt) {
      inv = Math.max(0, inv - dt);
      stars.forEach(s => { s.y += 60 * U * dt * s.s; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } });
      // 自动开火
      fireAcc += dt * 1000;
      if (fireAcc >= 270) {
        fireAcc = 0;
        bullets.push({ x: px, y: py - 22 * U });
      }
      bullets.forEach(b => b.y -= 620 * U * dt);
      bullets = bullets.filter(b => b.y > -20);
      // 敌机
      enemies.forEach(e => {
        e.sway += dt * 2;
        e.x += Math.sin(e.sway) * 40 * U * dt;
        e.y += e.drop * dt;
        if (e.y > H + 30 * U) { e.y = -30 * U; } // 飘出底部就绕回，不会刷不完
      });
      // BOSS 半血狂暴：弹幕更密更宽
      if (boss && !boss.rage && boss.hp <= boss.maxHp / 2) {
        boss.rage = true;
      }
      // 敌方开火
      enemyFireAcc += dt * 1000;
      const fireRate = params.fireRate * (boss && boss.rage ? 0.55 : 1);
      if (enemyFireAcc >= fireRate && (enemies.length || boss)) {
        enemyFireAcc = 0;
        if (boss) {
          const spread = boss.rage ? 2 : 1;
          for (let a = -spread; a <= spread; a++) {
            ebullets.push({ x: boss.x + a * 20 * U, y: boss.y + 30 * U, vx: a * 75 * U, vy: (200 + Math.random() * 60) * U });
          }
        } else {
          const e = enemies[randInt(enemies.length)];
          const dx = px - e.x, dy = py - e.y, d = Math.hypot(dx, dy) || 1;
          const sp = 230 * U;
          ebullets.push({ x: e.x, y: e.y, vx: dx / d * sp * 0.4, vy: Math.max(dy / d * sp, sp * 0.6) });
        }
      }
      ebullets.forEach(b => { b.x += b.vx * dt; b.y += b.vy * dt; });
      ebullets = ebullets.filter(b => b.y < H + 20 && b.x > -20 && b.x < W + 20);
      // BOSS 移动
      if (boss) {
        boss.sway += dt;
        boss.y = Math.min(boss.y + 50 * U * dt, 90 * U);
        boss.x = W / 2 + Math.sin(boss.sway * 1.3) * W * 0.3;
      }
      // 子弹命中
      for (const b of bullets) {
        for (const e of enemies) {
          if (Math.abs(b.x - e.x) < 20 * U && Math.abs(b.y - e.y) < 20 * U) {
            e.hp--; b.y = -99;
            if (e.hp <= 0) { e.dead = true; killed++; }
          }
        }
        if (boss && Math.abs(b.x - boss.x) < 42 * U && Math.abs(b.y - boss.y) < 34 * U) {
          boss.hp--; b.y = -99;
          if (boss.hp <= 0) { boss = null; killed++; }
        }
      }
      enemies = enemies.filter(e => !e.dead);
      bullets = bullets.filter(b => b.y > -50);
      // 敌弹/敌机撞玩家
      for (const b of ebullets) {
        if (Math.abs(b.x - px) < 16 * U && Math.abs(b.y - py) < 18 * U) { b.y = H + 99; hurt(); if (over) return; }
      }
      for (const e of enemies) {
        if (Math.abs(e.x - px) < 26 * U && Math.abs(e.y - py) < 26 * U) { hurt(); if (over) return; }
      }
      updateInfo();
      // 波次推进 / 胜利
      if (!params.boss && enemies.length === 0) {
        if (wave < totalWaves) spawnWave();
        else { over = true; api.win({ detail: `🚀 击落 ${killed} 架敌机 · 剩余 ${hearts} ❤️` }); return; }
      }
      if (params.boss && !boss) {
        over = true;
        api.win({ detail: `👾 BOSS 击破 · 剩余 ${hearts} ❤️` });
      }
    }

    function draw() {
      ctx.fillStyle = '#2A2440';
      ctx.fillRect(0, 0, W, H);
      // 彩色星云
      ctx.fillStyle = 'rgba(195, 179, 245, 0.09)';
      ctx.beginPath(); ctx.arc(W * 0.25, H * 0.3, 90 * U, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(249, 168, 196, 0.08)';
      ctx.beginPath(); ctx.arc(W * 0.78, H * 0.6, 110 * U, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(125, 219, 192, 0.07)';
      ctx.beginPath(); ctx.arc(W * 0.55, H * 0.15, 70 * U, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      stars.forEach(s => ctx.fillRect(s.x, s.y, 2 * s.s, 2 * s.s));
      // 我方子弹
      ctx.fillStyle = '#FFE9A8';
      bullets.forEach(b => { ctx.beginPath(); ctx.roundRect(b.x - 3 * U, b.y - 10 * U, 6 * U, 16 * U, 3 * U); ctx.fill(); });
      // 敌弹
      ctx.fillStyle = '#FF8FA3';
      ebullets.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, 6 * U, 0, 7); ctx.fill(); });
      // 敌机（小飞碟）
      enemies.forEach(e => {
        ctx.fillStyle = e.hp >= 2 ? '#BA68C8' : '#8EC9F5';
        ctx.beginPath(); ctx.ellipse(e.x, e.y, 20 * U, 12 * U, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#E4F2FF';
        ctx.beginPath(); ctx.arc(e.x, e.y - 8 * U, 9 * U, 3.14, 0); ctx.fill();
        ctx.fillStyle = '#5B4A56';
        ctx.beginPath(); ctx.arc(e.x - 4 * U, e.y - 8 * U, 1.8 * U, 0, 7); ctx.arc(e.x + 4 * U, e.y - 8 * U, 1.8 * U, 0, 7); ctx.fill();
      });
      // BOSS（大布丁飞碟，狂暴时变红）
      if (boss) {
        ctx.fillStyle = boss.rage ? '#FF9E80' : '#FFD98E';
        ctx.beginPath(); ctx.ellipse(boss.x, boss.y, 46 * U, 30 * U, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#C68A4B';
        ctx.beginPath(); ctx.ellipse(boss.x, boss.y - 14 * U, 26 * U, 14 * U, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#5B4A56';
        ctx.beginPath(); ctx.arc(boss.x - 12 * U, boss.y, 4 * U, 0, 7); ctx.arc(boss.x + 12 * U, boss.y, 4 * U, 0, 7); ctx.fill();
        // 血条
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(W * 0.15, 12 * U, W * 0.7, 8 * U);
        ctx.fillStyle = '#FF8FA3';
        ctx.fillRect(W * 0.15, 12 * U, W * 0.7 * boss.hp / boss.maxHp, 8 * U);
      }
      // 玩家战机（薄荷小火箭）
      if (inv <= 0 || Math.floor(inv * 10) % 2 === 0) {
        ctx.fillStyle = '#7DDBC0';
        ctx.beginPath();
        ctx.moveTo(px, py - 22 * U);
        ctx.quadraticCurveTo(px + 18 * U, py + 2 * U, px + 14 * U, py + 18 * U);
        ctx.lineTo(px - 14 * U, py + 18 * U);
        ctx.quadraticCurveTo(px - 18 * U, py + 2 * U, px, py - 22 * U);
        ctx.fill();
        ctx.fillStyle = '#E4FFF6';
        ctx.beginPath(); ctx.arc(px, py - 2 * U, 7 * U, 0, 7); ctx.fill();
        ctx.fillStyle = '#FFB35C';
        ctx.beginPath();
        ctx.moveTo(px - 7 * U, py + 18 * U);
        ctx.lineTo(px, py + (26 + Math.random() * 6) * U);
        ctx.lineTo(px + 7 * U, py + 18 * U);
        ctx.fill();
      }
    }

    function loop(t) {
      if (over) return;
      if (!last) last = t;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      update(dt);
      if (!over) { draw(); raf = requestAnimationFrame(loop); }
    }

    // 拖动控制 + 键盘
    let dragging = false;
    canvas.addEventListener('pointerdown', e => { dragging = true; movePtr(e); });
    canvas.addEventListener('pointermove', e => { if (dragging) movePtr(e); });
    canvas.addEventListener('pointerup', () => { dragging = false; });
    function movePtr(e) {
      const rect = canvas.getBoundingClientRect();
      px = Math.max(20 * U, Math.min(W - 20 * U, (e.clientX - rect.left) / rect.width * W));
      py = Math.max(H * 0.4, Math.min(H - 24 * U, (e.clientY - rect.top) / rect.height * H - 40 * U));
    }
    let keys = {};
    const onKey = e => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        keys[e.key] = e.type === 'keydown';
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKey);
    const keyMove = setInterval(() => {
      if (keys.ArrowLeft) px = Math.max(20 * U, px - 9 * U);
      if (keys.ArrowRight) px = Math.min(W - 20 * U, px + 9 * U);
      if (keys.ArrowUp) py = Math.max(H * 0.4, py - 9 * U);
      if (keys.ArrowDown) py = Math.min(H - 24 * U, py + 9 * U);
    }, 16);

    updateInfo();
    raf = requestAnimationFrame(loop);
    return () => {
      over = true;
      if (raf) cancelAnimationFrame(raf);
      clearInterval(keyMove);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('keyup', onKey);
    };
  },
});
