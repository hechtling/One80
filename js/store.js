/* One80 – zentrale Datenhaltung (localStorage) */
const Store = (() => {
  const KEY = 'one80.state.v1';

  const defaults = () => ({
    settings: {
      theme: 'dark', lang: 'de', caller: true, sfx: true, vibrate: true,
      input: 'board',
      x01: { start: 501, out: 'double', din: false, legs: 3, sets: 1 }
    },
    profiles: [],
    matches: [],       // Match-Historie (Zusammenfassungen)
    friends: [],       // importierte Freunde-Snapshots
    tournaments: [],
    active: null       // laufendes Spiel (Resume)
  });

  let state;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? Object.assign(defaults(), JSON.parse(raw)) : defaults();
    state.settings = Object.assign(defaults().settings, state.settings || {});
  } catch (e) { state = defaults(); }

  let timer = null;
  function save() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('save failed', e); }
    }, 120);
  }
  function saveNow() {
    clearTimeout(timer);
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  function emptyAgg() {
    return {
      matches: 0, wins: 0, legs: 0, legsWon: 0,
      darts: 0, points: 0, f9darts: 0, f9points: 0,
      coHits: 0, coAtt: 0, hiFinish: 0,
      n180: 0, n140: 0, n100: 0, n60: 0,
      bestLeg: 0, tourWins: 0,
      doubles: {},   // {'D20': {a: att, h: hits}}
      heat: {}       // {'T20': count}
    };
  }

  function newProfile(name, emoji, color) {
    const p = {
      id: uid(), name, emoji: emoji || '🎯', color: color || '#e24b4b',
      created: Date.now(),
      agg: emptyAgg(),
      trainings: {},        // {mode: {best, series: [{d: date, v: val}]}}
      achievements: {},     // {id: dateEarned}
      trainDays: [],        // 'YYYY-MM-DD' Strings
      history: []           // [{d, mode, avg, co, win}] letzte Matches
    };
    state.profiles.push(p);
    save();
    return p;
  }

  const profile = id => state.profiles.find(p => p.id === id) || null;

  function deleteProfile(id) {
    state.profiles = state.profiles.filter(p => p.id !== id);
    save();
  }

  function markTrainDay(p) {
    const d = new Date().toISOString().slice(0, 10);
    if (!p.trainDays.includes(d)) p.trainDays.push(d);
    if (p.trainDays.length > 400) p.trainDays = p.trainDays.slice(-400);
  }

  function trainStreak(p) {
    if (!p.trainDays || !p.trainDays.length) return 0;
    const set = new Set(p.trainDays);
    let streak = 0;
    const day = new Date();
    // heute zählt, wenn trainiert; sonst ab gestern rückwärts
    if (!set.has(day.toISOString().slice(0, 10))) day.setDate(day.getDate() - 1);
    while (set.has(day.toISOString().slice(0, 10))) {
      streak++; day.setDate(day.getDate() - 1);
    }
    return streak;
  }

  function addTraining(p, mode, value, higherIsBetter = true) {
    if (!p.trainings[mode]) p.trainings[mode] = { best: null, series: [] };
    const tr = p.trainings[mode];
    tr.series.push({ d: Date.now(), v: value });
    if (tr.series.length > 120) tr.series = tr.series.slice(-120);
    if (tr.best === null || (higherIsBetter ? value > tr.best : value < tr.best)) tr.best = value;
    markTrainDay(p);
    save();
  }

  function avgOf(agg) { return agg.darts ? (agg.points / agg.darts) * 3 : 0; }
  function coPct(agg) { return agg.coAtt ? (agg.coHits / agg.coAtt) * 100 : 0; }

  function exportState() { saveNow(); return JSON.stringify(state, null, 1); }
  function importState(json) {
    const s = JSON.parse(json);
    if (!s || !Array.isArray(s.profiles)) throw new Error('invalid');
    state = Object.assign(defaults(), s);
    saveNow();
  }

  return {
    get state() { return state; },
    save, saveNow, uid, newProfile, profile, deleteProfile, emptyAgg,
    markTrainDay, trainStreak, addTraining, avgOf, coPct,
    exportState, importState
  };
})();
