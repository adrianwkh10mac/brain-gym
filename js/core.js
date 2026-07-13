// ===== BrainGym 核心：注册表 / 屏幕 / 计时 / 存档 / 结算 / 主题 / 护眼 =====
// 全项目唯一的全局变量。各游戏文件只调用 BrainGym.register(...)，
// 生成算法挂在 BrainGym.gen（见 gen.js）。

var BrainGym = (function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const games = {};
  const order = [];

  // ---------- 存档（localStorage，失败时静默降级为内存模式） ----------
  const SAVE_KEY = 'brainGym.save.v1';
  const LOG_MAX = 500; // 游玩记录最多保留 500 条，避免存档无限变大
  let saveData = { games: {}, totalPlays: 0, settings: { theme: 'light', rest: true }, log: [] };
  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        saveData = Object.assign(saveData, parsed);
        if (typeof saveData.games !== 'object' || saveData.games === null || Array.isArray(saveData.games)) {
          saveData.games = {};
        }
        if (!Array.isArray(saveData.log)) saveData.log = [];
        saveData.settings = Object.assign({ theme: 'light', rest: true }, parsed.settings);
      }
    } catch (e) { /* 隐私模式等场景下用内存模式 */ }
  }
  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(saveData)); } catch (e) { /* 同上 */ }
  }
  function gameSave(id) {
    if (!saveData.games[id]) saveData.games[id] = { practice: {}, challenge: 0, plays: 0 };
    return saveData.games[id];
  }

  // ---------- 工具 ----------
  function formatTime(ms) {
    const t = Math.max(0, Math.round(ms / 100) / 10);
    const m = Math.floor(t / 60);
    const s = (t - m * 60).toFixed(1);
    return m > 0 ? `${m}分${Math.floor(t - m * 60)}秒` : `${s}秒`;
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function randInt(n) { return Math.floor(Math.random() * n); }

  // ---------- 屏幕 ----------
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
  }
  function showOverlay(id, on) { $(id).classList.toggle('active', on); }

  // ---------- 主题（护眼） ----------
  const THEME_COLORS = { light: '#FDF6EC', warm: '#FBEED6', dark: '#2E2933' };
  function applyTheme() {
    const t = saveData.settings.theme;
    document.documentElement.dataset.theme = t;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = THEME_COLORS[t] || THEME_COLORS.light;
  }

  // ---------- 计时器 ----------
  let timerStart = 0, timerInterval = null, timerFrozen = null;
  function startTimer() {
    stopTimer();
    timerStart = Date.now();
    timerFrozen = null;
    $('play-timer').textContent = '0:00';
    timerInterval = setInterval(() => {
      const t = Math.floor(elapsed() / 1000);
      $('play-timer').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    }, 250);
  }
  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }
  function elapsed() {
    return timerFrozen !== null ? timerFrozen : Date.now() - timerStart;
  }

  // ---------- 护眼休息提醒（20-20-20 法则，玩满 20 分钟立刻提醒，不等对局结束） ----------
  const REST_AFTER = 20 * 60; // 秒
  let playSeconds = 0;
  let restCountdown = null;
  function tickPlayTime() {
    if (document.hidden) return;
    if (session && !session.done && $('screen-play').classList.contains('active')) {
      playSeconds++;
      maybeRest();
    }
    updateRestBar();
  }
  function updateRestBar() {
    const bar = $('rest-bar');
    const inPlay = session && !session.done && $('screen-play').classList.contains('active');
    const show = saveData.settings.rest && inPlay && !$('overlay-rest-eye').classList.contains('active');
    bar.classList.toggle('active', show);
    if (!show) return;
    const remain = Math.max(0, REST_AFTER - playSeconds);
    const m = Math.floor(remain / 60), s = remain % 60;
    $('rest-bar-text').textContent = `还可以玩 ${m}:${String(s).padStart(2, '0')}`;
    $('rest-bar-fill').style.width = Math.min(100, playSeconds / REST_AFTER * 100) + '%';
    $('rest-bar-fill').classList.toggle('soon', remain <= 120);
  }
  function maybeRest() {
    if (!saveData.settings.rest || playSeconds < REST_AFTER) return;
    playSeconds = 0;
    let left = 20;
    $('rest-count').textContent = left;
    $('btn-rest-done').style.display = 'none';
    showOverlay('overlay-rest-eye', true);
    updateRestBar();
    restCountdown = setInterval(() => {
      left--;
      if (left <= 0) {
        clearInterval(restCountdown); restCountdown = null;
        $('rest-count').textContent = '✓';
        $('btn-rest-done').style.display = '';
      } else {
        $('rest-count').textContent = left;
      }
    }, 1000);
  }
  function closeRest() {
    if (restCountdown) { clearInterval(restCountdown); restCountdown = null; }
    showOverlay('overlay-rest-eye', false);
    updateRestBar();
  }

  // ---------- 游玩记录（给家长看：什么时候玩的、玩了多久） ----------
  function logPlaySession(s) {
    const def = games[s.gameId];
    const duration = Math.round(elapsed() / 1000);
    if (duration < 3) return; // 少于 3 秒的误触不记录
    saveData.log.unshift({
      gameId: s.gameId,
      name: def ? def.name : s.gameId,
      icon: def ? def.icon : '🎮',
      mode: s.mode,
      level: s.level, diffKey: s.diffKey,
      start: s.logStart,
      duration,
      outcome: s.outcome || 'left', // win | fail | left（中途退出）
    });
    if (saveData.log.length > LOG_MAX) saveData.log.length = LOG_MAX;
    persist();
  }

  // ---------- 当前对局 ----------
  let session = null; // {gameId, mode, diffKey, level, cleanup, done, logStart, logged, outcome}

  function cleanupSession() {
    if (session && !session.logged && session.logStart) {
      logPlaySession(session);
      session.logged = true;
    }
    if (session && typeof session.cleanup === 'function') {
      try { session.cleanup(); } catch (e) { /* 清理失败不影响流程 */ }
    }
    stopTimer();
  }

  function startGame(gameId, mode, opt) {
    cleanupSession();
    const def = games[gameId];
    if (!def) return;
    session = { gameId, mode, done: false, cleanup: null, logStart: Date.now(), logged: false };
    let params, subLabel;
    if (mode === 'practice') {
      const diff = def.practice.find(d => d.key === opt) || def.practice[0];
      session.diffKey = diff.key;
      params = diff.params;
      subLabel = `练习 · ${diff.label}`;
    } else {
      session.level = opt;
      params = def.challenge(opt);
      subLabel = `闯关 · 第 ${opt} 关`;
    }
    $('play-title').textContent = `${def.icon} ${def.name}`;
    $('play-sub').textContent = subLabel;
    $('play-info').innerHTML = '';
    const host = $('game-host');
    host.innerHTML = '';
    host.className = 'game-host game-' + gameId;
    showOverlay('overlay-mode', false);
    showOverlay('overlay-result', false);
    showScreen('screen-play');
    startTimer();
    updateRestBar();
    session.cleanup = def.start(host, params, makeApi(session)) || null;
  }

  // ---------- 传给游戏的接口（绑定对局，过期调用一律忽略，防跨局残留） ----------
  function makeApi(s) {
    const alive = () => session === s && !s.done;
    return {
      elapsed,
      setInfo(html) { if (alive()) $('play-info').innerHTML = html; },
      win(stats) { if (alive()) finishWin(s, stats); },
      fail(msg) { if (alive()) finishFail(s, msg); },
    };
  }

  // 主线 50 关：打通第 50 关 = 大结局，之后进入无限模式
  const FINAL_LEVEL = 50;

  function finishWin(s, stats) {
    s.done = true;
    s.outcome = 'win';
    timerFrozen = elapsed();
    cleanupSession();
    const def = games[s.gameId];
    const save = gameSave(s.gameId);
    save.plays++; saveData.totalPlays++;
    const time = timerFrozen;
    let recordMsg = '';
    if (s.mode === 'practice') {
      const best = save.practice[s.diffKey];
      if (!best || time < best) {
        save.practice[s.diffKey] = time;
        recordMsg = best ? `🏆 新纪录！比之前快了 ${formatTime(best - time)}` : '🏆 首个纪录达成！';
      } else {
        recordMsg = `历史最佳：${formatTime(best)}`;
      }
    } else {
      if (s.level > save.challenge) {
        save.challenge = s.level;
        recordMsg = `🏔️ 新高度：闯到第 ${s.level} 关！`;
      } else {
        recordMsg = `历史最高：第 ${save.challenge} 关`;
      }
    }
    const isEnding = s.mode === 'challenge' && s.level === FINAL_LEVEL;
    if (isEnding) save.ending = true;
    persist();
    let statsHtml = `<div class="stat-line">⏱️ 用时 <b>${formatTime(time)}</b></div>`;
    if (stats && stats.detail) statsHtml += `<div class="stat-line">${stats.detail}</div>`;
    if (isEnding) {
      statsHtml += `<div class="stat-line ending-line">🎬 大结局达成！你已成为「${def.name}」大师！<br>第 ${FINAL_LEVEL + 1} 关起进入无限模式，难度继续攀升，去创造传说吧～</div>`;
    }
    $('result-title').textContent = isEnding ? '👑 主线通关！大结局！'
      : s.mode === 'challenge' ? `🎉 第 ${s.level} 关通过！` : '🎉 完成！';
    $('result-stats').innerHTML = statsHtml;
    $('result-record').textContent = recordMsg;
    const main = $('btn-result-main');
    if (s.mode === 'challenge') {
      main.textContent = isEnding ? `进入无限模式（第 ${FINAL_LEVEL + 1} 关）` : `下一关（第 ${s.level + 1} 关）`;
      main.onclick = () => { closeRest(); startGame(s.gameId, 'challenge', s.level + 1); };
    } else {
      main.textContent = '再来一局';
      main.onclick = () => { closeRest(); startGame(s.gameId, 'practice', s.diffKey); };
    }
    if (isEnding) { confetti(); setTimeout(confetti, 600); setTimeout(confetti, 1200); }
    else if (recordMsg.startsWith('🏆') || recordMsg.startsWith('🏔️')) confetti();
    showOverlay('overlay-result', true);
    maybeRest();
    updateRestBar();
  }

  function finishFail(s, msg) {
    s.done = true;
    s.outcome = 'fail';
    cleanupSession();
    const save = gameSave(s.gameId);
    save.plays++; saveData.totalPlays++;
    persist();
    $('result-title').textContent = '😵 挑战失败';
    $('result-stats').innerHTML = `<div class="stat-line">${msg || '差一点点，再试一次！'}</div>`;
    $('result-record').textContent = s.mode === 'challenge' ? `历史最高：第 ${save.challenge} 关` : '';
    const main = $('btn-result-main');
    main.textContent = '重试';
    main.onclick = () => { closeRest(); startGame(s.gameId, s.mode, s.mode === 'practice' ? s.diffKey : s.level); };
    showOverlay('overlay-result', true);
    maybeRest();
    updateRestBar();
  }

  // ---------- 模式选择弹层 ----------
  function openMode(gameId) {
    const def = games[gameId];
    const save = gameSave(gameId);
    $('mode-icon').textContent = def.icon;
    $('mode-title').textContent = def.name;
    $('mode-desc').textContent = def.desc;
    const pWrap = $('mode-practice');
    pWrap.innerHTML = '';
    def.practice.forEach(diff => {
      const best = save.practice[diff.key];
      const b = document.createElement('button');
      b.className = 'btn diff-btn';
      b.innerHTML = `<span>${diff.label}</span><small>${best ? '🏆 ' + formatTime(best) : '未玩过'}</small>`;
      b.onclick = () => startGame(gameId, 'practice', diff.key);
      pWrap.appendChild(b);
    });
    const cWrap = $('mode-challenge');
    cWrap.innerHTML = '';
    const c1 = document.createElement('button');
    c1.className = 'btn diff-btn challenge-btn';
    c1.innerHTML = `<span>从第 1 关开始</span><small>${save.challenge ? '🏔️ 最高第 ' + save.challenge + ' 关' : '尚未挑战'}</small>`;
    c1.onclick = () => startGame(gameId, 'challenge', 1);
    cWrap.appendChild(c1);
    if (save.challenge > 1) {
      const c2 = document.createElement('button');
      c2.className = 'btn diff-btn challenge-btn';
      c2.innerHTML = `<span>继续冲：第 ${save.challenge} 关</span><small>从最高纪录出发</small>`;
      c2.onclick = () => startGame(gameId, 'challenge', save.challenge);
      cWrap.appendChild(c2);
    }
    showOverlay('overlay-mode', true);
  }

  // ---------- 设置弹层 ----------
  function openSettings() {
    renderSettings();
    showOverlay('overlay-settings', true);
  }
  function renderSettings() {
    document.querySelectorAll('#theme-btns .theme-btn').forEach(b => {
      b.classList.toggle('on', b.dataset.theme === saveData.settings.theme);
    });
    const rest = $('btn-rest-toggle');
    rest.textContent = saveData.settings.rest ? '💚 已开启' : '⚪ 已关闭';
    rest.classList.toggle('on', saveData.settings.rest);
    $('settings-version').textContent = `v${APP_VERSION} · ${APP_BUILD_DATE}`;
  }

  // ---------- 游玩记录查看（家长用） ----------
  function formatLogDuration(sec) {
    if (sec < 60) return `${sec}秒`;
    const m = Math.floor(sec / 60), s = sec % 60;
    return s > 0 ? `${m}分${s}秒` : `${m}分钟`;
  }
  function logDayLabel(ts) {
    const d = new Date(ts), now = new Date();
    const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    if (sameDay(d, now)) return '今天';
    if (sameDay(d, yesterday)) return '昨天';
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }
  function logClockLabel(ts) {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const OUTCOME_ICON = { win: '🎉', fail: '😵', left: '🚪' };
  function renderLog() {
    const log = saveData.log || [];
    const list = $('log-list');
    if (log.length === 0) {
      list.innerHTML = '<div class="log-empty">还没有游玩记录</div>';
      $('log-summary').textContent = '';
      return;
    }
    const todaySecs = log.filter(e => logDayLabel(e.start) === '今天').reduce((sum, e) => sum + e.duration, 0);
    $('log-summary').textContent = todaySecs > 0 ? `今天共玩了 ${formatLogDuration(todaySecs)}` : '今天还没玩过';

    const groups = [];
    let curLabel = null, curGroup = null;
    log.forEach(e => {
      const label = logDayLabel(e.start);
      if (label !== curLabel) {
        curLabel = label;
        curGroup = { label, items: [], total: 0 };
        groups.push(curGroup);
      }
      curGroup.items.push(e);
      curGroup.total += e.duration;
    });

    list.innerHTML = groups.map(g => `
      <div class="log-day">
        <div class="log-day-title">${g.label} <span class="log-day-total">· 共 ${formatLogDuration(g.total)}</span></div>
        ${g.items.map(e => `
          <div class="log-row">
            <span class="log-row-icon">${e.icon || '🎮'}</span>
            <div class="log-row-main">
              <div class="log-row-name">${e.name}</div>
              <div class="log-row-time">${logClockLabel(e.start)} 开始</div>
            </div>
            <span class="log-row-dur">${formatLogDuration(e.duration)}</span>
            <span class="log-row-outcome">${OUTCOME_ICON[e.outcome] || '🚪'}</span>
          </div>
        `).join('')}
      </div>
    `).join('');
  }

  // ---------- 主页（按分类分区） ----------
  const CATS = [
    { key: 'brain', label: '🧠 脑力训练' },
    { key: 'arcade', label: '🕹️ 街机乐园' },
  ];
  function renderHome() {
    const wrap = $('game-sections');
    wrap.innerHTML = '';
    let i = 0;
    CATS.forEach(cat => {
      const ids = order.filter(id => (games[id].cat || 'brain') === cat.key);
      if (!ids.length) return;
      const title = document.createElement('h2');
      title.className = 'cat-title';
      title.textContent = cat.label;
      wrap.appendChild(title);
      const grid = document.createElement('div');
      grid.className = 'game-grid';
      ids.forEach(id => {
        const def = games[id];
        const save = gameSave(id);
        const card = document.createElement('button');
        card.className = 'game-card tone-' + (def.tone || 'mint');
        card.style.setProperty('--d', (i++ * 0.04) + 's');
        card.innerHTML = `
          <span class="gc-icon">${def.icon}</span>
          <span class="gc-name">${def.name}</span>
          <span class="gc-tag">${def.tag}</span>
          <span class="gc-record">${save.ending || save.challenge >= FINAL_LEVEL ? '👑 已通关 · 第 ' + save.challenge + ' 关'
            : save.challenge ? '🏔️ 第 ' + save.challenge + '/' + FINAL_LEVEL + ' 关'
            : (save.plays ? '玩过 ' + save.plays + ' 次' : 'NEW!')}</span>`;
        card.onclick = () => openMode(id);
        grid.appendChild(card);
      });
      wrap.appendChild(grid);
    });
    $('home-stats').textContent = saveData.totalPlays > 0
      ? `💪 已累计完成 ${saveData.totalPlays} 次训练`
      : '👋 点一个游戏开始训练吧';
  }

  // ---------- 彩带 ----------
  function confetti() {
    const layer = $('confetti-layer');
    const colors = ['#F9A8C4', '#7DDBC0', '#FFD98E', '#C3B3F5', '#FF9E80'];
    for (let i = 0; i < 50; i++) {
      const p = document.createElement('span');
      p.className = 'confetti';
      p.style.left = Math.random() * 100 + 'vw';
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * 0.9) + 's';
      p.style.animationDuration = (1.8 + Math.random() * 1.4) + 's';
      p.style.setProperty('--drift', (Math.random() * 120 - 60) + 'px');
      layer.appendChild(p);
      setTimeout(() => p.remove(), 3400);
    }
  }

  // ---------- 初始化（boot.js 在所有游戏注册完后调用） ----------
  function init() {
    loadSave();
    applyTheme();
    renderHome();
    setInterval(tickPlayTime, 1000);

    $('btn-back').onclick = () => {
      cleanupSession();
      session = null;
      renderHome();
      showScreen('screen-home');
      maybeRest();
    };
    $('btn-mode-close').onclick = () => showOverlay('overlay-mode', false);
    $('btn-result-home').onclick = () => {
      showOverlay('overlay-result', false);
      session = null;
      renderHome();
      showScreen('screen-home');
    };
    // 设置
    $('btn-settings').onclick = openSettings;
    $('btn-settings-close').onclick = () => showOverlay('overlay-settings', false);
    document.querySelectorAll('#theme-btns .theme-btn').forEach(b => {
      b.onclick = () => {
        saveData.settings.theme = b.dataset.theme;
        persist();
        applyTheme();
        renderSettings();
      };
    });
    $('btn-rest-toggle').onclick = () => {
      saveData.settings.rest = !saveData.settings.rest;
      persist();
      renderSettings();
      updateRestBar();
    };
    $('btn-reset-save').onclick = () => {
      if (confirm('确定要清空所有游戏纪录和游玩记录吗？（主题设置会保留）')) {
        const settings = saveData.settings;
        saveData = { games: {}, totalPlays: 0, settings, log: [] };
        persist();
        renderHome();
        showOverlay('overlay-settings', false);
      }
    };
    // 游玩记录
    $('btn-log-open').onclick = () => {
      renderLog();
      showOverlay('overlay-settings', false);
      showOverlay('overlay-log', true);
    };
    $('btn-log-close').onclick = () => {
      showOverlay('overlay-log', false);
      showOverlay('overlay-settings', true);
    };
    // 护眼休息
    $('btn-rest-done').onclick = closeRest;
    $('btn-rest-skip').onclick = closeRest;
  }

  return {
    // def: {id, name, icon, tone, tag, desc, practice:[{key,label,params}], challenge(level)=>params, start(host,params,api)=>cleanup?}
    register(def) { games[def.id] = def; order.push(def.id); },
    init,
    // 共享工具，游戏文件直接用
    utils: { shuffle, randInt, formatTime },
    gen: {}, // gen.js 往这里挂算法
    _games: games,
  };
})();

if (typeof module !== 'undefined') module.exports = BrainGym;
