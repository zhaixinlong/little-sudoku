/* Pure Sudoku engine. Rectangular boxes: 4=2×2, 6=2×3, 9=3×3. */
const CONFIG = {
  4: { size: 4, boxRows: 2, boxCols: 2, title: '四宫启蒙', short: '四宫', icon: '🌱', age: '建议 4 岁起 · 亲子一起玩', description: '从 1—4 开始，发现小小规律', color: 'green' },
  6: { size: 6, boxRows: 2, boxCols: 3, title: '六宫探索', short: '六宫', icon: '⛵', age: '建议 6 岁起 · 多一点发现', description: '遇见 1—6，向新世界出发', color: 'blue' },
  9: { size: 9, boxRows: 3, boxCols: 3, title: '九宫挑战', short: '九宫', icon: '🚀', age: '建议 8 岁起 · 耐心小高手', description: '挑战 1—9，让思考再长大', color: 'orange' }
};
const DIFFICULTIES = [
  { id: 'easy', name: '轻松', detail: '线索多一点', ratio: .38 },
  { id: 'normal', name: '进阶', detail: '多想一小步', ratio: .52 },
  { id: 'hard', name: '挑战', detail: '耐心找规律', ratio: .65 }
];
function random(seed) { let x = seed >>> 0; return () => { x += 0x6D2B79F5; let t = x; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash(text) { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return h >>> 0; }
function shuffle(a, rng) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
function peers(index, size) {
  const c = CONFIG[size], row = Math.floor(index / size), col = index % size, result = [];
  for (let i = 0; i < size * size; i++) {
    const r = Math.floor(i / size), k = i % size;
    if (i !== index && (r === row || k === col || (Math.floor(r / c.boxRows) === Math.floor(row / c.boxRows) && Math.floor(k / c.boxCols) === Math.floor(col / c.boxCols)))) result.push(i);
  }
  return result;
}
const peerCache = {};
function getPeers(i, n) { const key = n + ':' + i; return peerCache[key] || (peerCache[key] = peers(i, n)); }
function candidates(board, i, n) { if (board[i]) return []; const used = getPeers(i, n).map(p => board[p]); return Array.from({length:n}, (_, k) => k + 1).filter(v => used.indexOf(v) < 0); }
function conflicts(board, n) { return board.map((v, i) => !!v && getPeers(i, n).some(p => board[p] === v)); }
function countSolutions(input, n, limit = 2) {
  if (input.length !== n * n || input.some(v => !Number.isInteger(v) || v < 0 || v > n) || conflicts(input, n).some(Boolean)) return 0;
  const board = input.slice(); let count = 0;
  function search() {
    if (count >= limit) return;
    let index = -1, options = [];
    for (let i = 0; i < board.length; i++) if (!board[i]) {
      const c = candidates(board, i, n); if (!c.length) return;
      if (index < 0 || c.length < options.length) { index = i; options = c; }
      if (c.length === 1) break;
    }
    if (index < 0) { count++; return; }
    for (const v of options) { board[index] = v; search(); if (count >= limit) break; }
    board[index] = 0;
  }
  search(); return count;
}
function units(n) {
  const {boxRows:br, boxCols:bc} = CONFIG[n], list = [];
  for (let r = 0; r < n; r++) list.push({type:'行', cells:Array.from({length:n}, (_, c) => r*n+c)});
  for (let c = 0; c < n; c++) list.push({type:'列', cells:Array.from({length:n}, (_, r) => r*n+c)});
  for (let r = 0; r < n; r += br) for (let c = 0; c < n; c += bc) {
    const cells = []; for (let a = 0; a < br; a++) for (let b = 0; b < bc; b++) cells.push((r+a)*n+c+b);
    list.push({type:'宫', cells});
  }
  return list;
}
function logicalHint(board, n) {
  const opts = board.map((_, i) => candidates(board, i, n));
  for (let i = 0; i < board.length; i++) if (!board[i] && opts[i].length === 1) return {index:i, value:opts[i][0], reason:'看看它所在的行、列和粗线小宫，其他数字都已经出现过了，这里只剩下一种选择。'};
  for (const unit of units(n)) for (let v = 1; v <= n; v++) {
    if (unit.cells.some(i => board[i] === v)) continue;
    const places = unit.cells.filter(i => !board[i] && opts[i].indexOf(v) >= 0);
    if (places.length === 1) return {index:places[0], value:v, reason:'在这一' + unit.type + '里，其他空格都不能放这个数字，只有这里能放。'};
  }
  return null;
}
function solvableBySingles(input, n) { const b = input.slice(); let h; while ((h = logicalHint(b, n))) b[h.index] = h.value; return b.every(Boolean); }
function generate(n, difficulty = 'easy', seed = Date.now()) {
  if (!CONFIG[n]) throw new Error('Unsupported size');
  const cfg = CONFIG[n], rng = random(seed), nums = shuffle(Array.from({length:n}, (_, i) => i + 1), rng);
  const order = (width) => shuffle(Array.from({length:n/width}, (_, i) => i), rng).reduce((a, g) => a.concat(shuffle(Array.from({length:width}, (_, i) => g*width+i), rng)), []);
  const rows = order(cfg.boxRows), cols = order(cfg.boxCols);
  const solution = rows.reduce((a, r) => a.concat(cols.map(c => nums[(cfg.boxCols*(r%cfg.boxRows)+Math.floor(r/cfg.boxRows)+c)%n])), []);
  const puzzle = solution.slice(), diff = DIFFICULTIES.find(d => d.id === difficulty) || DIFFICULTIES[0];
  const target = Math.floor(n*n*diff.ratio); let removed = 0;
  for (const i of shuffle(Array.from({length:n*n}, (_, k) => k), rng)) {
    if (removed >= target) break;
    const old = puzzle[i]; puzzle[i] = 0;
    if (countSolutions(puzzle, n) !== 1 || (difficulty === 'easy' && !solvableBySingles(puzzle, n))) puzzle[i] = old;
    else removed++;
  }
  return {puzzle, solution, size:n, difficulty, seed};
}
function isSolved(board, n) { return board.length === n*n && board.every(v => Number.isInteger(v) && v >= 1 && v <= n) && !conflicts(board,n).some(Boolean); }
module.exports = {CONFIG, DIFFICULTIES, random, hash, generate, getPeers, candidates, conflicts, countSolutions, logicalHint, solvableBySingles, isSolved};
