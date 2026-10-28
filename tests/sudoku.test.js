const {test} = require('node:test');
const assert = require('node:assert/strict');
const S = require('../miniprogram/utils/sudoku');
for (const n of [4,6,9]) for (const d of S.DIFFICULTIES) {
  test(`${n}x${n} ${d.id}: valid grid, unique solution and meaningful blanks across 15 seeds`,()=>{
    const signatures = new Set();
    for(let seed=1;seed<=15;seed++){
      const g=S.generate(n,d.id,seed*997);
      assert(S.isSolved(g.solution,n));
      assert.equal(S.countSolutions(g.puzzle,n),1);
      assert(g.puzzle.some(v=>!v));
      assert(g.puzzle.filter(v=>!v).length>=Math.floor(n*n*.25));
      g.puzzle.forEach((v,i)=>{if(v)assert.equal(v,g.solution[i]);});
      if(d.id==='easy')assert(S.solvableBySingles(g.puzzle,n));
      signatures.add(g.puzzle.join(','));
    }
    assert(signatures.size>=12);
  });
}
test('daily seed is deterministic, difficulty affects number of clues',()=>{
  const seed=S.hash('little-sudoku-daily-v1:2026-10-27');
  assert.deepEqual(S.generate(6,'easy',seed),S.generate(6,'easy',seed));
  for(const n of [4,6,9]){
    const easy=S.generate(n,'easy',99), hard=S.generate(n,'hard',99);
    assert(easy.puzzle.filter(Boolean).length>=hard.puzzle.filter(Boolean).length);
  }
});
test('rectangular 6x6 boxes, conflicts and candidates obey rules',()=>{
  const b=Array(36).fill(0);b[0]=1;
  assert(!S.candidates(b,8,6).includes(1)); // row 2 col 3: same 2x3 box
  assert(S.candidates(b,15,6).includes(1)); // row 3 col 4: independent
  b[8]=1;assert(S.conflicts(b,6)[0]);assert(S.conflicts(b,6)[8]);
  assert.equal(S.countSolutions(b,6),0);
  assert(!S.isSolved(Array(16).fill(1),4));
});
test('logical hints repeatedly lead to the known solution',()=>{
  for(const n of [4,6,9]){
    const g=S.generate(n,'easy',258), board=g.puzzle.slice();let h;
    while((h=S.logicalHint(board,n))){assert.equal(h.value,g.solution[h.index]);board[h.index]=h.value;}
    assert(S.isSolved(board,n));
  }
});
