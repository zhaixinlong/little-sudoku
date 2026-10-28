const {test,beforeEach,afterEach} = require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
let page, Store, S, disk, modalConfirm=true;
function event(dataset){return {currentTarget:{dataset}};}
beforeEach(()=>{
  disk={};
  global.wx={getStorageSync:k=>disk[k],setStorageSync:(k,v)=>{disk[k]=JSON.parse(JSON.stringify(v));},setNavigationBarTitle:()=>{},showToast:()=>{},showLoading:()=>{},hideLoading:()=>{},vibrateShort:()=>{},showModal:o=>o.success({confirm:modalConfirm})};
  for(const f of ['storage','sudoku'])delete require.cache[require.resolve('../miniprogram/utils/'+f)];
  delete require.cache[require.resolve('../miniprogram/pages/index/index')];
  global.Page=config=>{page=Object.assign({},config,{data:JSON.parse(JSON.stringify(config.data)),setData(update){Object.assign(this.data,update);}});};
  require('../miniprogram/pages/index/index');Store=require('../miniprogram/utils/storage');S=require('../miniprogram/utils/sudoku');page.onLoad();
});
afterEach(()=>{page.stopClock();modalConfirm=true;});
function game(n=4){const g=S.generate(n,'easy',42);page.session=Object.assign(g,{board:g.puzzle.slice(),notes:Array.from({length:n*n},()=>[]),history:[],elapsed:0,hints:0,mistakes:0,completed:false,daily:false,day:Store.dateKey()});page.showGame();return page.session;}
test('interactive tutorial has three correct answers, rejects wrong answer, preserves active save',()=>{
  const s=game();page.persist();page.openLearn();
  for(let i=0;i<3;i++){assert.equal(page.data.lessonIndex,i);page.lessonAnswer(event({value:page.data.lesson.value===1?2:1}));assert(!page.data.lessonDone);page.lessonAnswer(event({value:page.data.lesson.value}));assert(page.data.lessonDone);page.nextLesson();}
  assert(Store.load().tutorialDone);assert.equal(Store.load().session,s);assert.equal(page.data.view,'home');
});
test('input respects clues, supports notes, erase, undo and persistence',()=>{
  const s=game(6),i=s.puzzle.indexOf(0),fixed=s.puzzle.findIndex(Boolean);
  page.selectCell(event({index:fixed}));page.enter(event({value:1}));assert.equal(s.board[fixed],s.puzzle[fixed]);
  page.selectCell(event({index:i}));page.toggleNote();page.enter(event({value:3}));assert.deepEqual(s.notes[i],[3]);assert.equal(s.board[i],0);
  page.toggleNote();page.enter(event({value:s.solution[i]}));assert.equal(s.board[i],s.solution[i]);assert.deepEqual(s.notes[i],[]);
  page.undo();assert.equal(s.board[i],0);assert.deepEqual(s.notes[i],[3]);page.erase();assert.deepEqual(s.notes[i],[]);page.undo();assert.deepEqual(s.notes[i],[3]);
  assert(disk['little-sudoku-v1'].session);page.goHome();page.resume();assert.equal(page.data.view,'game');assert.equal(page.session.board[i],0);
});
test('completion awards stars once; hint undo cannot reset hint cost',()=>{
  const s=game();page.hint();assert(page.data.hint);page.applyHint();assert.equal(s.hints,1);page.undo();assert.equal(s.hints,1);
  s.board=s.solution.slice();page.maybeComplete();assert(page.data.completed);assert.equal(Store.load().stats.total,1);assert.equal(Store.load().stats.stars,2);
  page.maybeComplete();Store.complete(s);assert.equal(Store.load().stats.stars,2);
  const previous=s.board.slice();page.enter(event({value:1}));page.erase();page.undo();assert.deepEqual(s.board,previous);
});
test('daily duplicate completion does not farm stars',()=>{
  const s=game(6);s.daily=true;s.board=s.solution.slice();page.maybeComplete();assert.equal(Store.load().stats.stars,3);
  const repeat=Object.assign({},s,{completed:false,earned:0});assert.equal(Store.complete(repeat),0);assert.equal(Store.load().stats.total,1);
});
test('mistake check highlights incorrect cells, without automatic penalty for experimenting',()=>{
  const s=game();const i=s.puzzle.indexOf(0);page.selectCell(event({index:i}));page.enter(event({value:s.solution[i]%4+1}));assert.equal(s.mistakes,0);
  page.check();assert.equal(s.mistakes,1);assert(page.data.cells[i].conflict);page.hint();assert.equal(page.data.selected,i);assert.equal(page.data.hint,null);
});
test('day arithmetic crosses months and years, streak reflects actual consecutive days',()=>{
  assert.equal(Store.yesterday('2026-01-01'),'2025-12-31');assert.equal(Store.yesterday('2024-03-01'),'2024-02-29');
  const stats=Store.load().stats;stats.lastDay=Store.yesterday(Store.dateKey());stats.streak=4;
  const s=game();s.board=s.solution.slice();page.maybeComplete();assert.equal(stats.streak,5);
});
test('new games are generated, saved and previous save replacement requires confirmation',async()=>{
  game();page.persist();modalConfirm=false;page.requestGame(false);assert(!page.data.busy);
  modalConfirm=true;page.requestGame(false);assert(page.data.busy);await new Promise(r=>setTimeout(r,150));assert(!page.data.busy);assert(page.session.id.startsWith('free:'));assert(disk['little-sudoku-v1'].session);
});
test('storage errors are visible; malformed saved boards are rejected',()=>{
  game();wx.setStorageSync=()=>{throw new Error('full');};page.persist();assert(page.data.storageWarning);
  Store.load().session.board=[1];page.goHome();page.resume();assert.equal(page.data.view,'home');
});
