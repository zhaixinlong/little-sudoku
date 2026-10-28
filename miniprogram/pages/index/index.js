const S = require('../../utils/sudoku');
const Store = require('../../utils/storage');
const FRUITS = ['🍎','🍋','🍇','🥝','🍊','🫐','🍓','🍑','🍒'];
const FRUIT_NAMES = ['苹果','柠檬','葡萄','猕猴桃','橙子','蓝莓','草莓','桃子','樱桃'];
const LESSONS = [
  {title:'先看横着的一行', text:'每行放齐 1—4，每个只能出现一次。亮起来的这一行缺少谁？', index:3, value:4, mode:'row'},
  {title:'再看竖着的一列', text:'每列也要放齐 1—4。顺着亮起来的这一列，从上往下找一找。', index:13, value:3, mode:'col'},
  {title:'最后看看粗线小宫', text:'每个粗线小宫里，也要放齐 1—4。亮起来的小宫还缺谁？', index:10, value:4, mode:'box'}
];
Page({
  data: {
    view:'home', modes:Object.keys(S.CONFIG).map(k => S.CONFIG[k]), difficulties:S.DIFFICULTIES,
    size:4, difficulty:'easy', settings:{}, stats:{total:0, stars:0, bySize:{}, streak:0},
    hasSession:false, tutorialDone:false, cells:[], keys:[], selected:-1, noteMode:false, hint:null,
    message:'先选一个空格，再选下方的图案。', elapsed:'00:00', progress:0, completed:false,
    lessonIndex:0, lesson:LESSONS[0], lessonDone:false, lessonMessage:'点一下你认为正确的答案。',
    plants:[], storageWarning:false, busy:false
  },
  onLoad() { this.refreshHome(); },
  onShow() { if (this.data.view === 'game' && this.session && !this.session.completed) this.startClock(); },
  onHide() { this.stopClock(); this.persist(); },
  onUnload() { this.stopClock(); this.persist(); },
  onShareAppMessage() { return {title:'和我一起，在小芽数独里发现规律 🌱', path:'/pages/index/index'}; },
  refreshHome() {
    const data = Store.load(), today = Store.dateKey();
    const thresholds = [0,5,15,30,60,100];
    const icons = ['🌱','🌷','🌻','🌳','🍎','🏡'];
    const names = ['第一颗小芽','春日郁金香','微笑向日葵','大大的树','丰收苹果树','思考小花园'];
    this.setData({settings:data.settings, stats:data.stats, hasSession:!!(data.session && !data.session.completed), tutorialDone:data.tutorialDone,
      dailyDone:data.stats.daily.indexOf(today)>=0, today, streak:data.stats.lastDay===today || data.stats.lastDay===Store.yesterday(today) ? data.stats.streak : 0,
      plants:thresholds.map((v,i) => ({icon:icons[i],name:names[i],need:v,unlocked:data.stats.stars>=v})),
      nextPlant: thresholds.find(v => v > data.stats.stars) || 0});
  },
  goHome() { this.stopClock(); this.persist(); this.setData({view:'home', hint:null}); this.refreshHome(); wx.setNavigationBarTitle({title:'小芽数独 · 慢慢想，真有趣'}); },
  openLearn() { this.stopClock(); this.persist(); this.setData({view:'learn'}); this.prepareLesson(0); },
  openGarden() { this.stopClock(); this.persist(); this.refreshHome(); this.setData({view:'garden'}); },
  openSettings() { this.stopClock(); this.persist(); this.setData({view:'settings'}); },
  chooseSize(e) { this.setData({size:Number(e.currentTarget.dataset.size)}); },
  chooseDifficulty(e) { this.setData({difficulty:e.currentTarget.dataset.id}); },
  begin() { this.requestGame(false); },
  daily() { this.requestGame(true); },
  requestGame(daily) {
    if (this.data.busy) return;
    const old = Store.load().session;
    if (old && !old.completed) {
      wx.showModal({title:'开始一局新的探险？', content:'当前这一局的进度会被替换。也可以回首页选择“继续上次”。', confirmText:'开始新局', cancelText:'保留进度', success:r => { if(r.confirm) this.newGame(daily); }});
    } else this.newGame(daily);
  },
  newGame(daily) {
    if (this.data.busy) return;
    this.stopClock(); this.setData({busy:true}); wx.showLoading({title:'种下一道新题…', mask:true});
    setTimeout(() => {
      try {
        const data = Store.load(), day = Store.dateKey(), size = daily ? 6 : this.data.size;
        const difficulty = daily ? 'easy' : this.data.difficulty;
        const serial = ++data.serial, seed = daily ? S.hash('little-sudoku-daily-v1:'+day) : S.hash(Date.now()+':'+serial+':'+Math.random());
        const puzzle = S.generate(size,difficulty,seed);
        this.session = Object.assign(puzzle, {id:daily?'daily:'+day:'free:'+serial, daily, day, board:puzzle.puzzle.slice(), notes:Array.from({length:size*size},()=>[]), elapsed:0,hints:0,mistakes:0,completed:false,history:[]});
        this.showGame(); this.persist();
      } catch(e) { wx.showToast({title:'这颗种子没发芽，请再试一次', icon:'none'}); }
      finally { wx.hideLoading(); this.setData({busy:false}); }
    }, 40);
  },
  resume() {
    const session = Store.load().session;
    const n = session && session.size;
    if (!session || !S.CONFIG[n] || !Array.isArray(session.board) || session.board.length !== n*n ||
      !Array.isArray(session.puzzle) || session.puzzle.length !== n*n || !Array.isArray(session.solution) || !S.isSolved(session.solution,n) ||
      session.board.some(v=>!Number.isInteger(v)||v<0||v>n) || session.puzzle.some((v,i)=>v && (v!==session.solution[i] || v!==session.board[i]))) {
      wx.showToast({title:'存档无法读取，请开始新的一局',icon:'none'}); return;
    }
    this.session = session;
    if (!Array.isArray(session.history)) session.history = [];
    if (!Array.isArray(session.notes) || session.notes.length !== n*n) session.notes = Array.from({length:n*n},()=>[]);
    this.showGame();
  },
  showGame() {
    const s = this.session;
    this.checkedErrors = [];
    this.setData({view:'game',size:s.size,difficulty:s.difficulty,selected:-1,noteMode:false,hint:null,completed:s.completed,
      gameTitle:s.daily?'每日小探险':S.CONFIG[s.size].title, difficultyName:S.DIFFICULTIES.find(d=>d.id===s.difficulty).name,
      message:'先选一个空格，再选下方的图案。', elapsed:this.formatTime(s.elapsed), earned:s.earned||0});
    wx.setNavigationBarTitle({title:s.daily?'每日小探险 · '+s.day:S.CONFIG[s.size].title});
    this.renderBoard(); if (!s.completed) this.startClock();
  },
  formatTime(t) { return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0'); },
  startClock() {
    this.stopClock(); this.startedAt = Date.now();
    this.timer = setInterval(() => { this.syncClock(); if (this.session) { this.setData({elapsed:this.formatTime(this.session.elapsed)}); if (this.session.elapsed%15===0) this.persist(); } },1000);
  },
  syncClock() {
    if (!this.startedAt || !this.session) return;
    const delta = Math.floor((Date.now()-this.startedAt)/1000);
    this.session.elapsed += delta; this.startedAt += delta*1000;
  },
  stopClock() { this.syncClock(); if(this.timer) clearInterval(this.timer); this.timer=null; this.startedAt=null; },
  persist() {
    if(!this.session) return;
    Store.load().session=this.session;
    const ok=Store.save(); if(!ok) this.setData({storageWarning:true});
  },
  label(value) { return this.data.settings.symbols==='fruit' ? FRUITS[value-1] : String(value); },
  renderBoard() {
    const s=this.session, n=s.size, cfg=S.CONFIG[n], selected=this.data.selected;
    const flags=this.data.settings.assist?S.conflicts(s.board,n):s.board.map(()=>false);
    const related=selected>=0?S.getPeers(selected,n):[], value=s.board[selected];
    const cells=s.board.map((v,i)=>({index:i, row:Math.floor(i/n), col:i%n, value:v, label:v?this.label(v):'', fixed:!!s.puzzle[i],
      selected:i===selected, related:related.indexOf(i)>=0, same:!!v && v===value, conflict:flags[i] || (this.checkedErrors||[]).indexOf(i)>=0,
      right:(i%n+1)%cfg.boxCols===0 && i%n!==n-1, bottom:(Math.floor(i/n)+1)%cfg.boxRows===0 && Math.floor(i/n)!==n-1,
      notes:(s.notes[i]||[]).map(k=>({value:k,label:this.label(k)}))}));
    const empty=s.board.filter(v=>!v).length;
    this.setData({cells,keys:Array.from({length:n},(_,i)=>({value:i+1,label:this.label(i+1),name:FRUIT_NAMES[i],used:s.board.filter(v=>v===i+1).length===n})),
      progress:Math.round((n*n-empty)/(n*n)*100),empty,hints:s.hints, mistakes:s.mistakes});
  },
  selectCell(e) {
    if(this.session.completed || this.data.hint) return;
    const i=Number(e.currentTarget.dataset.index); this.checkedErrors=[];
    this.setData({selected:i,message:this.session.puzzle[i]?'这是已给出的线索，找一个空格试试吧。': '第 '+(Math.floor(i/this.session.size)+1)+' 行，第 '+(i%this.session.size+1)+' 列 · 看看周围缺少谁？'}); this.renderBoard();
  },
  remember() { const s=this.session; s.history.push({board:s.board.slice(),notes:s.notes.map(a=>a.slice())}); if(s.history.length>100)s.history.shift(); },
  enter(e) {
    const s=this.session, i=this.data.selected, v=Number(e.currentTarget.dataset.value);
    if(s.completed || this.data.hint) return;
    if(i<0 || s.puzzle[i]) { this.setData({message:'先点一个可以填写的空格哦。'}); return; }
    this.checkedErrors=[];
    if(this.data.noteMode) {
      if(s.board[i]) { this.setData({message:'先擦除这个格子的答案，就可以写小笔记。'}); return; }
      this.remember(); const a=s.notes[i], at=a.indexOf(v); if(at>=0)a.splice(at,1); else a.push(v); a.sort();
      this.setData({message:'小笔记只是你的猜想，再点一次可以取消。'});
    } else {
      if(s.board[i]===v)return;
      this.remember(); s.board[i]=v; s.notes[i]=[];
      S.getPeers(i,s.size).forEach(p=>{s.notes[p]=s.notes[p].filter(k=>k!==v);});
      const conflict=S.getPeers(i,s.size).some(p=>s.board[p]===v);
      this.setData({message:conflict && this.data.settings.assist?'这一行、列或小宫里有重复，换一个再试试。':'很棒的一次思考！继续观察下一格吧。'});
      if(this.data.settings.vibration) wx.vibrateShort({type:'light'});
    }
    this.renderBoard(); this.persist(); this.maybeComplete();
  },
  erase() {
    const s=this.session,i=this.data.selected;
    if(s.completed || this.data.hint || i<0 || s.puzzle[i] || (!s.board[i] && !s.notes[i].length))return;
    this.remember();s.board[i]=0;s.notes[i]=[];this.checkedErrors=[];this.renderBoard();this.persist();
  },
  undo() {
    const s=this.session;if(s.completed || this.data.hint)return;
    const prev=s.history.pop();if(!prev){this.setData({message:'还没有可以撤回的一步。'});return;}
    s.board=prev.board;s.notes=prev.notes;this.checkedErrors=[];this.setData({message:'回到上一步，慢慢想就好。'});this.renderBoard();this.persist();
  },
  toggleNote() { if(!this.session.completed && !this.data.hint)this.setData({noteMode:!this.data.noteMode}); },
  check() {
    const s=this.session;if(s.completed || this.data.hint)return;
    const errors=[];s.board.forEach((v,i)=>{if(v && v!==s.solution[i])errors.push(i);});
    this.checkedErrors=errors;
    if(errors.length){s.mistakes++;this.setData({message:'有 '+errors.length+' 个格子需要再想想，已用珊瑚色圈出。试错也是学习。'});}
    else this.setData({message:s.board.some(v=>!v)?'目前填入的答案都对啦，继续寻找下一格！':'全部正确！'});
    this.renderBoard();this.persist();this.maybeComplete();
  },
  hint() {
    const s=this.session;if(s.completed || this.data.hint)return;
    const wrong=s.board.findIndex((v,i)=>v && v!==s.solution[i]);
    if(wrong>=0){this.setData({selected:wrong,message:'先看看这一格。它会影响后面的推理，擦掉后再观察行、列和小宫。'});this.checkedErrors=[wrong];this.renderBoard();return;}
    let hint=S.logicalHint(s.board,s.size);
    if(!hint){const i=s.board.findIndex(v=>!v);if(i<0)return;hint={index:i,value:s.solution[i],reason:'这一步还需要更深入的推理。小芽可以直接送你这个答案，再从它周围寻找新的线索。'};}
    this.setData({selected:hint.index,noteMode:false,hint:Object.assign(hint,{label:this.label(hint.value),position:'第 '+(Math.floor(hint.index/s.size)+1)+' 行，第 '+(hint.index%s.size+1)+' 列'})});this.renderBoard();
  },
  cancelHint(){this.setData({hint:null});},
  applyHint(){
    const s=this.session,h=this.data.hint;if(!h || s.completed)return;
    this.remember();s.board[h.index]=h.value;s.notes[h.index]=[];S.getPeers(h.index,s.size).forEach(p=>{s.notes[p]=s.notes[p].filter(v=>v!==h.value);});s.hints++;
    this.setData({hint:null,message:'找到一个新线索啦！试着自己找下一格。'});this.renderBoard();this.persist();this.maybeComplete();
  },
  maybeComplete(){
    const s=this.session;if(s.completed || !S.isSolved(s.board,s.size))return;
    this.stopClock();const earned=Store.complete(s);this.checkedErrors=[];
    this.setData({completed:true,earned,elapsed:this.formatTime(s.elapsed),message:'每一次认真思考，都在让小芽长大。'});this.renderBoard();this.persist();
  },
  nextGame(){this.newGame(false);},
  prepareLesson(index){
    const lesson=LESSONS[index], board=[1,2,3,4,3,4,1,2,2,1,4,3,4,3,2,1];board[lesson.index]=0;
    const row=Math.floor(lesson.index/4),col=lesson.index%4;
    this.setData({lessonIndex:index,lesson,lessonDone:false,lessonMessage:'点一下你认为正确的答案。',lessonKeys:[1,2,3,4].map(v=>({value:v,label:this.label(v)})),
      lessonCells:board.map((v,i)=>({index:i,label:v?this.label(v):'?',target:i===lesson.index,
        highlight:lesson.mode==='row'?Math.floor(i/4)===row:lesson.mode==='col'?i%4===col:Math.floor(i/8)===Math.floor(row/2) && Math.floor(i%4/2)===Math.floor(col/2),
        right:i%4===1,bottom:Math.floor(i/4)===1}))});
  },
  lessonAnswer(e){
    if(this.data.lessonDone)return;
    const v=Number(e.currentTarget.dataset.value),correct=v===this.data.lesson.value;
    if(!correct){this.setData({lessonMessage:'再找找，亮起来的区域里已经有这个朋友啦。'});return;}
    const cells=this.data.lessonCells.slice();cells[this.data.lesson.index].label=this.label(v);
    this.setData({lessonCells:cells,lessonDone:true,lessonMessage:'答对啦！每个朋友都找到了自己的位置。'});
  },
  nextLesson(){
    if(!this.data.lessonDone)return;
    if(this.data.lessonIndex<2)this.prepareLesson(this.data.lessonIndex+1);
    else {Store.load().tutorialDone=true;Store.save();this.setData({tutorialDone:true});this.goHome();wx.showToast({title:'可以开始四宫探险啦',icon:'none'});}
  },
  setSymbols(e){const value=e.currentTarget.dataset.value;Store.load().settings.symbols=value;Store.save();this.refreshHome();},
  toggleSetting(e){const key=e.currentTarget.dataset.key;if(['assist','vibration'].indexOf(key)<0)return;Store.load().settings[key]=e.detail.value;Store.save();this.refreshHome();},
  resetProgress(){wx.showModal({title:'清除这个设备的记录？',content:'将删除存档、星星、花园和设置，无法恢复。请由家长操作。',confirmText:'清除记录',confirmColor:'#bd5e49',success:r=>{if(r.confirm){const data=Store.load();Object.keys(data).forEach(k=>delete data[k]);Object.assign(data,Store.defaults());Store.save();this.session=null;this.goHome();}}});}
});
