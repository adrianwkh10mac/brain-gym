// ===== 谜题生成算法（纯逻辑，无 DOM，可在 Node 中测试）=====
// 全部挂到 BrainGym.gen 上

(function (NS) {
  'use strict';
  const gen = {};

  function randInt(n) { return Math.floor(Math.random() * n); }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ================= 数独 =================
  // 求解器：数出解的个数（最多数到 limit 就停）
  function sudokuCount(cells, limit) {
    const rows = new Array(9).fill(0), cols = new Array(9).fill(0), boxes = new Array(9).fill(0);
    const FULL = 0x3FE; // bit1~bit9
    for (let i = 0; i < 81; i++) {
      const v = cells[i];
      if (v) {
        const bit = 1 << v, r = Math.floor(i / 9), c = i % 9, b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
        rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
      }
    }
    let count = 0;
    function bt() {
      if (count >= limit) return;
      // 找候选数最少的空格（提速关键）
      let best = -1, bestMask = 0, bestN = 10;
      for (let i = 0; i < 81; i++) {
        if (cells[i]) continue;
        const r = Math.floor(i / 9), c = i % 9, b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
        const mask = FULL & ~(rows[r] | cols[c] | boxes[b]);
        let n = 0;
        for (let v = 1; v <= 9; v++) if (mask & (1 << v)) n++;
        if (n === 0) return; // 死局
        if (n < bestN) { bestN = n; best = i; bestMask = mask; if (n === 1) break; }
      }
      if (best === -1) { count++; return; } // 填满了
      const r = Math.floor(best / 9), c = best % 9, b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
      for (let v = 1; v <= 9; v++) {
        const bit = 1 << v;
        if (!(bestMask & bit)) continue;
        cells[best] = v; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
        bt();
        cells[best] = 0; rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
        if (count >= limit) return;
      }
    }
    bt();
    return count;
  }

  // 随机生成一个填满的合法数独盘
  function sudokuFull() {
    const cells = new Array(81).fill(0);
    const rows = new Array(9).fill(0), cols = new Array(9).fill(0), boxes = new Array(9).fill(0);
    function fill(i) {
      if (i === 81) return true;
      const r = Math.floor(i / 9), c = i % 9, b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
      for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
        const bit = 1 << v;
        if ((rows[r] | cols[c] | boxes[b]) & bit) continue;
        cells[i] = v; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
        if (fill(i + 1)) return true;
        cells[i] = 0; rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
      }
      return false;
    }
    fill(0);
    return cells;
  }

  // 生成题目：挖 holes 个洞，每一步都保证唯一解
  gen.sudoku = function (holes) {
    const solution = sudokuFull();
    const puzzle = solution.slice();
    let dug = 0;
    for (const i of shuffle([...Array(81).keys()])) {
      if (dug >= holes) break;
      const bak = puzzle[i];
      puzzle[i] = 0;
      if (sudokuCount(puzzle.slice(), 2) === 1) dug++;
      else puzzle[i] = bak;
    }
    return { puzzle, solution, holes: dug };
  };
  gen.sudokuCount = (cells, limit) => sudokuCount(cells.slice(), limit);

  // ================= 数织 Nonogram =================
  function lineClues(line) {
    const clues = [];
    let run = 0;
    for (const v of line) {
      if (v === 1) run++;
      else if (run) { clues.push(run); run = 0; }
    }
    if (run) clues.push(run);
    return clues;
  }

  // 对一条线：枚举所有与当前已知格兼容的摆法，求每格的可能取值
  // line: -1未知 0空 1涂  返回每格 bitmask(1=可空, 2=可涂)，无合法摆法返回 null
  function lineDeduce(clues, line) {
    const n = line.length;
    const res = new Array(n).fill(0);
    const assign = new Array(n).fill(0);
    let found = false;
    const minSpace = []; // 从第 ci 个 clue 起还需要的最小长度
    let acc = 0;
    for (let i = clues.length - 1; i >= 0; i--) { acc += clues[i] + (i < clues.length - 1 ? 1 : 0); minSpace[i] = acc; }
    function rec(ci, pos) {
      if (ci === clues.length) {
        for (let x = pos; x < n; x++) { if (line[x] === 1) return; assign[x] = 0; }
        for (let x = 0; x < n; x++) res[x] |= 1 << assign[x];
        found = true;
        return;
      }
      const len = clues[ci];
      const lastStart = n - minSpace[ci];
      for (let start = pos; start <= lastStart; start++) {
        if (start > pos && line[start - 1] === 1) break; // 跳过了必涂格，后面更不行
        let ok = true;
        for (let x = start; x < start + len; x++) if (line[x] === 0) { ok = false; break; }
        if (ok && start + len < n && line[start + len] === 1) ok = false;
        if (ok) {
          for (let x = pos; x < start; x++) assign[x] = 0;
          for (let x = start; x < start + len; x++) assign[x] = 1;
          if (start + len < n) assign[start + len] = 0;
          rec(ci + 1, start + len + 1);
        }
      }
    }
    rec(0, 0);
    return found ? res : null;
  }

  // 只用行列反复推理能否解出（= 人不用猜也能做）
  gen.nonogramSolvable = function (rowClues, colClues, size) {
    const grid = new Array(size * size).fill(-1);
    let changed = true;
    while (changed) {
      changed = false;
      for (let r = 0; r < size; r++) {
        const line = [];
        for (let c = 0; c < size; c++) line.push(grid[r * size + c]);
        const res = lineDeduce(rowClues[r], line);
        if (!res) return null;
        for (let c = 0; c < size; c++) {
          if (grid[r * size + c] === -1 && (res[c] === 1 || res[c] === 2)) {
            grid[r * size + c] = res[c] === 2 ? 1 : 0;
            changed = true;
          }
        }
      }
      for (let c = 0; c < size; c++) {
        const line = [];
        for (let r = 0; r < size; r++) line.push(grid[r * size + c]);
        const res = lineDeduce(colClues[c], line);
        if (!res) return null;
        for (let r = 0; r < size; r++) {
          if (grid[r * size + c] === -1 && (res[r] === 1 || res[r] === 2)) {
            grid[r * size + c] = res[r] === 2 ? 1 : 0;
            changed = true;
          }
        }
      }
    }
    return grid.every(v => v !== -1) ? grid : null;
  };

  gen.nonogram = function (size) {
    const density = size <= 5 ? 0.62 : 0.58;
    for (let attempt = 0; attempt < 500; attempt++) {
      const solution = [];
      for (let i = 0; i < size * size; i++) solution.push(Math.random() < density ? 1 : 0);
      const rowClues = [], colClues = [];
      for (let r = 0; r < size; r++) rowClues.push(lineClues(solution.slice(r * size, r * size + size)));
      for (let c = 0; c < size; c++) {
        const col = [];
        for (let r = 0; r < size; r++) col.push(solution[r * size + c]);
        colClues.push(lineClues(col));
      }
      const solved = gen.nonogramSolvable(rowClues, colClues, size);
      if (solved) return { size, rowClues, colClues, solution: solved };
    }
    return null; // 理论上不会走到；游戏层做兜底
  };

  // ================= 彩虹连线 Flow =================
  // 思路：先造一条铺满棋盘的哈密顿路径（蛇形+backbite 随机化），再切成若干段
  gen.flow = function (size) {
    const n = size * size;
    let path = [];
    for (let r = 0; r < size; r++) {
      const row = [];
      for (let c = 0; c < size; c++) row.push(r * size + c);
      if (r % 2 === 1) row.reverse();
      path.push(...row);
    }
    const nbs = i => {
      const r = Math.floor(i / size), c = i % size, out = [];
      if (r > 0) out.push(i - size);
      if (r < size - 1) out.push(i + size);
      if (c > 0) out.push(i - 1);
      if (c < size - 1) out.push(i + 1);
      return out;
    };
    // backbite 随机化
    for (let k = 0; k < n * 12; k++) {
      if (Math.random() < 0.5) path.reverse();
      const e = path[path.length - 1];
      const cand = nbs(e).filter(u => u !== path[path.length - 2]);
      if (!cand.length) continue;
      const u = cand[randInt(cand.length)];
      const i = path.indexOf(u);
      const head = path.slice(0, i + 1);
      const tail = path.slice(i + 1).reverse();
      path = head.concat(tail);
    }
    // 切段（每段 >= 3 格）
    const maxSeg = size + 2;
    const pairs = [];
    let pos = 0;
    while (pos < n) {
      let len = 3 + randInt(maxSeg - 2);
      if (n - pos - len < 3) len = n - pos; // 尾巴不够就并入最后一段
      pairs.push({ cells: path.slice(pos, pos + len) });
      pos += len;
    }
    return { size, pairs };
  };

  // ================= 皇后谜题 Queens =================
  // 规则：每行/每列/每个色区恰好一个皇后，且皇后之间不能对角线相邻
  function queensPlacement(n) {
    const sol = new Array(n).fill(-1);
    const used = new Array(n).fill(false);
    function bt(r) {
      if (r === n) return true;
      for (const c of shuffle([...Array(n).keys()])) {
        if (used[c]) continue;
        if (r > 0 && Math.abs(c - sol[r - 1]) === 1) continue;
        sol[r] = c; used[c] = true;
        if (bt(r + 1)) return true;
        sol[r] = -1; used[c] = false;
      }
      return false;
    }
    return bt(0) ? sol : null;
  }

  function queensCount(n, regions, limit) {
    const usedCol = new Array(n).fill(false);
    const usedReg = new Array(n).fill(false);
    let count = 0;
    const cols = new Array(n).fill(-1);
    function bt(r) {
      if (count >= limit) return;
      if (r === n) { count++; return; }
      for (let c = 0; c < n; c++) {
        if (usedCol[c]) continue;
        if (r > 0 && Math.abs(c - cols[r - 1]) === 1) continue;
        const reg = regions[r * n + c];
        if (usedReg[reg]) continue;
        usedCol[c] = true; usedReg[reg] = true; cols[r] = c;
        bt(r + 1);
        usedCol[c] = false; usedReg[reg] = false; cols[r] = -1;
        if (count >= limit) return;
      }
    }
    bt(0);
    return count;
  }

  // 收集全部解（最多 cap 个）
  function queensAll(n, regions, cap) {
    const usedCol = new Array(n).fill(false);
    const usedReg = new Array(n).fill(false);
    const cols = new Array(n).fill(-1);
    const sols = [];
    function bt(r) {
      if (sols.length >= cap) return;
      if (r === n) { sols.push(cols.slice()); return; }
      for (let c = 0; c < n; c++) {
        if (usedCol[c]) continue;
        if (r > 0 && Math.abs(c - cols[r - 1]) === 1) continue;
        const reg = regions[r * n + c];
        if (usedReg[reg]) continue;
        usedCol[c] = true; usedReg[reg] = true; cols[r] = c;
        bt(r + 1);
        usedCol[c] = false; usedReg[reg] = false;
        if (sols.length >= cap) return;
      }
    }
    bt(0);
    return sols;
  }

  // 从色区里拿走一格后，该色区是否仍然连通且非空
  function regionOkWithout(n, regions, idx) {
    const reg = regions[idx];
    const cells = [];
    for (let i = 0; i < n * n; i++) if (regions[i] === reg && i !== idx) cells.push(i);
    if (!cells.length) return false;
    const set = new Set(cells);
    const seen = new Set([cells[0]]);
    const q = [cells[0]];
    while (q.length) {
      const cur = q.pop();
      const c = cur % n;
      const nbs = [];
      if (cur >= n) nbs.push(cur - n);
      if (cur < n * n - n) nbs.push(cur + n);
      if (c > 0) nbs.push(cur - 1);
      if (c < n - 1) nbs.push(cur + 1);
      for (const nb of nbs) if (set.has(nb) && !seen.has(nb)) { seen.add(nb); q.push(nb); }
    }
    return seen.size === set.size;
  }

  // 修复法：把多余解占用的格子改到相邻色区，逐个消灭多余解
  // （目标解的皇后格永远不会被改动，所以目标解始终有效）
  function queensRepair(n, regions, sol) {
    for (let iter = 0; iter < 120; iter++) {
      const sols = queensAll(n, regions, 30);
      if (sols.length === 1) return true;
      const other = sols.find(s => !s.every((c, r) => c === sol[r]));
      if (!other) return false;
      const rows = shuffle([...Array(n).keys()]).filter(r => other[r] !== sol[r]);
      let changed = false;
      for (const r of rows) {
        const idx = r * n + other[r];
        if (!regionOkWithout(n, regions, idx)) continue;
        const reg = regions[idx], c = other[r];
        const nbRegs = [];
        if (r > 0 && regions[idx - n] !== reg) nbRegs.push(regions[idx - n]);
        if (r < n - 1 && regions[idx + n] !== reg) nbRegs.push(regions[idx + n]);
        if (c > 0 && regions[idx - 1] !== reg) nbRegs.push(regions[idx - 1]);
        if (c < n - 1 && regions[idx + 1] !== reg) nbRegs.push(regions[idx + 1]);
        if (!nbRegs.length) continue;
        regions[idx] = nbRegs[randInt(nbRegs.length)];
        changed = true;
        break;
      }
      if (!changed) return false;
    }
    return false;
  }

  gen.queens = function (n) {
    for (let attempt = 0; attempt < 80; attempt++) {
      const sol = queensPlacement(n);
      if (!sol) continue;
      // 以皇后为种子随机生长 n 个色区
      const regions = new Array(n * n).fill(-1);
      for (let r = 0; r < n; r++) regions[r * n + sol[r]] = r;
      let unassigned = n * n - n;
      let guard = n * n * 60;
      while (unassigned > 0 && guard-- > 0) {
        const i = randInt(n * n);
        if (regions[i] !== -1) continue;
        const r = Math.floor(i / n), c = i % n;
        const nb = [];
        if (r > 0 && regions[i - n] !== -1) nb.push(regions[i - n]);
        if (r < n - 1 && regions[i + n] !== -1) nb.push(regions[i + n]);
        if (c > 0 && regions[i - 1] !== -1) nb.push(regions[i - 1]);
        if (c < n - 1 && regions[i + 1] !== -1) nb.push(regions[i + 1]);
        if (!nb.length) continue;
        regions[i] = nb[randInt(nb.length)];
        unassigned--;
      }
      if (unassigned > 0) continue;
      if (queensRepair(n, regions, sol)) {
        return { n, regions, solution: sol };
      }
    }
    return null;
  };
  gen.queensCount = queensCount;

  // ================= 迷宫 =================
  // walls 位掩码: 1上 2右 4下 8左；DFS 挖墙保证连通且路径唯一
  gen.maze = function (w, h) {
    const walls = new Array(w * h).fill(15);
    const seen = new Array(w * h).fill(false);
    const stack = [0];
    seen[0] = true;
    const DIRS = [
      { bit: 1, dx: 0, dy: -1, opp: 4 },
      { bit: 2, dx: 1, dy: 0, opp: 8 },
      { bit: 4, dx: 0, dy: 1, opp: 1 },
      { bit: 8, dx: -1, dy: 0, opp: 2 },
    ];
    while (stack.length) {
      const cur = stack[stack.length - 1];
      const x = cur % w, y = Math.floor(cur / w);
      const options = shuffle(DIRS.filter(d => {
        const nx = x + d.dx, ny = y + d.dy;
        return nx >= 0 && nx < w && ny >= 0 && ny < h && !seen[ny * w + nx];
      }));
      if (!options.length) { stack.pop(); continue; }
      const d = options[0];
      const nxt = (y + d.dy) * w + (x + d.dx);
      walls[cur] &= ~d.bit;
      walls[nxt] &= ~d.opp;
      seen[nxt] = true;
      stack.push(nxt);
    }
    return { w, h, walls, start: 0, end: w * h - 1 };
  };

  // ================= 数字华容道 =================
  // 生成有解的打乱局面（0 = 空格）
  function slideSolvable(tiles, n) {
    let inv = 0;
    const seq = tiles.filter(v => v !== 0);
    for (let i = 0; i < seq.length; i++)
      for (let j = i + 1; j < seq.length; j++)
        if (seq[i] > seq[j]) inv++;
    if (n % 2 === 1) return inv % 2 === 0;
    const blankRowFromBottom = n - Math.floor(tiles.indexOf(0) / n);
    return (inv + blankRowFromBottom) % 2 === 1;
  }

  gen.slide = function (n) {
    const solved = [...Array(n * n - 1).keys()].map(v => v + 1).concat([0]);
    let tiles;
    do {
      tiles = shuffle(solved);
      if (!slideSolvable(tiles, n)) {
        // 交换两个非空格数字，翻转奇偶性变为有解
        const a = tiles.findIndex(v => v !== 0);
        let b = a + 1;
        while (tiles[b] === 0) b++;
        [tiles[a], tiles[b]] = [tiles[b], tiles[a]];
      }
    } while (tiles.every((v, i) => v === solved[i]));
    return tiles;
  };
  gen.slideSolvable = slideSolvable;

  Object.assign(NS.gen, gen);
})(typeof BrainGym !== 'undefined' ? BrainGym : (module.exports = { gen: {} }));
