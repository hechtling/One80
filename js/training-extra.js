/* One80 – zusätzliche Trainingsmodi
   Baut auf den Bausteinen aus training.js auf (Training.trainShell & Co.)
   und registriert sich selbst über Training.register(). */
(() => {

  const { trainShell, coDart, trackCoDouble, mergeDoubles, dispKey, randFinish } = Training;

  /* Marks wie im Cricket: T=3, D=2, S=1, Bull 25=1 / 50=2 */
  const marksOf = d => (d.v === 25 ? Math.min(d.m, 2) : d.m);

  /* kleines Auswahl-Modal: felder = [{label, el}] */
  function ask(title, fields, onStart) {
    UI.modal({
      title,
      body: h('div', null, fields.map(f => h('label', { class: 'fld' }, f.label, f.el))),
      buttons: [
        { label: t('cancel'), cls: 'sec' },
        { label: t('start_btn'), onClick: onStart }
      ]
    });
  }
  const sel = (opts, initial) => h('select', null,
    opts.map(o => h('option', { value: String(o[0]), ...(String(o[0]) === String(initial) ? { selected: '' } : {}) }, o[1])));

  /* ============================================================
     KLASSIKER
     ============================================================ */

  /* ---------- Around the Clock (Solo) ---------- */
  function startAtcSolo(profile, variant, bull) {
    const targets = [];
    for (let n = 1; n <= 20; n++) targets.push(n);
    if (bull && variant !== 'triple') targets.push(25);
    const pre = variant === 'double' ? 'D' : variant === 'triple' ? 'T' : '';
    const st = { targets, variant, idx: 0, darts: 0, perD: {}, over: false };
    trainShell(profile, 'atc_solo', {
      st, title: t('tr_atc'),
      label: () => {
        const g = st.targets[st.idx];
        return g === undefined ? '✓' : pre + (g === 25 ? 'Bull' : g);
      },
      status: () => st.idx + ' / ' + st.targets.length + ' · ' + st.darts + ' Darts',
      progress: () => st.idx / st.targets.length,
      dart(d) {
        st.darts++;
        const g = st.targets[st.idx];
        if (variant === 'double' && g !== undefined) {
          const k = g === 25 ? 'DB' : 'D' + g;
          const dd = st.perD[k] = st.perD[k] || { a: 0, h: 0 };
          dd.a++; if (d.key === k) dd.h++;
        }
        const hit = d.v === g && (variant === 'any'
          || (variant === 'double' && d.m === 2)
          || (variant === 'triple' && d.m === 3));
        const ev = {};
        if (hit) {
          st.idx++;
          ev.toast = '✓ ' + (g === 25 ? 'Bull' : g);
          if (st.idx >= st.targets.length) ev.sessionEnd = true;
        }
        return ev;
      },
      summary: () => ({
        value: st.darts, unit: ' Darts', higherBetter: false,
        lines: [
          [t('targets'), st.targets.length],
          [t('per_target'), UI.f1(st.darts / st.targets.length)]
        ],
        apply: () => mergeDoubles(profile, st.perD)
      })
    }, () => startAtcSolo(profile, variant, bull));
  }

  function configAtcSolo(profile) {
    const v = sel([['any', t('v_any')], ['double', 'Doubles'], ['triple', 'Triples']], 'any');
    const b = sel([['1', t('yes')], ['0', t('no')]], '1');
    ask(t('tr_atc'), [{ label: t('variant'), el: v }, { label: '+ Bull', el: b }],
      () => startAtcSolo(profile, v.value, b.value === '1'));
  }

  /* ---------- Shanghai-Training ---------- */
  function startShanghaiTr(profile, rounds) {
    const st = { rounds, round: 1, dartNo: 0, points: 0, sh: 0, f: { s: false, d: false, t: false }, over: false };
    trainShell(profile, 'shanghai_tr', {
      st, title: t('tr_shanghai'),
      label: () => String(st.round),
      status: () => t('round_x_of', { a: st.round, b: st.rounds }) + ' · ' + st.points + ' ' + t('points'),
      progress: () => (st.round - 1) / st.rounds,
      dart(d) {
        st.dartNo++;
        if (d.v === st.round) {
          st.points += d.score;
          if (d.m === 1) st.f.s = true;
          if (d.m === 2) st.f.d = true;
          if (d.m === 3) st.f.t = true;
        }
        const ev = {};
        if (st.dartNo >= 3) {
          if (st.f.s && st.f.d && st.f.t) {
            st.points += 100; st.sh++;
            ev.toast = 'Shanghai! +100'; ev.say = 'Shanghai!';
          }
          st.dartNo = 0; st.f = { s: false, d: false, t: false }; st.round++;
          if (st.round > st.rounds) ev.sessionEnd = true;
        }
        return ev;
      },
      summary: () => ({
        value: st.points, unit: ' ' + t('points'),
        lines: [
          [t('rounds'), st.rounds],
          ['Shanghai', st.sh],
          [t('per_round'), UI.f1(st.points / st.rounds)]
        ],
        ctx: { shanghai: st.sh > 0 }
      })
    }, () => startShanghaiTr(profile, rounds));
  }

  function configShanghaiTr(profile) {
    const r = sel([['7', '1–7'], ['20', '1–20']], '7');
    ask(t('tr_shanghai'), [{ label: t('rounds'), el: r }],
      () => startShanghaiTr(profile, parseInt(r.value, 10)));
  }

  /* ---------- Halve It (Solo) & Splitscore ----------
     Gleiche Mechanik, unterschiedliche Zielfolgen. */
  const HALVE_SEQ = [
    { k: '20', f: d => d.v === 20 ? d.score : 0 },
    { k: '16', f: d => d.v === 16 ? d.score : 0 },
    { k: 'D', f: d => d.m === 2 ? d.score : 0 },
    { k: '17', f: d => d.v === 17 ? d.score : 0 },
    { k: '18', f: d => d.v === 18 ? d.score : 0 },
    { k: 'T', f: d => d.m === 3 ? d.score : 0 },
    { k: '19', f: d => d.v === 19 ? d.score : 0 },
    { k: 'B', f: d => d.v === 25 ? d.score : 0 }
  ];
  const SPLIT_SEQ = [
    { k: '15', f: d => d.v === 15 ? d.score : 0 },
    { k: '16', f: d => d.v === 16 ? d.score : 0 },
    { k: 'D', f: d => d.m === 2 ? d.score : 0 },
    { k: '17', f: d => d.v === 17 ? d.score : 0 },
    { k: '18', f: d => d.v === 18 ? d.score : 0 },
    { k: 'T', f: d => d.m === 3 ? d.score : 0 },
    { k: '19', f: d => d.v === 19 ? d.score : 0 },
    { k: '20', f: d => d.v === 20 ? d.score : 0 },
    { k: 'B', f: d => d.v === 25 ? d.score : 0 }
  ];
  const seqLabel = k => k === 'D' ? t('any_double') : k === 'T' ? t('any_triple') : k === 'B' ? 'Bull' : k;

  function startHalveLike(profile, mode, title, SEQ) {
    const st = { idx: 0, dartNo: 0, score: 40, gain: 0, halved: 0, over: false };
    trainShell(profile, mode, {
      st, title,
      label: () => seqLabel(SEQ[st.idx] ? SEQ[st.idx].k : ''),
      status: () => t('round_x_of', { a: st.idx + 1, b: SEQ.length }) + ' · ' + st.score + ' ' + t('points'),
      progress: () => st.idx / SEQ.length,
      dart(d) {
        st.dartNo++;
        st.gain += SEQ[st.idx].f(d);
        const ev = {};
        if (st.dartNo >= 3) {
          if (st.gain === 0) {
            st.score = Math.ceil(st.score / 2); st.halved++;
            ev.toast = '½ → ' + st.score;
          } else {
            st.score += st.gain;
            ev.toast = '+' + st.gain + ' → ' + st.score;
          }
          st.gain = 0; st.dartNo = 0; st.idx++;
          if (st.idx >= SEQ.length) ev.sessionEnd = true;
        }
        return ev;
      },
      summary: () => ({
        value: st.score, unit: ' ' + t('points'),
        lines: [[t('halved'), st.halved + ' / ' + SEQ.length]]
      })
    }, () => startHalveLike(profile, mode, title, SEQ));
  }
  const startHalveSolo = p => startHalveLike(p, 'halve_solo', t('tr_halve'), HALVE_SEQ);
  const startSplit = p => startHalveLike(p, 'splitscore', t('tr_split'), SPLIT_SEQ);

  /* ---------- Cricket (Solo) ---------- */
  const CR_KEYS = [20, 19, 18, 17, 16, 15, 25];
  function startCricketSolo(profile) {
    const st = { marks: Object.fromEntries(CR_KEYS.map(k => [k, 0])), darts: 0, over: false };
    const open = () => CR_KEYS.filter(k => st.marks[k] < 3);
    trainShell(profile, 'cricket_solo', {
      st, title: t('tr_cricket'),
      label: () => String(st.darts),
      status: () => (7 - open().length) + ' / 7 ' + t('closed') + ' · ' + t('darts_thrown'),
      progress: () => CR_KEYS.reduce((a, k) => a + st.marks[k], 0) / 21,
      extra: () => {
        const grid = h('div', { style: 'display:flex;gap:5px;justify-content:center;flex-wrap:wrap;margin-top:6px' });
        CR_KEYS.forEach(k => {
          const done = st.marks[k] >= 3;
          grid.appendChild(h('span', {
            style: 'min-width:42px;padding:5px 6px;border-radius:10px;font-size:12px;font-weight:700;text-align:center;'
              + (done ? 'background:var(--grnT);color:var(--grn)' : 'background:var(--s2);color:var(--mut)')
          }, (k === 25 ? 'B' : k) + ' ' + ['', '／', '✕', '⊗'][st.marks[k]]));
        });
        return grid;
      },
      dart(d) {
        st.darts++;
        const ev = {};
        if (CR_KEYS.includes(d.v)) {
          let n = marksOf(d);
          const before = st.marks[d.v];
          while (n > 0 && st.marks[d.v] < 3) { st.marks[d.v]++; n--; }
          if (before < 3 && st.marks[d.v] >= 3) ev.toast = (d.v === 25 ? 'Bull' : d.v) + ' ' + t('closed');
        }
        if (!open().length) ev.sessionEnd = true;
        return ev;
      },
      summary: () => ({
        value: st.darts, unit: ' Darts', higherBetter: false,
        lines: [[t('per_target'), UI.f1(st.darts / 7)]]
      })
    }, () => startCricketSolo(profile));
  }

  /* ---------- Chase the Dragon ---------- */
  function startDragon(profile) {
    const seq = ['T15', 'T16', 'T17', 'T18', 'T19', 'T20', 'SB', 'DB'];
    const st = { seq, idx: 0, darts: 0, over: false };
    trainShell(profile, 'dragon', {
      st, title: t('tr_dragon'),
      label: () => dispKey(st.seq[st.idx] || '✓'),
      status: () => st.idx + ' / ' + st.seq.length + ' · ' + st.darts + ' Darts',
      progress: () => st.idx / st.seq.length,
      dart(d) {
        st.darts++;
        const ev = {};
        if (d.key === st.seq[st.idx]) {
          ev.toast = '✓ ' + dispKey(st.seq[st.idx]);
          st.idx++;
          if (st.idx >= st.seq.length) { ev.say = 'Game shot!'; ev.sessionEnd = true; }
        }
        return ev;
      },
      summary: () => ({
        value: st.darts, unit: ' Darts', higherBetter: false,
        lines: [[t('per_target'), UI.f1(st.darts / st.seq.length)]]
      })
    }, () => startDragon(profile));
  }

  /* ---------- Nine Lives ---------- */
  function startNineLives(profile) {
    const st = { num: 1, lives: 9, dartNo: 0, roundHits: 0, cleared: 0, over: false };
    trainShell(profile, 'nine_lives', {
      st, title: t('tr_lives'),
      label: () => String(st.num),
      status: () => t('lives_left') + ': ' + st.lives + ' · ' + t('fields_done') + ': ' + st.cleared,
      progress: () => st.cleared / 20,
      dart(d) {
        st.dartNo++;
        if (d.v === st.num) st.roundHits++;
        const ev = {};
        if (st.dartNo >= 3) {
          if (st.roundHits === 3) {
            st.cleared++; st.num++;
            ev.toast = '✓ ' + t('fields_done') + ': ' + st.cleared;
          } else {
            st.lives--;
            ev.toast = '−1 ' + t('life') + ' (' + st.roundHits + '/3)';
          }
          st.dartNo = 0; st.roundHits = 0;
          if (st.lives <= 0 || st.num > 20) ev.sessionEnd = true;
        }
        return ev;
      },
      summary: () => ({
        value: st.cleared, unit: ' / 20',
        lines: [[t('lives_left'), Math.max(0, st.lives)], [t('reached'), Math.min(20, st.num)]]
      })
    }, () => startNineLives(profile));
  }

  /* ============================================================
     DOPPEL & CHECKOUT
     ============================================================ */

  /* ---------- 121-Challenge ---------- */
  function start121(profile, tries) {
    const st = {
      level: 121, best: 0, tries, att: 0, wins: 0,
      task: { rem: 121, darts: 0, done: false, success: false }, perD: {}, over: false
    };
    trainShell(profile, 'c121', {
      st, title: t('tr_121'),
      label: () => String(st.task.rem),
      status: () => t('task_x_of', { a: st.att + 1, b: st.tries }) + ' · ' + t('level') + ' ' + st.level
        + ' · ' + (9 - st.task.darts) + ' Darts',
      progress: () => st.att / st.tries,
      dart(d) {
        trackCoDouble(st, st.task, d);
        coDart(st.task, d, 9);
        const ev = {};
        if (st.task.done) {
          st.att++;
          if (st.task.success) {
            st.wins++;
            st.best = Math.max(st.best, st.level);
            st.level += 20;
            ev.toast = '✓ ↑ ' + st.level; ev.say = 'Game shot!';
          } else {
            st.level = Math.max(41, st.level - 20);
            ev.toast = '✗ ↓ ' + st.level;
          }
          if (st.att >= st.tries) ev.sessionEnd = true;
          else st.task = { rem: st.level, darts: 0, done: false, success: false };
        }
        return ev;
      },
      summary: () => ({
        value: st.best, unit: '',
        lines: [[t('checked'), st.wins + ' / ' + st.tries], [t('level'), st.level]],
        apply: () => mergeDoubles(profile, st.perD)
      })
    }, () => start121(profile, tries));
  }
  function config121(profile) {
    const n = sel([['5', '5 ' + t('attempts')], ['10', '10 ' + t('attempts')], ['15', '15 ' + t('attempts')]], '10');
    ask(t('tr_121'), [{ label: t('attempts'), el: n }],
      () => start121(profile, parseInt(n.value, 10)));
  }

  /* ---------- Doppel-Killer ---------- */
  function startDKiller(profile, lives) {
    const seq = [];
    for (let n = 1; n <= 20; n++) seq.push('D' + n);
    seq.push('DB');
    const st = { seq, idx: 0, dartNo: 0, hitThis: false, lives, hits: 0, perD: {}, over: false };
    trainShell(profile, 'dkiller', {
      st, title: t('tr_dkiller'),
      label: () => dispKey(st.seq[st.idx] || ''),
      status: () => t('lives_left') + ': ' + st.lives + ' · ' + t('doubles_hit') + ': ' + st.hits + ' / ' + st.seq.length,
      progress: () => st.idx / st.seq.length,
      dart(d) {
        const key = st.seq[st.idx];
        st.dartNo++;
        const dd = st.perD[key] = st.perD[key] || { a: 0, h: 0 };
        dd.a++;
        const ev = {};
        if (d.key === key) { st.hitThis = true; dd.h++; }
        if (st.dartNo >= 3 || st.hitThis) {
          if (st.hitThis) { st.hits++; ev.toast = '✓ ' + dispKey(key); }
          else { st.lives--; ev.toast = '−1 ' + t('life') + ' · ' + dispKey(key); }
          st.dartNo = 0; st.hitThis = false; st.idx++;
          if (st.lives <= 0 || st.idx >= st.seq.length) ev.sessionEnd = true;
        }
        return ev;
      },
      summary: () => ({
        value: st.hits, unit: ' / ' + st.seq.length,
        lines: [[t('lives_left'), Math.max(0, st.lives)], [t('reached'), dispKey(st.seq[Math.min(st.idx, st.seq.length - 1)])]],
        apply: () => mergeDoubles(profile, st.perD),
        ctx: { doubles50: st.hits >= 11 }
      })
    }, () => startDKiller(profile, lives));
  }
  function configDKiller(profile) {
    const l = sel([['3', '3 ' + t('lives')], ['5', '5 ' + t('lives')], ['9', '9 ' + t('lives')]], '5');
    ask(t('tr_dkiller'), [{ label: t('lives'), el: l }],
      () => startDKiller(profile, parseInt(l.value, 10)));
  }

  /* ---------- Speed-Checkout (auf Zeit) ---------- */
  function startSpeedCo(profile, secs) {
    const st = {
      done: 0, tried: 0,
      task: { rem: randFinish(), darts: 0, done: false, success: false }, perD: {}, over: false
    };
    trainShell(profile, 'co_speed', {
      st, title: t('tr_speed'), timeLimit: secs,
      label: () => String(st.task.rem),
      status: () => t('checkouts') + ': ' + st.done + ' / ' + st.tried + ' · ' + (3 - st.task.darts) + ' Darts',
      progress: () => Math.min(1, st.done / 10),
      dart(d) {
        trackCoDouble(st, st.task, d);
        coDart(st.task, d, 3);
        const ev = {};
        if (st.task.done) {
          st.tried++;
          if (st.task.success) { st.done++; ev.toast = '✓ ' + t('checked'); }
          st.task = { rem: randFinish(), darts: 0, done: false, success: false };
        }
        return ev;
      },
      summary: () => ({
        value: st.done, unit: '',
        lines: [[t('attempts'), st.tried], [t('time'), secs + ' s']],
        apply: () => mergeDoubles(profile, st.perD)
      })
    }, () => startSpeedCo(profile, secs));
  }
  function configSpeedCo(profile) {
    const s = sel([['60', '60 s'], ['120', '2 min'], ['180', '3 min']], '120');
    ask(t('tr_speed'), [{ label: t('time'), el: s }],
      () => startSpeedCo(profile, parseInt(s.value, 10)));
  }

  /* ---------- Bull-Training ---------- */
  function startBull(profile, max) {
    const st = { max, darts: 0, points: 0, db: 0, sb: 0, over: false };
    trainShell(profile, 'bull_tr', {
      st, title: t('tr_bull'),
      label: () => 'Bull',
      status: () => st.points + ' ' + t('points') + ' · ' + (st.max - st.darts) + ' ' + t('darts_left'),
      progress: () => st.darts / st.max,
      dart(d) {
        st.darts++;
        const ev = {};
        if (d.key === 'DB') { st.db++; st.points += 50; ev.toast = 'Bullseye!'; }
        else if (d.key === 'SB') { st.sb++; st.points += 25; ev.toast = '25'; }
        if (st.darts >= st.max) ev.sessionEnd = true;
        return ev;
      },
      summary: () => ({
        value: st.points, unit: ' ' + t('points'),
        lines: [
          ['Bullseye (50)', st.db],
          ['25', st.sb],
          [t('hit_rate'), Math.round(((st.db + st.sb) / st.max) * 100) + ' %']
        ]
      })
    }, () => startBull(profile, max));
  }
  function configBull(profile) {
    const n = sel([['30', '30 Darts'], ['60', '60 Darts'], ['90', '90 Darts']], '30');
    ask(t('tr_bull'), [{ label: t('darts_count'), el: n }],
      () => startBull(profile, parseInt(n.value, 10)));
  }

  /* ============================================================
     SCORING & PRÄZISION
     ============================================================ */

  /* ---------- High Score ---------- */
  function startHighScore(profile, visits) {
    const st = { visits, vIdx: 0, dartNo: 0, cur: 0, total: 0, best: 0, n180: 0, n140: 0, n100: 0, over: false };
    trainShell(profile, 'highscore', {
      st, title: t('tr_high'),
      label: () => String(st.total),
      status: () => t('round_x_of', { a: st.vIdx + 1, b: st.visits }) + ' · Ø ' + UI.f1(st.vIdx ? st.total / st.vIdx : 0),
      progress: () => st.vIdx / st.visits,
      dart(d) {
        st.dartNo++; st.cur += d.score; st.total += d.score;
        const ev = {};
        if (st.dartNo >= 3) {
          if (st.cur === 180) { st.n180++; ev.say = 'One hundred and eighty!'; }
          else if (st.cur >= 140) st.n140++;
          else if (st.cur >= 100) st.n100++;
          st.best = Math.max(st.best, st.cur);
          ev.toast = String(st.cur);
          st.cur = 0; st.dartNo = 0; st.vIdx++;
          if (st.vIdx >= st.visits) ev.sessionEnd = true;
        }
        return ev;
      },
      summary: () => ({
        value: Math.round((st.total / st.visits) * 10) / 10, unit: ' Ø',
        lines: [
          [t('total'), st.total],
          [t('best_visit'), st.best],
          ['180 / 140+ / 100+', st.n180 + ' / ' + st.n140 + ' / ' + st.n100]
        ],
        ctx: { highAvg: st.total / st.visits }
      })
    }, () => startHighScore(profile, visits));
  }
  function configHighScore(profile) {
    const n = sel([['10', '10 ' + t('rounds')], ['20', '20 ' + t('rounds')], ['30', '30 ' + t('rounds')]], '10');
    ask(t('tr_high'), [{ label: t('rounds'), el: n }],
      () => startHighScore(profile, parseInt(n.value, 10)));
  }

  /* ---------- Treble Hunter (Serie) ---------- */
  function startStreak(profile, key, max) {
    const st = { key, max, darts: 0, hits: 0, streak: 0, best: 0, over: false };
    trainShell(profile, 't20streak', {
      st, title: t('tr_streak'),
      label: () => dispKey(st.key),
      status: () => t('longest_streak') + ': ' + st.best + ' · ' + t('now') + ': ' + st.streak
        + ' · ' + (st.max - st.darts) + ' ' + t('darts_left'),
      progress: () => st.darts / st.max,
      dart(d) {
        st.darts++;
        const ev = {};
        if (d.key === st.key) {
          st.hits++; st.streak++;
          if (st.streak > st.best) { st.best = st.streak; ev.toast = '🔥 ' + st.best; }
          else ev.toast = '✓ ' + st.streak;
        } else st.streak = 0;
        if (st.darts >= st.max) ev.sessionEnd = true;
        return ev;
      },
      summary: () => ({
        value: st.best, unit: '',
        lines: [
          [t('hits'), st.hits + ' / ' + st.max],
          [t('hit_rate'), Math.round((st.hits / st.max) * 100) + ' %']
        ]
      })
    }, () => startStreak(profile, key, max));
  }
  function configStreak(profile) {
    const k = sel([['T20', 'T20'], ['T19', 'T19'], ['T18', 'T18'], ['DB', 'Bullseye']], 'T20');
    const n = sel([['30', '30 Darts'], ['60', '60 Darts'], ['90', '90 Darts']], '60');
    ask(t('tr_streak'), [{ label: t('target'), el: k }, { label: t('darts_count'), el: n }],
      () => startStreak(profile, k.value, parseInt(n.value, 10)));
  }

  /* ---------- 51 in 5 ---------- */
  function startFive(profile, target, rounds) {
    const st = { target, rounds, rIdx: 0, dartNo: 0, cur: 0, won: 0, total: 0, over: false };
    trainShell(profile, 'five_in_five', {
      st, title: t('tr_51'),
      label: () => String(st.target),
      status: () => t('round_x_of', { a: st.rIdx + 1, b: st.rounds }) + ' · ' + st.cur + ' ' + t('points')
        + ' (' + (5 - st.dartNo) + ' Darts)',
      progress: () => st.rIdx / st.rounds,
      dart(d) {
        st.dartNo++;
        if (d.v === st.target) st.cur += d.score;
        const ev = {};
        if (st.dartNo >= 5) {
          st.total += st.cur;
          if (st.cur >= 51) { st.won++; ev.toast = '✓ ' + st.cur; }
          else ev.toast = '✗ ' + st.cur;
          st.cur = 0; st.dartNo = 0; st.rIdx++;
          if (st.rIdx >= st.rounds) ev.sessionEnd = true;
        }
        return ev;
      },
      summary: () => ({
        value: st.won, unit: ' / ' + st.rounds,
        lines: [[t('total'), st.total], [t('per_round'), UI.f1(st.total / st.rounds)]]
      })
    }, () => startFive(profile, target, rounds));
  }
  function configFive(profile) {
    const k = sel([['20', '20'], ['19', '19'], ['18', '18'], ['17', '17'], ['16', '16']], '20');
    const n = sel([['5', '5 ' + t('rounds')], ['10', '10 ' + t('rounds')]], '10');
    ask(t('tr_51'), [{ label: t('target'), el: k }, { label: t('rounds'), el: n }],
      () => startFive(profile, parseInt(k.value, 10), parseInt(n.value, 10)));
  }

  /* ---------- Tic-Tac-Toe (Solo) ---------- */
  const TTT_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  function startTTT(profile) {
    const pool = [];
    for (let n = 1; n <= 20; n++) pool.push(n);
    pool.push(25);
    const grid = [];
    while (grid.length < 9) {
      const i = Math.floor(Math.random() * pool.length);
      grid.push(pool.splice(i, 1)[0]);
    }
    const st = { grid, owned: Array(9).fill(false), darts: 0, line: null, over: false };
    const hasLine = () => TTT_LINES.find(l => l.every(i => st.owned[i])) || null;
    trainShell(profile, 'tictactoe', {
      st, title: t('tr_ttt'),
      label: () => st.owned.filter(Boolean).length + ' / 9',
      status: () => st.darts + ' Darts · ' + t('ttt_goal'),
      progress: () => st.owned.filter(Boolean).length / 3,
      extra: () => {
        const g = h('div', {
          style: 'display:grid;grid-template-columns:repeat(3,1fr);gap:6px;width:100%;max-width:220px;margin:8px auto 0'
        });
        st.grid.forEach((v, i) => {
          const on = st.owned[i];
          const inLine = st.line && st.line.includes(i);
          g.appendChild(h('div', {
            style: 'padding:10px 0;border-radius:12px;font-weight:700;font-size:15px;text-align:center;'
              + (on ? 'background:var(--grnT);color:var(--grn);border:1px solid ' + (inLine ? 'var(--grn)' : 'transparent')
                : 'background:var(--s2);color:var(--mut)')
          }, v === 25 ? 'B' : String(v)));
        });
        return g;
      },
      dart(d) {
        st.darts++;
        const ev = {};
        const i = st.grid.findIndex((v, j) => v === d.v && !st.owned[j]);
        if (i >= 0) {
          st.owned[i] = true;
          const l = hasLine();
          if (l) { st.line = l; ev.toast = '✓ ' + t('line_found'); ev.say = 'Game shot!'; ev.sessionEnd = true; }
          else ev.toast = '✓ ' + (d.v === 25 ? 'Bull' : d.v);
        }
        return ev;
      },
      summary: () => ({
        value: st.darts, unit: ' Darts', higherBetter: false,
        lines: [[t('fields_done'), st.owned.filter(Boolean).length + ' / 9']]
      })
    }, () => startTTT(profile));
  }

  /* ============================================================
     WARM-UP & ROUTINEN
     ============================================================ */

  /* ---------- geführte Aufwärm-Routine ---------- */
  const WARM_BLOCKS = [
    { lbl: '20', darts: 9, hit: d => d.v === 20, pts: d => d.v === 20 ? d.score : 0 },
    { lbl: '19', darts: 9, hit: d => d.v === 19, pts: d => d.v === 19 ? d.score : 0 },
    { lbl: 'D20 · D16 · D8', darts: 9, hit: d => ['D20', 'D16', 'D8'].includes(d.key), pts: d => ['D20', 'D16', 'D8'].includes(d.key) ? d.score : 0 },
    { lbl: 'Bull', darts: 9, hit: d => d.v === 25, pts: d => d.v === 25 ? d.score : 0 }
  ];
  function startWarmup(profile) {
    const st = { bIdx: 0, dartNo: 0, points: 0, hits: 0, darts: 0, over: false };
    const total = WARM_BLOCKS.reduce((a, b) => a + b.darts, 0);
    trainShell(profile, 'warmup', {
      st, title: t('tr_warmup'),
      label: () => WARM_BLOCKS[st.bIdx] ? WARM_BLOCKS[st.bIdx].lbl : '✓',
      status: () => t('block') + ' ' + (st.bIdx + 1) + '/' + WARM_BLOCKS.length + ' · '
        + (WARM_BLOCKS[st.bIdx] ? WARM_BLOCKS[st.bIdx].darts - st.dartNo : 0) + ' ' + t('darts_left')
        + ' · ' + st.points + ' ' + t('points'),
      progress: () => st.darts / total,
      dart(d) {
        const b = WARM_BLOCKS[st.bIdx];
        st.dartNo++; st.darts++;
        if (b.hit(d)) { st.hits++; st.points += b.pts(d); }
        const ev = {};
        if (st.dartNo >= b.darts) {
          st.dartNo = 0; st.bIdx++;
          if (st.bIdx >= WARM_BLOCKS.length) ev.sessionEnd = true;
          else ev.toast = t('block') + ' ' + (st.bIdx + 1) + ': ' + WARM_BLOCKS[st.bIdx].lbl;
        }
        return ev;
      },
      summary: () => ({
        value: st.points, unit: ' ' + t('points'),
        lines: [[t('hits'), st.hits + ' / ' + total], [t('hit_rate'), Math.round((st.hits / total) * 100) + ' %']]
      })
    }, () => startWarmup(profile));
  }

  /* ---------- Rundlauf-Countdown (auf Zeit) ---------- */
  function startRundlauf(profile, secs) {
    const st = { num: 1, laps: 0, done: 0, darts: 0, over: false };
    trainShell(profile, 'rundlauf', {
      st, title: t('tr_round'), timeLimit: secs,
      label: () => String(st.num),
      status: () => t('fields_done') + ': ' + st.done + ' · ' + t('laps') + ': ' + st.laps + ' · ' + st.darts + ' Darts',
      progress: () => (st.num - 1) / 20,
      dart(d) {
        st.darts++;
        const ev = {};
        if (d.v === st.num) {
          st.done++; st.num++;
          if (st.num > 20) { st.num = 1; st.laps++; ev.toast = '🏁 ' + t('laps') + ' ' + st.laps; }
          else ev.toast = '✓ ' + st.done;
        }
        return ev;
      },
      summary: () => ({
        value: st.done, unit: ' ' + t('fields_done'),
        lines: [
          [t('laps'), st.laps],
          ['Darts', st.darts],
          [t('per_target'), st.done ? UI.f1(st.darts / st.done) : '–']
        ]
      })
    }, () => startRundlauf(profile, secs));
  }
  function configRundlauf(profile) {
    const s = sel([['120', '2 min'], ['180', '3 min'], ['300', '5 min']], '180');
    ask(t('tr_round'), [{ label: t('time'), el: s }],
      () => startRundlauf(profile, parseInt(s.value, 10)));
  }

  /* ---------- Mulligan ---------- */
  const MUL_SEQ = [20, 19, 18, 17, 16, 15, 25];
  function startMulligan(profile, mull) {
    const st = { idx: 0, dartNo: 0, roundMarks: 0, marks: 0, mull, over: false };
    trainShell(profile, 'mulligan', {
      st, title: t('tr_mulligan'),
      label: () => { const v = MUL_SEQ[st.idx]; return v === undefined ? '✓' : v === 25 ? 'Bull' : String(v); },
      status: () => t('marks') + ': ' + st.marks + ' · ' + t('mulligans') + ': ' + st.mull,
      progress: () => st.idx / MUL_SEQ.length,
      dart(d) {
        const tgt = MUL_SEQ[st.idx];
        st.dartNo++;
        if (d.v === tgt) st.roundMarks += marksOf(d);
        const ev = {};
        if (st.dartNo >= 3) {
          if (st.roundMarks === 0) {
            st.mull--;
            ev.toast = t('mulligan_used') + ' (' + Math.max(0, st.mull) + ')';
          } else {
            st.marks += st.roundMarks;
            ev.toast = '+' + st.roundMarks + ' → ' + st.marks;
          }
          st.dartNo = 0; st.roundMarks = 0; st.idx++;
          if (st.mull < 0 || st.idx >= MUL_SEQ.length) ev.sessionEnd = true;
        }
        return ev;
      },
      summary: () => ({
        value: st.marks, unit: ' ' + t('marks'),
        lines: [
          [t('reached'), (MUL_SEQ[Math.min(st.idx, MUL_SEQ.length - 1)] === 25 ? 'Bull' : MUL_SEQ[Math.min(st.idx, MUL_SEQ.length - 1)])],
          [t('mulligans'), Math.max(0, st.mull)]
        ]
      })
    }, () => startMulligan(profile, mull));
  }
  function configMulligan(profile) {
    const m = sel([['1', '1 Mulligan'], ['3', '3 Mulligans'], ['5', '5 Mulligans']], '3');
    ask(t('tr_mulligan'), [{ label: t('mulligans'), el: m }],
      () => startMulligan(profile, parseInt(m.value, 10)));
  }

  /* ============================================================
     REGISTRIERUNG
     ============================================================ */

  [
    /* Checkout & Doppel */
    { id: 'c121', cat: 'co', badge: '121', name: 'tr_121', desc: 'tr_121_d', go: config121 },
    { id: 'dkiller', cat: 'co', badge: 'DK', name: 'tr_dkiller', desc: 'tr_dkiller_d', go: configDKiller },
    { id: 'co_speed', cat: 'co', badge: '⏱', name: 'tr_speed', desc: 'tr_speed_d', go: configSpeedCo },

    /* Scoring & Präzision */
    { id: 'highscore', cat: 'score', badge: 'HS', name: 'tr_high', desc: 'tr_high_d', go: configHighScore, unit: ' Ø' },
    { id: 't20streak', cat: 'score', badge: 'T+', name: 'tr_streak', desc: 'tr_streak_d', go: configStreak },
    { id: 'five_in_five', cat: 'score', badge: '51', name: 'tr_51', desc: 'tr_51_d', go: configFive },
    { id: 'splitscore', cat: 'score', badge: 'SP', name: 'tr_split', desc: 'tr_split_d', go: startSplit },
    { id: 'bull_tr', cat: 'score', badge: 'BUL', name: 'tr_bull', desc: 'tr_bull_d', go: configBull },
    { id: 'tictactoe', cat: 'score', badge: 'TTT', name: 'tr_ttt', desc: 'tr_ttt_d', go: startTTT, unit: ' Darts' },

    /* Klassiker */
    { id: 'atc_solo', cat: 'classic', badge: 'AC', name: 'tr_atc', desc: 'tr_atc_d', go: configAtcSolo, unit: ' Darts' },
    { id: 'shanghai_tr', cat: 'classic', badge: 'SH', name: 'tr_shanghai', desc: 'tr_shanghai_d', go: configShanghaiTr },
    { id: 'cricket_solo', cat: 'classic', badge: 'CR', name: 'tr_cricket', desc: 'tr_cricket_d', go: startCricketSolo, unit: ' Darts' },
    { id: 'halve_solo', cat: 'classic', badge: '½', name: 'tr_halve', desc: 'tr_halve_d', go: startHalveSolo },
    { id: 'dragon', cat: 'classic', badge: 'CD', name: 'tr_dragon', desc: 'tr_dragon_d', go: startDragon, unit: ' Darts' },
    { id: 'nine_lives', cat: 'classic', badge: '9L', name: 'tr_lives', desc: 'tr_lives_d', go: startNineLives },

    /* Warm-up & Routinen */
    { id: 'warmup', cat: 'warm', badge: 'WU', name: 'tr_warmup', desc: 'tr_warmup_d', go: startWarmup },
    { id: 'rundlauf', cat: 'warm', badge: 'RL', name: 'tr_round', desc: 'tr_round_d', go: configRundlauf },
    { id: 'mulligan', cat: 'warm', badge: 'MU', name: 'tr_mulligan', desc: 'tr_mulligan_d', go: configMulligan }
  ].forEach(Training.register);

})();
