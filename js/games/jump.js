// ===== 糯糯跳跳：横版平台跳跃，踩扁史莱姆、收集星星、冲到旗子 =====
BrainGym.register({
  id: 'jump',
  name: '糯糯跳跳',
  icon: '🍀',
  tone: 'mint',
  tag: '平台跳跃',
  cat: 'arcade',
  desc: '◀ ▶ 移动、🆙 跳跃。跳过悬崖、踩扁史莱姆（从上面踩！）、收集星星，摸到旗子就通关！',
  practice: [
    { key: 'e', label: '短途', params: { len: 800, density: 0.25, gapMax: 70 } },
    { key: 'm', label: '中途', params: { len: 1400, density: 0.4, gapMax: 85 } },
    { key: 'h', label: '长途', params: { len: 2200, density: 0.55, gapMax: 100 } },
    { key: 'x', label: '极限', params: { len: 3000, density: 0.7, gapMax: 115 } },
  ],
  // 闯关：地图变长、怪变多、沟变宽（沟宽保底可跳过：最大跳距约 145px）
  // 每 10 关旗子前有史莱姆王：踩 3 下才会倒，不打倒不给通关
  challenge(lv) {
    return {
      len: Math.min(900 + lv * 90, 5400),
      density: Math.min(0.2 + lv * 0.013, 0.85),
      gapMax: Math.min(60 + lv * 1.3, 125),
      boss: lv % 10 === 0 ? 1 : 0,
    };
  },
  start(host, params, api) {
    const { randInt } = BrainGym.utils;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.min(390, window.innerWidth * 0.94);
    const ch = Math.min(430, window.innerHeight * 0.5);
    const canvas = document.createElement('canvas');
    canvas.className = 'arcade-canvas';
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    host.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const U = dpr;

    // ---- 生成关卡 ----
    const plats = [];   // {x, y, w}
    const slimes = [];  // {x, y, min, max, dir, dead}
    const starsArr = []; // {x, y, got}
    let x = 0;
    const baseY = H * 0.75;
    plats.push({ x: 0, y: baseY, w: 280 * U });
    x = 280 * U;
    while (x < params.len * U) {
      const gap = (30 + Math.random() * (params.gapMax - 30)) * U;
      const w = (90 + Math.random() * 140) * U;
      const prev = plats[plats.length - 1];
      let y = prev.y + (Math.random() * 140 - 70) * U;
      y = Math.max(H * 0.35, Math.min(H * 0.85, y));
      // 往上跳的平台不能太高（最多跳 90px 高差）
      if (prev.y - y > 80 * U) y = prev.y - 80 * U;
      x += gap;
      plats.push({ x, y, w });
      if (w >= 110 * U && Math.random() < params.density) {
        slimes.push({ x: x + w / 2, y, min: x + 14 * U, max: x + w - 14 * U, dir: 1, dead: false });
      }
      if (Math.random() < 0.6) {
        starsArr.push({ x: x + w / 2, y: y - 56 * U, got: false });
      }
      x += w;
    }
    const lastPlat = plats[plats.length - 1];
    // BOSS 关：终点平台加宽，给王留出擂台
    if (params.boss) lastPlat.w = Math.max(lastPlat.w, 260 * U);
    const flagX = lastPlat.x + lastPlat.w - 30 * U;
    const bossK = params.boss
      ? { x: flagX - 130 * U, hp: 3, dir: -1, inv: 0, dead: false }
      : null;

    // ---- 玩家 ----
    const P = { x: 40 * U, y: baseY - 40 * U, vx: 0, vy: 0, w: 24 * U, h: 28 * U, ground: false, coyote: 0 };
    let hearts = 3, inv = 0, stars = 0, checkpoint = plats[0];
    let over = false, raf = null, last = 0;
    const input = { left: false, right: false, jump: false, jumpHeld: false };

    // ---- 控制按钮 ----
    const controls = document.createElement('div');
    controls.className = 'jump-controls';
    controls.innerHTML = `
      <div class="jump-left">
        <button class="jump-btn" id="jb-l">◀</button>
        <button class="jump-btn" id="jb-r">▶</button>
      </div>
      <button class="jump-btn jump-up" id="jb-u">⬆︎</button>`;
    host.appendChild(controls);
    function bindHold(id, key) {
      const b = controls.querySelector('#' + id);
      const on = e => { e.preventDefault(); input[key] = true; if (key === 'jump') input.jumpHeld = true; };
      const off = e => { e.preventDefault(); input[key] = false; if (key === 'jump') input.jumpHeld = false; };
      b.addEventListener('touchstart', on, { passive: false });
      b.addEventListener('touchend', off, { passive: false });
      b.addEventListener('touchcancel', off, { passive: false });
      b.addEventListener('mousedown', on);
      b.addEventListener('mouseup', off);
      b.addEventListener('mouseleave', off);
    }
    bindHold('jb-l', 'left');
    bindHold('jb-r', 'right');
    bindHold('jb-u', 'jump');

    const onKey = e => {
      const down = e.type === 'keydown';
      if (e.key === 'ArrowLeft') { e.preventDefault(); input.left = down; }
      if (e.key === 'ArrowRight') { e.preventDefault(); input.right = down; }
      if (e.key === 'ArrowUp' || e.key === ' ') { e.preventDefault(); input.jump = down; if (!down) input.jumpHeld = false; else input.jumpHeld = true; }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKey);

    function updateInfo() {
      const pct = Math.min(100, Math.round(P.x / (flagX) * 100));
      api.setInfo(`${'❤️'.repeat(hearts)}${'🤍'.repeat(Math.max(0, 3 - hearts))} · ⭐${stars} · 进度 ${pct}%`);
    }

    function hurt(knockDir) {
      if (inv > 0) return;
      hearts--;
      inv = 1.6;
      P.vy = -300 * U;
      P.vx = knockDir * 200 * U;
      updateInfo();
      if (hearts <= 0) {
        over = true;
        api.fail(`糯糯晕倒了…走到了 ${Math.round(P.x / flagX * 100)}%`);
      }
    }

    function respawn() {
      hearts--;
      updateInfo();
      if (hearts <= 0) {
        over = true;
        api.fail(`掉下悬崖…走到了 ${Math.round(P.x / flagX * 100)}%`);
        return;
      }
      P.x = checkpoint.x + 30 * U;
      P.y = checkpoint.y - 60 * U;
      P.vx = 0; P.vy = 0;
      inv = 1.6;
    }

    function update(dt) {
      inv = Math.max(0, inv - dt);
      // 水平移动
      const target = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      P.vx += (target * 190 * U - P.vx) * Math.min(1, dt * 12);
      // 跳跃（郊狼时间：离开平台 0.1 秒内还能跳）
      P.coyote = P.ground ? 0.1 : Math.max(0, P.coyote - dt);
      if (input.jump && P.coyote > 0) {
        P.vy = -540 * U;
        P.coyote = 0;
        input.jump = false;
      }
      if (!input.jumpHeld && P.vy < -200 * U) P.vy = -200 * U; // 松手小跳
      P.vy += 1400 * U * dt;
      P.x += P.vx * dt;
      P.y += P.vy * dt;
      P.x = Math.max(P.w / 2, P.x);
      // 落到平台上（只在下落时判定）
      P.ground = false;
      if (P.vy >= 0) {
        for (const pl of plats) {
          if (P.x > pl.x - P.w / 3 && P.x < pl.x + pl.w + P.w / 3) {
            const feet = P.y + P.h / 2;
            if (feet >= pl.y && feet <= pl.y + Math.max(18 * U, P.vy * dt + 2)) {
              P.y = pl.y - P.h / 2;
              P.vy = 0;
              P.ground = true;
              checkpoint = pl;
              break;
            }
          }
        }
      }
      // 史莱姆
      for (const s of slimes) {
        if (s.dead) continue;
        s.x += s.dir * 46 * U * dt;
        if (s.x < s.min || s.x > s.max) s.dir *= -1;
        const dx = Math.abs(P.x - s.x), dy = (P.y + P.h / 2) - (s.y - 10 * U);
        if (dx < 20 * U && dy > -8 * U && dy < 16 * U) {
          if (P.vy > 60 * U) { // 从上面踩
            s.dead = true;
            P.vy = -340 * U;
            stars++; // 踩怪奖励一颗星
            updateInfo();
          } else {
            hurt(P.x < s.x ? -1 : 1);
            if (over) return;
          }
        }
      }
      // 星星
      for (const st of starsArr) {
        if (!st.got && Math.abs(P.x - st.x) < 20 * U && Math.abs(P.y - st.y) < 24 * U) {
          st.got = true;
          stars++;
          updateInfo();
        }
      }
      // 史莱姆王（BOSS 关）
      if (bossK && !bossK.dead) {
        bossK.inv = Math.max(0, bossK.inv - dt);
        bossK.x += bossK.dir * 85 * U * dt;
        if (bossK.x < lastPlat.x + 40 * U) bossK.dir = 1;
        if (bossK.x > flagX - 40 * U) bossK.dir = -1;
        // 王还活着，旗子过不去
        if (P.x > flagX - 28 * U) { P.x = flagX - 28 * U; P.vx = Math.min(P.vx, 0); }
        const dx = Math.abs(P.x - bossK.x);
        const dy = (P.y + P.h / 2) - (lastPlat.y - 20 * U);
        if (dx < 30 * U && dy > -14 * U && dy < 28 * U) {
          if (P.vy > 60 * U && bossK.inv <= 0) {
            bossK.hp--;
            bossK.inv = 0.55;
            P.vy = -420 * U;
            if (bossK.hp <= 0) { bossK.dead = true; stars += 5; }
            updateInfo();
          } else if (bossK.inv <= 0 && inv <= 0) {
            hurt(P.x < bossK.x ? -1 : 1);
            if (over) return;
          }
        }
      }
      // 掉落
      if (P.y > H + 60 * U) { respawn(); if (over) return; }
      // 旗子
      if (P.x >= flagX) {
        over = true;
        api.win({ detail: `🍀 收集 ${stars} ⭐ · 剩余 ${hearts} ❤️${params.boss ? ' · 史莱姆王被踩扁啦 👑' : ''}` });
      }
    }

    function draw() {
      const cam = Math.max(0, Math.min(P.x - W * 0.35, flagX + 60 * U - W));
      // 天空
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#CDEDF5');
      g.addColorStop(1, '#FDF3E3');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // 云朵（慢视差）
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 4; i++) {
        const cx2 = ((i * 340 * U - cam * 0.15) % (W + 200 * U) + W + 200 * U) % (W + 200 * U) - 100 * U;
        const cy2 = (30 + i * 26) * U;
        ctx.beginPath();
        ctx.ellipse(cx2, cy2, 34 * U, 13 * U, 0, 0, 7);
        ctx.ellipse(cx2 + 20 * U, cy2 - 8 * U, 20 * U, 11 * U, 0, 0, 7);
        ctx.fill();
      }
      // 远山（视差）
      ctx.fillStyle = 'rgba(125, 219, 192, 0.25)';
      for (let i = 0; i < 6; i++) {
        const hx = (i * 260 * U - cam * 0.3) % (W + 400 * U);
        ctx.beginPath();
        ctx.arc(hx, H, 130 * U, 3.14, 0);
        ctx.fill();
      }
      ctx.save();
      ctx.translate(-cam, 0);
      // 平台（草地顶 + 小花）
      const FLOWER_COLORS = ['#F783AC', '#FFD98E', '#C3B3F5'];
      for (const pl of plats) {
        if (pl.x + pl.w < cam || pl.x > cam + W) continue;
        ctx.fillStyle = '#E8CFA8';
        ctx.beginPath();
        ctx.roundRect(pl.x, pl.y, pl.w, H - pl.y + 40 * U, 8 * U);
        ctx.fill();
        ctx.fillStyle = '#7DDBC0';
        ctx.beginPath();
        ctx.roundRect(pl.x, pl.y, pl.w, 14 * U, 8 * U);
        ctx.fill();
        for (let k = 0; k < 3; k++) {
          const fx = pl.x + 12 * U + ((pl.x * 0.7 + k * 97) % Math.max(1, pl.w - 24 * U));
          ctx.fillStyle = FLOWER_COLORS[(k + Math.floor(pl.x)) % 3];
          ctx.beginPath();
          ctx.arc(fx, pl.y - 4 * U, 3 * U, 0, 7);
          ctx.fill();
        }
      }
      // 星星
      ctx.font = `${22 * U}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const st of starsArr) {
        if (!st.got && st.x > cam - 30 && st.x < cam + W + 30) ctx.fillText('⭐', st.x, st.y);
      }
      // 史莱姆
      for (const s of slimes) {
        if (s.dead || s.x < cam - 40 || s.x > cam + W + 40) continue;
        ctx.fillStyle = '#F9A8C4';
        ctx.beginPath();
        ctx.ellipse(s.x, s.y - 9 * U, 15 * U, 11 * U, 0, 3.14, 0);
        ctx.fill();
        ctx.fillRect(s.x - 15 * U, s.y - 9 * U, 30 * U, 9 * U);
        ctx.fillStyle = '#5B4A56';
        ctx.beginPath();
        ctx.arc(s.x - 5 * U + s.dir * 2, s.y - 11 * U, 2.2 * U, 0, 7);
        ctx.arc(s.x + 5 * U + s.dir * 2, s.y - 11 * U, 2.2 * U, 0, 7);
        ctx.fill();
      }
      // 史莱姆王
      if (bossK && !bossK.dead && bossK.x > cam - 80 * U && bossK.x < cam + W + 80 * U) {
        if (bossK.inv <= 0 || Math.floor(bossK.inv * 12) % 2 === 0) {
          const bx = bossK.x, by = lastPlat.y;
          ctx.fillStyle = '#F06292';
          ctx.beginPath();
          ctx.ellipse(bx, by - 16 * U, 28 * U, 20 * U, 0, 3.14, 0);
          ctx.fill();
          ctx.fillRect(bx - 28 * U, by - 16 * U, 56 * U, 16 * U);
          ctx.fillStyle = '#5B4A56';
          ctx.beginPath();
          ctx.arc(bx - 9 * U + bossK.dir * 3, by - 19 * U, 3.6 * U, 0, 7);
          ctx.arc(bx + 9 * U + bossK.dir * 3, by - 19 * U, 3.6 * U, 0, 7);
          ctx.fill();
          ctx.font = `${20 * U}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('👑', bx, by - 44 * U);
          ctx.font = `${11 * U}px sans-serif`;
          ctx.fillText('❤️'.repeat(bossK.hp), bx, by - 62 * U);
        }
      }
      // 旗子
      ctx.strokeStyle = '#8A776F';
      ctx.lineWidth = 4 * U;
      ctx.beginPath();
      ctx.moveTo(flagX, lastPlat.y);
      ctx.lineTo(flagX, lastPlat.y - 90 * U);
      ctx.stroke();
      ctx.fillStyle = '#F783AC';
      ctx.beginPath();
      ctx.moveTo(flagX, lastPlat.y - 90 * U);
      ctx.lineTo(flagX + 34 * U, lastPlat.y - 78 * U);
      ctx.lineTo(flagX, lastPlat.y - 66 * U);
      ctx.fill();
      // 糯糯（受伤闪烁）
      if (inv <= 0 || Math.floor(inv * 10) % 2 === 0) {
        const px = P.x, py = P.y;
        ctx.fillStyle = '#7DDBC0';
        ctx.beginPath();
        ctx.ellipse(px, py, P.w * 0.62, P.h * 0.58, 0, 0, 7);
        ctx.fill();
        // 耳朵
        ctx.beginPath();
        ctx.ellipse(px - 7 * U, py - 14 * U, 4 * U, 7 * U, -0.3, 0, 7);
        ctx.ellipse(px + 7 * U, py - 14 * U, 4 * U, 7 * U, 0.3, 0, 7);
        ctx.fill();
        // 脸
        const look = P.vx > 20 * U ? 2 * U : P.vx < -20 * U ? -2 * U : 0;
        ctx.fillStyle = '#5B4A56';
        ctx.beginPath();
        ctx.arc(px - 5 * U + look, py - 3 * U, 2.6 * U, 0, 7);
        ctx.arc(px + 5 * U + look, py - 3 * U, 2.6 * U, 0, 7);
        ctx.fill();
        ctx.fillStyle = '#FFB3C6';
        ctx.beginPath();
        ctx.arc(px - 8 * U + look, py + 3 * U, 2.4 * U, 0, 7);
        ctx.arc(px + 8 * U + look, py + 3 * U, 2.4 * U, 0, 7);
        ctx.fill();
      }
      ctx.restore();
    }

    function loop(t) {
      if (over) return;
      if (!last) last = t;
      const dt = Math.min(0.033, (t - last) / 1000);
      last = t;
      update(dt);
      if (!over) { draw(); raf = requestAnimationFrame(loop); }
    }

    updateInfo();
    raf = requestAnimationFrame(loop);
    return () => {
      over = true;
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('keyup', onKey);
    };
  },
});
