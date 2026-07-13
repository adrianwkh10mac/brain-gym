// ===== 记忆翻牌：翻开两张找相同图案 =====
BrainGym.register({
  id: 'memory',
  name: '记忆翻牌',
  icon: '🎴',
  tone: 'lavender',
  tag: '记忆力',
  desc: '翻开两张牌找相同图案，全部配对成功即通关。记住每张牌的位置！',
  practice: [
    { key: 'e', label: '简单 12张', params: { pairs: 6 } },
    { key: 'm', label: '中等 20张', params: { pairs: 10 } },
    { key: 'h', label: '困难 30张', params: { pairs: 15 } },
    { key: 'x', label: '地狱 48张', params: { pairs: 24 } },
    { key: 'xx', label: '疯狂 60张', params: { pairs: 30 } },
  ],
  // 闯关：牌渐多、预览时间渐短、允许失误渐少（保底 3 次）
  challenge(lv) {
    const pairs = Math.min(3 + Math.round(lv * 0.6), 30);
    return {
      pairs,
      preview: true,
      previewMs: Math.max(900, 3000 - (lv - 1) * 45),
      maxMiss: Math.max(3, Math.round(pairs * 1.6) - Math.floor(lv / 4)),
    };
  },
  start(host, params, api) {
    const { shuffle } = BrainGym.utils;
    const EMOJIS = ['🐱','🐶','🐰','🦊','🐼','🐨','🦁','🐷','🐸','🐵','🐔','🐧','🦄','🐙','🦋','🐢','🐳','🦀','🍎','🍌','🍇','🍓','🍑','🥕','🌽','🍄','🌵','🌸','⭐','🌈'];
    const faces = shuffle(EMOJIS).slice(0, params.pairs);
    const deck = shuffle([...faces, ...faces]);
    const total = deck.length;
    const cols = total <= 12 ? 4 : total <= 20 ? 4 : total <= 30 ? 5 : 6;

    let open = [];       // 当前翻开待比对的卡
    let matched = 0;
    let flips = 0, misses = 0;
    let lock = false;    // 预览或比对动画期间锁操作

    const board = document.createElement('div');
    board.className = 'memory-board';
    board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    host.appendChild(board);

    const cards = deck.map((face, i) => {
      const c = document.createElement('button');
      c.className = 'memory-card';
      c.innerHTML = `<span class="mc-front">${face}</span><span class="mc-back">❔</span>`;
      c.onclick = () => onFlip(i);
      board.appendChild(c);
      return c;
    });

    function updateInfo() {
      let html = `配对 <b class="info-big">${matched}</b> / ${params.pairs} · 翻牌 ${flips} 次`;
      if (params.maxMiss) {
        const left = params.maxMiss - misses;
        html += ` <span class="info-limit">💔 还能错 ${left} 次</span>`;
      }
      api.setInfo(html);
    }

    function onFlip(i) {
      if (lock) return;
      const c = cards[i];
      if (c.classList.contains('open') || c.classList.contains('matched')) return;
      c.classList.add('open');
      open.push(i);
      flips++;
      if (open.length === 2) {
        const [a, b] = open;
        open = [];
        if (deck[a] === deck[b]) {
          cards[a].classList.add('matched');
          cards[b].classList.add('matched');
          matched++;
          updateInfo();
          if (matched === params.pairs) {
            api.win({ detail: `🎴 共翻牌 ${flips} 次，失误 ${misses} 次` });
          }
        } else {
          misses++;
          updateInfo();
          if (params.maxMiss && misses >= params.maxMiss) {
            lock = true;
            setTimeout(() => api.fail(`失误次数用完啦！配对了 ${matched} / ${params.pairs}`), 500);
            return;
          }
          lock = true;
          setTimeout(() => {
            cards[a].classList.remove('open');
            cards[b].classList.remove('open');
            lock = false;
          }, 650);
        }
      }
      updateInfo();
    }

    updateInfo();
    // 闯关模式开局预览（关数越高时间越短）
    let previewT = null;
    if (params.preview) {
      lock = true;
      cards.forEach(c => c.classList.add('open'));
      api.setInfo('👀 快记住位置！');
      previewT = setTimeout(() => {
        cards.forEach(c => c.classList.remove('open'));
        lock = false;
        updateInfo();
      }, params.previewMs || 3000);
    }
    return () => { if (previewT) clearTimeout(previewT); };
  },
});
