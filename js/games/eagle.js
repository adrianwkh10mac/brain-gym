// ===== 火眼金睛：找出颜色不一样的那个色块 =====
BrainGym.register({
  id: 'eagle',
  name: '火眼金睛',
  icon: '👀',
  tone: 'pink',
  tag: '眼力',
  desc: '一堆色块里有一块颜色略微不同，把它找出来！难度越高色差越细微。',
  practice: [
    { key: 'e', label: '简单', params: { grid: 4, delta: 20, rounds: 5 } },
    { key: 'm', label: '中等', params: { grid: 5, delta: 12, rounds: 5 } },
    { key: 'h', label: '困难', params: { grid: 7, delta: 8, rounds: 5 } },
    { key: 'x', label: '地狱', params: { grid: 9, delta: 5, rounds: 5 } },
    { key: 'xx', label: '疯狂', params: { grid: 11, delta: 3.5, rounds: 5 } },
  ],
  // 闯关：格子渐多、色差渐小、轮数渐多、限时渐紧
  // 保底线：色差 ≥3（人眼可辨），大棋盘每轮 ≥5 秒（可完成）
  challenge(lv) {
    const rounds = 3 + Math.floor(lv / 6);
    const grid = Math.min(3 + Math.ceil(lv / 4), 13);
    const perRoundFloor = grid >= 9 ? 4.5 : 3.5;
    return {
      grid,
      delta: Math.max(2.5, 17 - lv * 0.35),
      rounds,
      timeLimit: Math.ceil(rounds * Math.max(perRoundFloor, 7.5 - lv * 0.11)),
    };
  },
  start(host, params, api) {
    const { randInt } = BrainGym.utils;
    let round = 0;
    let countdown = null;

    const board = document.createElement('div');
    board.className = 'eagle-board';
    host.appendChild(board);

    function nextRound() {
      round++;
      if (round > params.rounds) { api.win(); return; }
      updateInfo();
      const g = params.grid;
      board.style.gridTemplateColumns = `repeat(${g}, 1fr)`;
      board.innerHTML = '';
      const hue = randInt(360);
      const sat = 55 + randInt(25);
      const light = 45 + randInt(20);
      // 偶数轮偏亮、奇数轮偏暗，避免总往一个方向猜
      const sign = Math.random() < 0.5 ? 1 : -1;
      const odd = randInt(g * g);
      const base = `hsl(${hue}, ${sat}%, ${light}%)`;
      const diff = `hsl(${hue}, ${sat}%, ${light + sign * params.delta}%)`;
      for (let i = 0; i < g * g; i++) {
        const b = document.createElement('button');
        b.className = 'eagle-cell';
        b.style.background = i === odd ? diff : base;
        b.onclick = () => {
          if (i === odd) {
            b.classList.add('eagle-hit');
            setTimeout(nextRound, 180);
          } else {
            b.classList.remove('wrong'); void b.offsetWidth;
            b.classList.add('wrong');
          }
        };
        board.appendChild(b);
      }
    }

    function updateInfo() {
      let html = `第 <b class="info-big">${Math.min(round, params.rounds)}</b> / ${params.rounds} 轮`;
      if (params.timeLimit) {
        const left = Math.max(0, params.timeLimit - Math.floor(api.elapsed() / 1000));
        html += ` <span class="info-limit">⏳ ${left}s</span>`;
      }
      api.setInfo(html);
    }

    nextRound();
    if (params.timeLimit) {
      countdown = setInterval(() => {
        updateInfo();
        if (api.elapsed() >= params.timeLimit * 1000) {
          clearInterval(countdown);
          api.fail(`时间到！完成了 ${round - 1} / ${params.rounds} 轮`);
        }
      }, 250);
    }
    return () => { if (countdown) clearInterval(countdown); };
  },
});
