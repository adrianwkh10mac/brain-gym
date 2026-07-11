// ===== 舒尔特方格：按 1→N 顺序点数字，练专注力 =====
BrainGym.register({
  id: 'schulte',
  name: '舒尔特方格',
  icon: '🔢',
  tone: 'mint',
  tag: '专注力',
  desc: '按 1 → N 的顺序快速点击数字。眼睛盯住中心、用余光找数，是经典的专注力训练法。',
  practice: [
    { key: 'e', label: '3×3', params: { n: 3 } },
    { key: 'm', label: '4×4', params: { n: 4 } },
    { key: 'h', label: '5×5', params: { n: 5 } },
    { key: 'x', label: '6×6', params: { n: 6 } },
    { key: 'xx', label: '7×7 疯狂', params: { n: 7 } },
    { key: 'rv', label: '5×5 倒序', params: { n: 5, reverse: true } },
  ],
  // 闯关：每 3 关升一档格子；7×7 之后进入倒序模式，限时无限收紧（但保底可完成）
  challenge(lv) {
    const n = Math.min(3 + Math.floor((lv - 1) / 3), 7);
    const step = (lv - 1) % 3;
    const reverse = lv >= 16;
    const deep = Math.floor(Math.max(0, lv - 16) / 3); // 倒序之后继续加压
    const timeLimit = Math.max(
      Math.ceil(n * n * 0.75),
      Math.round(n * n * 1.4 - step * n * 1.2 - deep * 2)
    );
    return { n, timeLimit, reverse };
  },
  start(host, params, api) {
    const { shuffle } = BrainGym.utils;
    const n = params.n;
    const nums = shuffle([...Array(n * n).keys()].map(v => v + 1));
    const dir = params.reverse ? -1 : 1;
    let next = params.reverse ? n * n : 1;
    let found = 0;
    let countdown = null;

    const board = document.createElement('div');
    board.className = 'schulte-board';
    board.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    nums.forEach(v => {
      const b = document.createElement('button');
      b.className = 'schulte-cell';
      b.textContent = v;
      b.onclick = () => {
        if (v !== next) {
          b.classList.remove('wrong'); void b.offsetWidth;
          b.classList.add('wrong');
          return;
        }
        b.classList.add('found');
        next += dir;
        found++;
        updateInfo();
        if (found >= n * n) api.win(params.reverse ? { detail: '🔁 倒序模式通过！' } : undefined);
      };
      board.appendChild(b);
    });
    host.appendChild(board);

    function updateInfo() {
      const mode = params.reverse ? '🔁 倒序找' : '找';
      let html = `${mode} <b class="info-big">${Math.min(Math.max(next, 1), n * n)}</b>（${found}/${n * n}）`;
      if (params.timeLimit) {
        const left = Math.max(0, params.timeLimit - Math.floor(api.elapsed() / 1000));
        html += ` <span class="info-limit">⏳ ${left}s</span>`;
      }
      api.setInfo(html);
    }
    updateInfo();
    if (params.timeLimit) {
      countdown = setInterval(() => {
        updateInfo();
        if (api.elapsed() >= params.timeLimit * 1000) {
          clearInterval(countdown);
          api.fail(`时间到！你点到了 ${found} / ${n * n}`);
        }
      }, 250);
    }
    return () => { if (countdown) clearInterval(countdown); };
  },
});
