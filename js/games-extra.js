/* One80 – zusätzliche Match-Spielmodi
   Nutzt die Casual-Shell aus games.js (Games.runCasual & Co.)
   und registriert sich über Games.register(). */
(() => {

  const { runCasual, nextTurn, visitRow, pRow, targetCard, simpleConfig, segPick } = Games;

  const base = players => players.map(p => ({ name: p.name, profileId: p.profileId || null }));
  const marksOf = d => (d.v === 25 ? Math.min(d.m, 2) : d.m);

  /* Index des besten Spielers (key = Feldname, low = niedrigster gewinnt) */
  function bestIdx(players, key, low) {
    let bi = 0, best = players[0][key];
    players.forEach((p, i) => {
      if (low ? p[key] < best : p[key] > best) { best = p[key]; bi = i; }
    });
    return bi;
  }

  const scoreRight = v => h('div', { style: 'font-size:24px;font-weight:700' }, String(v));

  /* ================= GOTCHA ================= */
  /* Hochzählen bis exakt auf das Ziel. Genau auf den Stand eines Gegners = dessen Reset. */

  function newGotcha(cfg) {
    return {
      players: base(cfg.players).map(p => ({ ...p, score: 0, visitStart: 0 })),
      target: cfg.target, cur: 0, visitDarts: [], over: false, winnerIdx: null
    };
  }

  function gotchaTurn(st) {
    nextTurn(st);
    st.players[st.cur].visitStart = st.players[st.cur].score;
  }

  function gotchaDart(st, d) {
    st.visitDarts.push(d.key);
    const p = st.players[st.cur];
    const ev = {};
    const ns = p.score + d.score;
    if (ns > st.target) {
      p.score = p.visitStart;
      ev.toast = t('bust_back', { n: p.name, v: p.score });
      UI.sfx.bust();
      gotchaTurn(st);
      return ev;
    }
    p.score = ns;
    if (ns === st.target) {
      st.over = true; st.winnerIdx = st.cur;
      ev.say = 'Game shot!';
      return ev;
    }
    if (ns > 0) {
      st.players.forEach((q, i) => {
        if (i !== st.cur && q.score === ns) {
          q.score = 0;
          ev.toast = 'Gotcha! ' + q.name + ' → 0';
        }
      });
    }
    if (st.visitDarts.length >= 3) gotchaTurn(st);
    return ev;
  }

  function renderGotcha(st, el) {
    el.appendChild(targetCard(String(st.target), t('count_up_to')));
    st.players.forEach((p, i) => el.appendChild(pRow(p, i === st.cur, scoreRight(p.score))));
    el.appendChild(visitRow(st));
  }

  /* ================= BASEBALL ================= */
  /* 9 Innings, Inning n = Feld n. Single 1 Run, Double 2, Triple 3. */

  function newBaseball(cfg) {
    return {
      players: base(cfg.players).map(p => ({ ...p, runs: 0 })),
      innings: cfg.innings, inning: 1, cur: 0, visitDarts: [], over: false, winnerIdx: null
    };
  }

  function baseballDart(st, d) {
    st.visitDarts.push(d.key);
    const p = st.players[st.cur];
    const ev = {};
    if (d.v === st.inning) { p.runs += d.m; ev.toast = '+' + d.m + ' Runs'; }
    if (st.visitDarts.length >= 3) {
      const last = st.cur === st.players.length - 1;
      if (last) {
        st.inning++;
        if (st.inning > st.innings) {
          st.over = true; st.winnerIdx = bestIdx(st.players, 'runs');
          return ev;
        }
      }
      nextTurn(st);
    }
    return ev;
  }

  function renderBaseball(st, el) {
    const inn = Math.min(st.inning, st.innings);
    el.appendChild(targetCard(String(inn), t('inning_x_of', { a: inn, b: st.innings })));
    st.players.forEach((p, i) => el.appendChild(pRow(p, i === st.cur, scoreRight(p.runs))));
    el.appendChild(visitRow(st));
  }

  /* ================= BERMUDA (Bermuda Triangle) ================= */

  const BERMUDA = [
    { k: '12', f: d => d.v === 12 ? d.score : 0 },
    { k: '13', f: d => d.v === 13 ? d.score : 0 },
    { k: 'D', f: d => d.m === 2 ? d.score : 0 },
    { k: '14', f: d => d.v === 14 ? d.score : 0 },
    { k: '15', f: d => d.v === 15 ? d.score : 0 },
    { k: '16', f: d => d.v === 16 ? d.score : 0 },
    { k: 'T', f: d => d.m === 3 ? d.score : 0 },
    { k: '17', f: d => d.v === 17 ? d.score : 0 },
    { k: '18', f: d => d.v === 18 ? d.score : 0 },
    { k: '19', f: d => d.v === 19 ? d.score : 0 },
    { k: '20', f: d => d.v === 20 ? d.score : 0 },
    { k: 'B', f: d => d.v === 25 ? d.score : 0 },
    { k: 'DB', f: d => d.key === 'DB' ? d.score : 0 }
  ];
  const bermLabel = k => k === 'D' ? t('any_double') : k === 'T' ? t('any_triple')
    : k === 'B' ? 'Bull' : k === 'DB' ? 'Bullseye' : k;

  function newBermuda(cfg) {
    return {
      players: base(cfg.players).map(p => ({ ...p, score: 1 })),
      ridx: 0, cur: 0, visitDarts: [], gain: 0, over: false, winnerIdx: null
    };
  }

  function bermudaDart(st, d) {
    st.visitDarts.push(d.key);
    st.gain += BERMUDA[st.ridx].f(d);
    const ev = {};
    if (st.visitDarts.length >= 3) {
      const p = st.players[st.cur];
      if (st.gain === 0) { p.score = Math.ceil(p.score / 2); ev.toast = '½ ' + p.name + ': ' + p.score; }
      else { p.score += st.gain; ev.toast = '+' + st.gain + ' → ' + p.score; }
      st.gain = 0;
      const last = st.cur === st.players.length - 1;
      if (last) {
        st.ridx++;
        if (st.ridx >= BERMUDA.length) {
          st.over = true; st.winnerIdx = bestIdx(st.players, 'score');
          return ev;
        }
      }
      nextTurn(st);
    }
    return ev;
  }

  function renderBermuda(st, el) {
    // nach der letzten Runde steht ridx über dem Array – auf den letzten Eintrag klemmen
    const ri = Math.min(st.ridx, BERMUDA.length - 1);
    el.appendChild(targetCard(bermLabel(BERMUDA[ri].k),
      t('round_x_of', { a: ri + 1, b: BERMUDA.length })));
    st.players.forEach((p, i) => el.appendChild(pRow(p, i === st.cur, scoreRight(p.score))));
    el.appendChild(visitRow(st));
  }

  /* ================= HIGH-LOW ================= */
  /* Abwechselnd gewinnt die höchste bzw. niedrigste Aufnahme. Schlechteste verliert ein Leben. */

  function newHiLo(cfg) {
    return {
      players: base(cfg.players).map(p => ({ ...p, lives: cfg.lives, roundScore: 0, thrown: false, out: false })),
      lives: cfg.lives, mode: 'high', round: 1, cur: 0, visitDarts: [], over: false, winnerIdx: null
    };
  }

  function hiloDart(st, d) {
    st.visitDarts.push(d.key);
    const p = st.players[st.cur];
    p.roundScore += d.score;
    const ev = {};
    if (st.visitDarts.length >= 3) {
      p.thrown = true;
      const alive = st.players.filter(q => !q.out);
      if (alive.every(q => q.thrown)) {
        // 0 Punkte zählen in der Tief-Runde als schlechtestes Ergebnis
        const valOf = q => (st.mode === 'low' && q.roundScore === 0) ? 999 : q.roundScore;
        const vals = alive.map(valOf);
        const worst = st.mode === 'high' ? Math.min(...vals) : Math.max(...vals);
        const losers = alive.filter(q => valOf(q) === worst);
        if (losers.length < alive.length) {
          losers.forEach(q => { q.lives--; if (q.lives <= 0) q.out = true; });
          ev.toast = losers.map(q => q.name).join(', ') + ' −1 ' + t('life');
        } else ev.toast = t('tie_no_loss');
        st.players.forEach(q => { q.roundScore = 0; q.thrown = false; });
        st.round++;
        st.mode = st.mode === 'high' ? 'low' : 'high';
        const rest = st.players.filter(q => !q.out);
        if (rest.length <= 1) {
          st.over = true; st.winnerIdx = st.players.indexOf(rest[0] || st.players[0]);
          return ev;
        }
      }
      nextTurn(st, i => st.players[i].out);
    }
    return ev;
  }

  function renderHiLo(st, el) {
    el.appendChild(targetCard(st.mode === 'high' ? t('hl_high') : t('hl_low'),
      t('round_lbl') + ' ' + st.round));
    st.players.forEach((p, i) => {
      el.appendChild(h('div', {
        class: 'card', style: 'padding:13px 16px;margin-bottom:8px' + (p.out ? ';opacity:.4' : '')
      },
        h('div', { class: 'row' },
          h('div', { class: 'grow row', style: 'gap:8px' },
            h('span', { style: 'font-weight:600;font-size:15px' }, p.name),
            i === st.cur && !p.out ? h('span', { class: 'turnpill' }, t('to_throw')) : null,
            p.thrown && !p.out ? h('span', { class: 'sub', style: 'font-size:12px' }, String(p.roundScore)) : null),
          p.out
            ? h('span', { class: 'sub' }, t('out_lbl'))
            : h('span', { class: 'dots' }, Array.from({ length: p.lives }, () => h('i', { class: 'on' }))))));
    });
    el.appendChild(visitRow(st));
  }

  /* ================= GOLF ================= */
  /* Loch n = Feld n. Bester Dart zählt: Triple 1, Double 2, Single 3, kein Treffer 5. */

  function newGolf(cfg) {
    return {
      players: base(cfg.players).map(p => ({ ...p, strokes: 0, card: [] })),
      holes: cfg.holes, hole: 1, cur: 0, visitDarts: [], bestM: 0, over: false, winnerIdx: null
    };
  }

  const golfStroke = m => m === 3 ? 1 : m === 2 ? 2 : m === 1 ? 3 : 5;

  function golfDart(st, d) {
    st.visitDarts.push(d.key);
    if (d.v === st.hole && d.m > st.bestM) st.bestM = d.m;
    const ev = {};
    if (st.visitDarts.length >= 3 || st.bestM === 3) {
      const p = st.players[st.cur];
      const s = golfStroke(st.bestM);
      p.strokes += s; p.card.push(s);
      ev.toast = t('hole_lbl') + ' ' + st.hole + ': ' + s + ' (' + p.strokes + ')';
      st.bestM = 0;
      const last = st.cur === st.players.length - 1;
      if (last) {
        st.hole++;
        if (st.hole > st.holes) {
          st.over = true; st.winnerIdx = bestIdx(st.players, 'strokes', true);
          return ev;
        }
      }
      nextTurn(st);
    }
    return ev;
  }

  function renderGolf(st, el) {
    const ho = Math.min(st.hole, st.holes);
    el.appendChild(targetCard(String(ho), t('hole_x_of', { a: ho, b: st.holes })));
    st.players.forEach((p, i) => el.appendChild(pRow(p, i === st.cur,
      h('div', { style: 'text-align:right' },
        h('div', { style: 'font-size:24px;font-weight:700' }, String(p.strokes)),
        h('div', { class: 'sub', style: 'font-size:11px' }, t('strokes'))))));
    el.appendChild(visitRow(st));
  }

  /* ================= MICKEY MOUSE ================= */
  /* Cricket-Variante ohne Punkte: 20–15, Doppel, Triple und Bull je dreimal treffen. */

  const MICKEY_KEYS = ['20', '19', '18', '17', '16', '15', 'D', 'T', '25'];
  const mickeyLabel = k => k === 'D' ? t('any_double') : k === 'T' ? t('any_triple') : k === '25' ? 'Bull' : k;

  function newMickey(cfg) {
    return {
      players: base(cfg.players).map(p => ({
        ...p, marks: Object.fromEntries(MICKEY_KEYS.map(k => [k, 0]))
      })),
      cur: 0, visitDarts: [], over: false, winnerIdx: null
    };
  }

  function addMarks(p, k, n) {
    while (n > 0 && p.marks[k] < 3) { p.marks[k]++; n--; }
  }

  function mickeyDart(st, d) {
    st.visitDarts.push(d.key);
    const p = st.players[st.cur];
    if ([15, 16, 17, 18, 19, 20].includes(d.v)) addMarks(p, String(d.v), d.m);
    if (d.v === 25) addMarks(p, '25', Math.min(d.m, 2));
    if (d.m === 2) addMarks(p, 'D', 1);
    if (d.m === 3) addMarks(p, 'T', 1);
    const ev = {};
    if (MICKEY_KEYS.every(k => p.marks[k] >= 3)) {
      st.over = true; st.winnerIdx = st.cur;
      ev.say = 'Game shot!';
      return ev;
    }
    if (st.visitDarts.length >= 3) nextTurn(st);
    return ev;
  }

  function renderMickey(st, el) {
    const MK = ['', '／', '✕', '⊗'];
    const tb = h('table', { class: 'tbl' });
    tb.appendChild(h('tr', null, h('th', null, ''),
      st.players.map((p, i) => h('th', { style: i === st.cur ? 'color:var(--grn)' : '' }, p.name))));
    MICKEY_KEYS.forEach(k => {
      tb.appendChild(h('tr', null,
        h('td', { style: 'font-weight:700' }, mickeyLabel(k)),
        st.players.map(p => h('td', {
          class: 'center',
          style: 'font-size:16px;' + (p.marks[k] >= 3 ? 'color:var(--grn);font-weight:700' : '')
        }, MK[p.marks[k]]))));
    });
    el.appendChild(h('div', { class: 'card', style: 'padding:8px 12px' }, tb));
    el.appendChild(visitRow(st));
  }

  /* ================= TIC-TAC-TOE ================= */

  const TTT_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

  function newTTT(cfg) {
    const pool = [];
    for (let n = 1; n <= 20; n++) pool.push(n);
    pool.push(25);
    const grid = [];
    while (grid.length < 9) grid.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return {
      players: base(cfg.players).map(p => ({ ...p, fields: 0 })),
      grid, owner: Array(9).fill(-1), line: null,
      cur: 0, visitDarts: [], over: false, winnerIdx: null
    };
  }

  function tttDart(st, d) {
    st.visitDarts.push(d.key);
    const ev = {};
    const i = st.grid.findIndex((v, j) => v === d.v && st.owner[j] < 0);
    if (i >= 0) {
      st.owner[i] = st.cur;
      st.players[st.cur].fields++;
      ev.toast = '✓ ' + (d.v === 25 ? 'Bull' : d.v);
      const l = TTT_LINES.find(ln => ln.every(x => st.owner[x] === st.cur));
      if (l) {
        st.line = l; st.over = true; st.winnerIdx = st.cur;
        ev.say = 'Game shot!';
        return ev;
      }
    }
    if (st.owner.every(o => o >= 0)) {
      st.over = true; st.winnerIdx = bestIdx(st.players, 'fields');
      return ev;
    }
    if (st.visitDarts.length >= 3) nextTurn(st);
    return ev;
  }

  const TTT_COLORS = ['var(--grn)', 'var(--red)', 'var(--gold)', 'var(--tx)', 'var(--mut)', 'var(--dim)'];

  function renderTTT(st, el) {
    const g = h('div', {
      style: 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-width:260px;margin:4px auto 12px'
    });
    st.grid.forEach((v, i) => {
      const o = st.owner[i];
      const inLine = st.line && st.line.includes(i);
      g.appendChild(h('div', {
        style: 'padding:14px 0;border-radius:14px;font-weight:700;font-size:17px;text-align:center;'
          + (o >= 0
            ? 'background:var(--s2);color:' + TTT_COLORS[o % TTT_COLORS.length]
              + (inLine ? ';outline:2px solid ' + TTT_COLORS[o % TTT_COLORS.length] : '')
            : 'background:var(--s1);color:var(--mut)')
      }, v === 25 ? 'Bull' : String(v)));
    });
    el.appendChild(h('div', { class: 'card', style: 'padding:12px' }, g));
    st.players.forEach((p, i) => el.appendChild(pRow(p, i === st.cur,
      h('div', {
        style: 'font-size:22px;font-weight:700;color:' + TTT_COLORS[i % TTT_COLORS.length]
      }, String(p.fields)))));
    el.appendChild(visitRow(st));
  }

  /* ================= NINE DART SHOOTOUT ================= */
  /* Jeder wirft 9 Darts – höchster Gesamtscore gewinnt. */

  function newShootout(cfg) {
    return {
      players: base(cfg.players).map(p => ({ ...p, score: 0, darts: 0, visits: [] })),
      max: cfg.darts, cur: 0, visitDarts: [], visitSum: 0, over: false, winnerIdx: null
    };
  }

  function shootoutDart(st, d) {
    st.visitDarts.push(d.key);
    const p = st.players[st.cur];
    p.score += d.score; p.darts++; st.visitSum += d.score;
    const ev = {};
    if (st.visitDarts.length >= 3) {
      p.visits.push(st.visitSum);
      if (st.visitSum === 180) ev.say = 'One hundred and eighty!';
      else ev.toast = String(st.visitSum);
      st.visitSum = 0;
      if (st.players.every(q => q.darts >= st.max)) {
        st.over = true; st.winnerIdx = bestIdx(st.players, 'score');
        return ev;
      }
      nextTurn(st, i => st.players[i].darts >= st.max);
    }
    return ev;
  }

  function renderShootout(st, el) {
    const p = st.players[st.cur];
    el.appendChild(targetCard(String(st.max - p.darts), t('darts_left')));
    st.players.forEach((q, i) => el.appendChild(pRow(q, i === st.cur,
      h('div', { style: 'text-align:right' },
        h('div', { style: 'font-size:24px;font-weight:700' }, String(q.score)),
        h('div', { class: 'sub', style: 'font-size:11px' }, 'Ø ' + UI.f1(q.darts ? (q.score / q.darts) * 3 : 0))))));
    el.appendChild(visitRow(st));
  }

  /* ================= SUDDEN DEATH ================= */
  /* Jede Runde eine Aufnahme – die niedrigste fliegt raus. */

  function newSudden(cfg) {
    return {
      players: base(cfg.players).map(p => ({ ...p, roundScore: 0, thrown: false, out: false, survived: 0 })),
      round: 1, cur: 0, visitDarts: [], over: false, winnerIdx: null
    };
  }

  function suddenDart(st, d) {
    st.visitDarts.push(d.key);
    const p = st.players[st.cur];
    p.roundScore += d.score;
    const ev = {};
    if (st.visitDarts.length >= 3) {
      p.thrown = true;
      const alive = st.players.filter(q => !q.out);
      if (alive.every(q => q.thrown)) {
        const worst = Math.min(...alive.map(q => q.roundScore));
        const losers = alive.filter(q => q.roundScore === worst);
        if (losers.length < alive.length) {
          losers.forEach(q => { q.out = true; });
          ev.toast = t('eliminated', { n: losers.map(q => q.name).join(', ') });
        } else ev.toast = t('tie_no_loss');
        alive.forEach(q => { if (!q.out) q.survived++; });
        st.players.forEach(q => { q.roundScore = 0; q.thrown = false; });
        st.round++;
        const rest = st.players.filter(q => !q.out);
        if (rest.length <= 1) {
          st.over = true; st.winnerIdx = st.players.indexOf(rest[0] || st.players[0]);
          return ev;
        }
      }
      nextTurn(st, i => st.players[i].out);
    }
    return ev;
  }

  function renderSudden(st, el) {
    const alive = st.players.filter(q => !q.out).length;
    el.appendChild(targetCard(String(alive), t('still_in')));
    st.players.forEach((p, i) => {
      el.appendChild(h('div', {
        class: 'card', style: 'padding:13px 16px;margin-bottom:8px' + (p.out ? ';opacity:.4' : '')
      },
        h('div', { class: 'row' },
          h('div', { class: 'grow row', style: 'gap:8px' },
            h('span', { style: 'font-weight:600;font-size:15px' }, p.name),
            i === st.cur && !p.out ? h('span', { class: 'turnpill' }, t('to_throw')) : null),
          p.out
            ? h('span', { class: 'sub' }, t('out_lbl'))
            : h('span', { style: 'font-size:20px;font-weight:700' }, p.thrown ? String(p.roundScore) : '–'))));
    });
    el.appendChild(visitRow(st));
  }

  /* ================= STARTER ================= */

  function starter(mode, title, subFn, newFn, dartFn, renderFn) {
    return cfg => {
      const mk = () => runCasual({
        mode, st: newFn(cfg), title, sub: subFn(cfg),
        dart: dartFn, render: renderFn, again: mk
      });
      mk();
    };
  }

  const startGotcha = starter('gotcha', 'Gotcha', c => String(c.target), newGotcha, gotchaDart, renderGotcha);
  const startBaseball = starter('baseball', 'Baseball', c => c.innings + ' Innings', newBaseball, baseballDart, renderBaseball);
  const startBermuda = starter('bermuda', 'Bermuda', () => '13 ' + t('rounds'), newBermuda, bermudaDart, renderBermuda);
  const startHiLo = starter('highlow', 'High-Low', c => c.lives + ' ' + t('lives'), newHiLo, hiloDart, renderHiLo);
  const startGolf = starter('golf', 'Golf', c => c.holes + ' ' + t('holes'), newGolf, golfDart, renderGolf);
  const startMickey = starter('mickey', 'Mickey Mouse', () => '20–15 · D · T · Bull', newMickey, mickeyDart, renderMickey);
  const startTTT = starter('ttt', 'Tic-Tac-Toe', () => t('ttt_goal'), newTTT, tttDart, renderTTT);
  const startShootout = starter('shootout', 'Nine Dart Shootout', c => c.darts + ' Darts', newShootout, shootoutDart, renderShootout);
  const startSudden = starter('sudden', 'Sudden Death', () => t('sd_sub'), newSudden, suddenDart, renderSudden);

  /* ================= REGISTRIERUNG ================= */

  [
    {
      cat: 'count', badge: 'GO', name: 'Gotcha', desc: 'g_gotcha_d',
      go: () => simpleConfig('Gotcha', 'GO', {
        min: 2, max: 6,
        extras: host => {
          const seg = segPick([301, 501], ['301', '501'], 301);
          host.appendChild(seg);
          return { seg };
        }
      }, (players, ex) => startGotcha({ players, target: ex.seg.value() }))
    },
    {
      cat: 'count', badge: '9D', name: 'Nine Dart Shootout', desc: 'g_shootout_d',
      go: () => simpleConfig('Nine Dart Shootout', '9D', {
        min: 1, max: 6,
        extras: host => {
          const seg = segPick([9, 18, 27], ['9 Darts', '18 Darts', '27 Darts'], 9);
          host.appendChild(seg);
          return { seg };
        }
      }, (players, ex) => startShootout({ players, darts: ex.seg.value() }))
    },
    {
      cat: 'count', badge: 'SD', name: 'Sudden Death', desc: 'g_sudden_d',
      go: () => simpleConfig('Sudden Death', 'SD', { min: 2, max: 6 },
        players => startSudden({ players }))
    },
    {
      cat: 'classic', badge: 'MM', name: 'Mickey Mouse', desc: 'g_mickey_d',
      go: () => simpleConfig('Mickey Mouse', 'MM', { min: 2, max: 4 },
        players => startMickey({ players }))
    },
    {
      cat: 'classic', badge: 'BM', name: 'Bermuda', desc: 'g_bermuda_d',
      go: () => simpleConfig('Bermuda', 'BM', { min: 1, max: 6 },
        players => startBermuda({ players }))
    },
    {
      cat: 'fun', badge: 'BB', name: 'Baseball', desc: 'g_baseball_d',
      go: () => simpleConfig('Baseball', 'BB', {
        min: 1, max: 6,
        extras: host => {
          const seg = segPick([7, 9], ['7 Innings', '9 Innings'], 9);
          host.appendChild(seg);
          return { seg };
        }
      }, (players, ex) => startBaseball({ players, innings: ex.seg.value() }))
    },
    {
      cat: 'fun', badge: 'GF', name: 'Golf', desc: 'g_golf_d',
      go: () => simpleConfig('Golf', 'GF', {
        min: 1, max: 6,
        extras: host => {
          const seg = segPick([9, 18], ['9 ' + t('holes'), '18 ' + t('holes')], 9);
          host.appendChild(seg);
          return { seg };
        }
      }, (players, ex) => startGolf({ players, holes: ex.seg.value() }))
    },
    {
      cat: 'fun', badge: 'HL', name: 'High-Low', desc: 'g_highlow_d',
      go: () => simpleConfig('High-Low', 'HL', {
        min: 2, max: 6,
        extras: host => {
          const seg = segPick([3, 5], ['3 ' + t('lives'), '5 ' + t('lives')], 3);
          host.appendChild(seg);
          return { seg };
        }
      }, (players, ex) => startHiLo({ players, lives: ex.seg.value() }))
    },
    {
      cat: 'fun', badge: 'TTT', name: 'Tic-Tac-Toe', desc: 'g_ttt_d',
      go: () => simpleConfig('Tic-Tac-Toe', 'TTT', { min: 2, max: 4 },
        players => startTTT({ players }))
    }
  ].forEach(Games.register);

})();
