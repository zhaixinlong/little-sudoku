const KEY = 'little-sudoku-v1';
const defaults = () => ({version:1, settings:{symbols:'fruit', assist:true, vibration:false}, tutorialDone:false, serial:0, stats:{total:0, stars:0, bySize:{4:0,6:0,9:0}, daily:[], streak:0, lastDay:''}, session:null});
let memory;
function load() {
  if (memory) return memory;
  const base = defaults();
  try {
    const saved = wx.getStorageSync(KEY);
    if (saved && saved.version === 1) {
      memory = Object.assign(base, saved);
      memory.settings = Object.assign(defaults().settings, saved.settings || {});
      memory.stats = Object.assign(defaults().stats, saved.stats || {});
      memory.stats.bySize = Object.assign({4:0,6:0,9:0}, memory.stats.bySize);
      if (!Array.isArray(memory.stats.daily)) memory.stats.daily = [];
    }
  } catch (e) { /* first launch or unavailable storage */ }
  return memory || (memory = base);
}
function save() {
  try { wx.setStorageSync(KEY, load()); return true; }
  catch (e) { return false; }
}
function dateKey(date = new Date()) { return date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0'); }
function yesterday(day) { const p = day.split('-').map(Number), d = new Date(p[0],p[1]-1,p[2],12); d.setDate(d.getDate()-1); return dateKey(d); }
function complete(session) {
  const data = load(), stats = data.stats;
  if (session.completed) return session.earned || 0;
  const repeatDaily = session.daily && stats.daily.indexOf(session.day) >= 0;
  const stars = repeatDaily ? 0 : Math.max(1, 3 - (session.hints > 0 ? 1 : 0) - (session.mistakes > 0 ? 1 : 0));
  session.completed = true; session.earned = stars;
  if (!repeatDaily) {
    stats.total++; stats.stars += stars; stats.bySize[session.size]++;
    const today = dateKey();
    if (stats.lastDay !== today) { stats.streak = stats.lastDay === yesterday(today) ? stats.streak + 1 : 1; stats.lastDay = today; }
    if (session.daily) stats.daily.push(session.day);
  }
  data.session = session; save(); return stars;
}
module.exports = {load, save, dateKey, yesterday, complete, defaults};
