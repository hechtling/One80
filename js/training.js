/* One80 – Trainingsmodi mit generischem Session-Runner */
const Training = (() => {

  const BOGEY = [159, 162, 163, 165, 166, 168, 169];
  const dispKey = k => k === 'DB' ? 'Bull' : k === 'SB' ? '25' : k;

  function mergeDoubles(profile, perD) {
    for (const k in perD) {
      const t2 = profile.agg.doubles[k] = profile.agg.doubles[k] || { a: 0, h: 0 };
      t2.a += perD[k].a; t2.h += perD[k].h;
    }
  }

  // Checkout-Aufgabe: Bust = Dart verschenkt, Rest bleibt stehen
  function coDart(task, d, maxDarts) {
    task.darts++;
    const ns = task.rem - d.score;
    if (ns === 0 && (d.m === 2)) { task.rem = 0; task.done = true; task.success = true; }
    else if (ns >= 2) task.rem = ns;
    if (!task.done && task.darts >= maxDarts) task.done = true;
    return task;
  }
  function trackCoDouble(st, task, d) {
    if (DartMath.oneDartFinish(task.rem, 'double')) {
      const fk = DartMath.finKey(task.rem, 'double');
      const dd = st.perD[fk] = st.perD[fk] || { a: 0, h: 0 };
      dd.a++;
      if (d.key === fk) dd.h++;
    }
  }

  /* ---------- generischer Trainings-Screen ---------- */
  function trainShell(profile, mode, session, restart) {
    App.gameMode(true); UI.wakeLock(true);
    const hist = [];
    App.show(view => {
      const wrap = h('div', { class: 'mwrap' });
      view.appendChild(wrap);
      wrap.appendChild(h('div', { class: 'mtop' },
        h('button', {
          class: 'cbtn', onClick: () => UI.confirm(t('quit_training_q'), () => { cleanup(); App.root('training'); })
        }, '✕'),
        h('div', { class: 'mmeta' }, h('b', null, session.title), ' · ' + profile.name),
        h('button', { class: 'cbtn', onClick: doUndo }, '⌫')));
      const taskCard = h('div', { class: 'mcard center', style: 'gap:6px;padding:20px' });
      const inpHost = h('div', { style: 'margin-top:auto;display:flex;flex-direction:column' });
      wrap.append(taskCard, inpHost);
      Input.create(inpHost, {
        modes: ['board', 'keys'],
        mode: Store.state.settings.input === 'sum' ? 'board' : Store.state.settings.input,
        onDart: d => {
          if (session.st.over) return;
          hist.push(JSON.stringify(session.st)); if (hist.length > 60) hist.shift();
          const ev = session.dart(d) || {};
          if (ev.toast) UI.toast(ev.toast);
          if (ev.say) UI.say(ev.say);
          update();
          if (ev.sessionEnd) { session.st.over = true; finish(); }
        },
        onUndo: doUndo
      });
      function doUndo() {
        if (!hist.length || session.st.over) return;
        const s = JSON.parse(hist.pop());
        Object.keys(session.st).forEach(k => delete session.st[k]);
        Object.assign(session.st, s);
        update();
      }
      function update() {
        taskCard.innerHTML = '';
        taskCard.appendChild(h('div', { class: 'sub' }, session.status()));
        taskCard.appendChild(h('div', { style: 'font-size:44px;font-weight:700;letter-spacing:-1px;margin:2px 0' }, session.label()));
        const pr = Math.min(1, session.progress());
        taskCard.appendChild(h('div', { class: 'bar', style: 'margin-top:6px' }, h('i', { style: `width:${pr * 100}%` })));
      }
      function cleanup() { App.gameMode(false); UI.wakeLock(false); }
      function finish() {
        const sum = session.summary();
        const prev = profile.trainings[mode] ? profile.trainings[mode].best : null;
        Store.addTraining(profile, mode, sum.value, sum.higherBetter !== false);
        if (sum.apply) sum.apply();
        Stats.afterTraining(profile, sum.ctx || {});
        Store.save();
        UI.sfx.win();
        const body = h('div', null,
          h('div', { class: 'center', style: 'font-size:38px;font-weight:700;margin:6px 0' }, sum.value + (sum.unit || '')),
          prev !== null ? h('div', { class: 'center sub' }, t('prev_best') + ': ' + prev + (sum.unit || '')) : null,
          h('div', { style: 'margin-top:10px' },
            (sum.lines || []).map(l => h('div', { class: 'toggline' }, h('span', { class: 'sub' }, l[0]), h('span', { style: 'font-weight:700' }, String(l[1]))))));
        UI.modal({
          title: session.title, body, dismiss: false,
          buttons: [
            { label: t('done'), onClick: () => { cleanup(); App.root('training'); } },
            { label: t('again'), cls: 'sec', onClick: () => { cleanup(); restart(); } }
          ]
        });
      }
      update();
    });
  }

  /* ---------- Doppel-Runde ---------- */
  function startDoubles(profile) {
    const seq = [];
    for (let n = 1; n <= 20; n++) seq.push('D' + n);
    seq.push('DB');
    const st = { seq, idx: 0, dartNo: 0, hits: 0, darts: 0, perD: {}, over: false };
    trainShell(profile, 'doubles', {
      st, title: t('tr_doubles'),
      label: () => dispKey(st.seq[st.idx] || ''),
      status: () => t('hits') + ': ' + st.hits + ' / ' + st.darts,
      progress: () => st.idx / st.seq.length,
      dart(d) {
        const key = st.seq[st.idx];
        st.darts++; st.dartNo++;
        const dd = st.perD[key] = st.perD[key] || { a: 0, h: 0 };
        dd.a++;
        let ev = {};
        if (d.key === key) { st.hits++; dd.h++; ev.toast = '✓ ' + dispKey(key); }
        if (st.dartNo >= 3) { st.dartNo = 0; st.idx++; }
        if (st.idx >= st.seq.length) ev.sessionEnd = true;
        return ev;
      },
      summary() {
        const pct = Math.round((st.hits / st.darts) * 100);
        return {
          value: pct, unit: ' %',
          lines: [[t('hits'), st.hits + ' / ' + st.darts]],
          apply: () => mergeDoubles(profile, st.perD),
          ctx: { doubles50: pct >= 50 && st.darts >= 21 }
        };
      }
    }, () => startDoubles(profile));
  }

  /* ---------- gezieltes Doppel ---------- */
  function startDoubleSingle(profile, key, max) {
    const st = { key, max, darts: 0, hits: 0, perD: {}, over: false };
    trainShell(profile, 'double_single', {
      st, title: t('tr_double_single'),
      label: () => dispKey(st.key),
      status: () => st.hits + ' / ' + st.darts + ' · ' + (st.max - st.darts) + ' ' + t('darts_left'),
      progress: () => st.darts / st.max,
      dart(d) {
        st.darts++;
        const dd = st.perD[st.key] = st.perD[st.key] || { a: 0, h: 0 };
        dd.a++;
        const ev = {};
        if (d.key === st.key) { st.hits++; dd.h++; ev.toast = '✓'; }
        if (st.darts >= st.max) ev.sessionEnd = true;
        return ev;
      },
      summary() {
        const pct = Math.round((st.hits / st.darts) * 100);
        return {
          value: pct, unit: ' %',
          lines: [[dispKey(st.key), st.hits + ' / ' + st.darts]],
          apply: () => mergeDoubles(profile, st.perD),
          ctx: { doubles50: pct >= 50 && st.darts >= 20 }
        };
      }
    }, () => startDoubleSingle(profile, key, max));
  }

  function configDoubleSingle(profile) {
    const sel = h('select', null,
      Array.from({ length: 20 }, (_, i) => h('option', { value: 'D' + (20 - i) }, 'D' + (20 - i))),
      h('option', { value: 'DB' }, 'Bull'));
    const segD = h('select', null, [21, 30, 60].map(n => h('option', { value: n }, n + ' Darts')));
    UI.modal({
      title: t('tr_double_single'),
      body: h('div', null,
        h('label', { class: 'fld' }, t('which_double'), sel),
        h('label', { class: 'fld' }, t('how_many_darts'), segD)),
      buttons: [
        { label: t('cancel'), cls: 'sec' },
        { label: t('start_btn'), onClick: () => startDoubleSingle(profile, sel.value, parseInt(segD.value, 10)) }
      ]
    });
  }

  /* ---------- Checkout-Trainer ---------- */
  function randFinish() {
    let v;
    do { v = 41 + Math.floor(Math.random() * 130); } while (BOGEY.includes(v));
    return v;
  }
  function startCheckout(profile) {
    const st = { count: 10, idx: 0, task: { rem: randFinish(), start: 0, darts: 0, done: false, success: false }, results: [], perD: {}, over: false };
    st.task.start = st.task.rem;
    trainShell(profile, 'checkout', {
      st, title: t('tr_checkout'),
      label: () => String(st.task.rem),
      status: () => {
        const route = DartMath.checkout(st.task.rem, 9 - st.task.darts > 3 ? 3 : Math.max(1, 9 - st.task.darts), 'double');
        return t('task_x_of', { a: st.idx + 1, b: st.count }) + ' · ' + (9 - st.task.darts) + ' Darts' +
          (route ? ' · ' + route.map(UI.dartLabel).join(' ') : '');
      },
      progress: () => st.idx / st.count,
      dart(d) {
        trackCoDouble(st, st.task, d);
        coDart(st.task, d, 9);
        const ev = {};
        if (st.task.done) {
          st.results.push(st.task.success);
          ev.toast = st.task.success ? '✓ ' + t('checked') : '✗ ' + t('failed');
          if (st.task.success) ev.say = 'Game shot!';
          st.idx++;
          if (st.idx >= st.count) ev.sessionEnd = true;
          else st.task = { rem: randFinish(), start: 0, darts: 0, done: false, success: false };
        }
        return ev;
      },
      summary() {
        const ok = st.results.filter(Boolean).length;
        return {
          value: Math.round((ok / st.count) * 100), unit: ' %',
          lines: [[t('checked'), ok + ' / ' + st.count]],
          apply: () => mergeDoubles(profile, st.perD),
          ctx: {}
        };
      }
    }, () => startCheckout(profile));
  }

  /* ---------- 170-Leiter ---------- */
  function ladderStep(lvl, dir) {
    let v = lvl + dir;
    while (BOGEY.includes(v)) v += dir;
    return Math.max(41, Math.min(170, v));
  }
  function startLadder(profile) {
    const start = profile.ladderLevel || 61;
    const st = {
      level: start, attempts: 0, max: 10, wins: 0,
      task: { rem: start, darts: 0, done: false, success: false }, perD: {}, over: false
    };
    trainShell(profile, 'ladder', {
      st, title: t('tr_ladder'),
      label: () => String(st.task.rem),
      status: () => t('level') + ' ' + st.level + ' · ' + t('task_x_of', { a: st.attempts + 1, b: st.max }) + ' · ' + (9 - st.task.darts) + ' Darts',
      progress: () => st.attempts / st.max,
      dart(d) {
        trackCoDouble(st, st.task, d);
        coDart(st.task, d, 9);
        const ev = {};
        if (st.task.done) {
          st.attempts++;
          if (st.task.success) { st.wins++; st.level = ladderStep(st.level, 1); ev.toast = '↑ ' + t('level') + ' ' + st.level; ev.say = 'Game shot!'; }
          else { st.level = ladderStep(st.level, -1); ev.toast = '↓ ' + t('level') + ' ' + st.level; }
          if (st.attempts >= st.max) ev.sessionEnd = true;
          else st.task = { rem: st.level, darts: 0, done: false, success: false };
        }
        return ev;
      },
      summary() {
        return {
          value: st.level, unit: '',
          lines: [[t('checked'), st.wins + ' / ' + st.max], [t('level'), start + ' → ' + st.level]],
          apply: () => { profile.ladderLevel = st.level; mergeDoubles(profile, st.perD); },
          ctx: {}
        };
      }
    }, () => startLadder(profile));
  }

  /* ---------- Scoring ---------- */
  function startScoring(profile, target, visits) {
    const st = { target, visits, visitIdx: 0, dartNo: 0, points: 0, hitT: 0, hitOther: 0, miss: 0, over: false };
    const tl = target === 25 ? 'Bull' : 'T' + target;
    trainShell(profile, 'scoring', {
      st, title: t('tr_scoring'),
      label: () => tl,
      status: () => t('round_x_of', { a: st.visitIdx + 1, b: st.visits }) + ' · ' + st.points + ' ' + t('points'),
      progress: () => st.visitIdx / st.visits,
      dart(d) {
        st.dartNo++;
        if (d.v === st.target) {
          st.points += d.score;
          if ((st.target !== 25 && d.m === 3) || (st.target === 25 && d.m === 2)) st.hitT++;
          else st.hitOther++;
        } else st.miss++;
        const ev = {};
        if (st.dartNo >= 3) { st.dartNo = 0; st.visitIdx++; }
        if (st.visitIdx >= st.visits) ev.sessionEnd = true;
        return ev;
      },
      summary() {
        const ppr = Math.round((st.points / st.visits) * 10) / 10;
        return {
          value: ppr, unit: ' PPR',
          lines: [
            [t('points'), st.points],
            [st.target === 25 ? 'Bullseye' : 'Triple', st.hitT],
            [t('number_hit'), st.hitOther],
            [t('missed'), st.miss]
          ],
          ctx: {}
        };
      }
    }, () => startScoring(profile, target, visits));
  }

  function configScoring(profile) {
    const sel = h('select', null, [20, 19, 18, 17, 16, 25].map(n => h('option', { value: n }, n === 25 ? 'Bull' : 'T' + n)));
    const selV = h('select', null, [10, 20, 30].map(n => h('option', { value: n }, n + ' ' + t('rounds'))));
    UI.modal({
      title: t('tr_scoring'),
      body: h('div', null,
        h('label', { class: 'fld' }, t('target'), sel),
        h('label', { class: 'fld' }, t('rounds'), selV)),
      buttons: [
        { label: t('cancel'), cls: 'sec' },
        { label: t('start_btn'), onClick: () => startScoring(profile, parseInt(sel.value, 10), parseInt(selV.value, 10)) }
      ]
    });
  }

  /* ---------- Bob's 27 ---------- */
  function startBobs(profile) {
    const seq = [];
    for (let n = 1; n <= 20; n++) seq.push('D' + n);
    seq.push('DB');
    const st = { seq, idx: 0, dartNo: 0, roundHits: 0, score: 27, dead: false, perD: {}, over: false };
    const dval = key => key === 'DB' ? 50 : 2 * parseInt(key.slice(1), 10);
    trainShell(profile, 'bobs27', {
      st, title: "Bob's 27",
      label: () => dispKey(st.seq[st.idx] || ''),
      status: () => t('points') + ': ' + st.score,
      progress: () => st.idx / st.seq.length,
      dart(d) {
        const key = st.seq[st.idx];
        st.dartNo++;
        const dd = st.perD[key] = st.perD[key] || { a: 0, h: 0 };
        dd.a++;
        if (d.key === key) { st.roundHits++; dd.h++; }
        const ev = {};
        if (st.dartNo >= 3) {
          if (st.roundHits > 0) { st.score += st.roundHits * dval(key); ev.toast = '+' + (st.roundHits * dval(key)) + ' → ' + st.score; }
          else { st.score -= dval(key); ev.toast = '−' + dval(key) + ' → ' + st.score; }
          st.dartNo = 0; st.roundHits = 0; st.idx++;
          if (st.score < 1) { st.dead = true; ev.sessionEnd = true; }
          else if (st.idx >= st.seq.length) ev.sessionEnd = true;
        }
        return ev;
      },
      summary() {
        const survived = !st.dead && st.idx >= st.seq.length;
        return {
          value: Math.max(0, st.score), unit: '',
          lines: [[t('survived'), survived ? '✓' : '✗ (' + dispKey(st.seq[Math.min(st.idx, st.seq.length - 1)]) + ')']],
          apply: () => mergeDoubles(profile, st.perD),
          ctx: { bobSurvive: survived }
        };
      }
    }, () => startBobs(profile));
  }

  /* ---------- JDC Challenge ---------- */
  function startJDC(profile) {
    const st = {
      phase: 1, total: 0, over: false,
      p1: { targets: [20, 19, 18, 17, 16, 15, 25], idx: 0, dartNo: 0, pts: 0, f: { s: false, d: false, t: false } },
      p2: { seq: ['D20', 'D16', 'D12', 'D8', 'D4', 'DB'], idx: 0, dartNo: 0, hits: 0 },
      p3: { rem: 501, darts: 0, done: false, pts: 0 }
    };
    const phaseName = () => st.phase === 1 ? 'Shanghai' : st.phase === 2 ? 'Doubles' : '501';
    trainShell(profile, 'jdc', {
      st, title: 'JDC Challenge',
      label: () => {
        if (st.phase === 1) { const v = st.p1.targets[st.p1.idx]; return v === 25 ? 'Bull' : String(v); }
        if (st.phase === 2) return dispKey(st.p2.seq[st.p2.idx]);
        return String(st.p3.rem);
      },
      status: () => t('phase') + ' ' + st.phase + '/3 – ' + phaseName() + ' · ' + st.total + ' ' + t('points') +
        (st.phase === 3 ? ' · ' + (30 - st.p3.darts) + ' Darts' : ''),
      progress: () => st.phase === 1 ? st.p1.idx / 21 : st.phase === 2 ? (7 + st.p2.idx) / 16 : (13 + Math.min(3, st.p3.darts / 10)) / 16,
      dart(d) {
        const ev = {};
        if (st.phase === 1) {
          const tgt = st.p1.targets[st.p1.idx];
          st.p1.dartNo++;
          if (d.v === tgt) {
            st.p1.pts += d.score; st.total += d.score;
            if (d.m === 1) st.p1.f.s = true;
            if (d.m === 2) st.p1.f.d = true;
            if (d.m === 3) st.p1.f.t = true;
          }
          if (st.p1.dartNo >= 3) {
            if (st.p1.f.s && st.p1.f.d && st.p1.f.t && tgt !== 25) { st.total += 100; ev.toast = 'Shanghai! +100'; ev.say = 'Shanghai!'; }
            st.p1.dartNo = 0; st.p1.f = { s: false, d: false, t: false }; st.p1.idx++;
            if (st.p1.idx >= st.p1.targets.length) { st.phase = 2; ev.toast = t('phase') + ' 2: Doubles'; }
          }
        } else if (st.phase === 2) {
          const key = st.p2.seq[st.p2.idx];
          st.p2.dartNo++;
          if (d.key === key) { st.p2.hits++; st.total += 50; ev.toast = '+50'; }
          if (st.p2.dartNo >= 3) {
            st.p2.dartNo = 0; st.p2.idx++;
            if (st.p2.idx >= st.p2.seq.length) { st.phase = 3; ev.toast = t('phase') + ' 3: 501'; }
          }
        } else {
          const task = { rem: st.p3.rem, darts: 0, done: false, success: false };
          coDart(task, d, 99);
          st.p3.rem = task.rem;
          st.p3.darts++;
          if (task.success) {
            const n = st.p3.darts;
            st.p3.pts = n <= 12 ? 500 : n <= 15 ? 400 : n <= 18 ? 300 : n <= 21 ? 200 : n <= 24 ? 120 : n <= 27 ? 60 : 30;
            st.total += st.p3.pts;
            ev.say = 'Game shot!';
            ev.sessionEnd = true;
          } else if (st.p3.darts >= 30) ev.sessionEnd = true;
        }
        return ev;
      },
      summary() {
        return {
          value: st.total, unit: ' Pkt.',
          lines: [
            ['Shanghai', st.p1.pts],
            ['Doubles', st.p2.hits + ' × 50'],
            ['501', st.p3.pts + ' (' + st.p3.darts + ' Darts)']
          ],
          ctx: { jdcScore: st.total }
        };
      }
    }, () => startJDC(profile));
  }

  /* ---------- Catch 40 ---------- */
  function startCatch(profile, from, to) {
    const st = {
      from, to, cur: from, catches: 0, total: to - from + 1,
      task: { rem: from, darts: 0, done: false, success: false }, perD: {}, over: false
    };
    trainShell(profile, 'catch40', {
      st, title: 'Catch 40',
      label: () => String(st.task.rem),
      status: () => t('checkout') + ' ' + st.cur + ' / ' + st.to + ' · ' + t('caught') + ': ' + st.catches + ' · ' + (6 - st.task.darts) + ' Darts',
      progress: () => (st.cur - st.from) / st.total,
      dart(d) {
        trackCoDouble(st, st.task, d);
        coDart(st.task, d, 6);
        const ev = {};
        if (st.task.done) {
          if (st.task.success) { st.catches++; ev.toast = '✓ ' + t('caught'); }
          else ev.toast = '✗';
          st.cur++;
          if (st.cur > st.to) ev.sessionEnd = true;
          else st.task = { rem: st.cur, darts: 0, done: false, success: false };
        }
        return ev;
      },
      summary() {
        return {
          value: st.catches, unit: ' / ' + st.total,
          lines: [[t('range'), st.from + '–' + st.to]],
          apply: () => mergeDoubles(profile, st.perD),
          ctx: {}
        };
      }
    }, () => startCatch(profile, from, to));
  }

  function configCatch(profile) {
    const sel = h('select', null,
      h('option', { value: '61-80' }, '61–80 (20)'),
      h('option', { value: '81-100' }, '81–100 (20)'),
      h('option', { value: '61-100' }, '61–100 (40)'));
    UI.modal({
      title: 'Catch 40',
      body: h('label', { class: 'fld' }, t('range'), sel),
      buttons: [
        { label: t('cancel'), cls: 'sec' },
        { label: t('start_btn'), onClick: () => { const [a, b] = sel.value.split('-').map(Number); startCatch(profile, a, b); } }
      ]
    });
  }

  /* ---------- Trainings-Tab ---------- */

  const TRAIN_DEFS = [
    { id: 'checkout', badge: 'CO', name: 'tr_checkout', desc: 'tr_checkout_d', go: startCheckout },
    { id: 'scoring', badge: 'T20', name: 'tr_scoring', desc: 'tr_scoring_d', go: configScoring },
    { id: 'doubles', badge: 'D', name: 'tr_doubles', desc: 'tr_doubles_d', go: startDoubles },
    { id: 'bobs27', badge: '27', name: 'tr_bobs', desc: 'tr_bobs_d', go: startBobs },
    { id: 'double_single', badge: 'D+', name: 'tr_double_single', desc: 'tr_double_single_d', go: configDoubleSingle },
    { id: 'ladder', badge: '170', name: 'tr_ladder', desc: 'tr_ladder_d', go: startLadder },
    { id: 'jdc', badge: 'JDC', name: 'tr_jdc', desc: 'tr_jdc_d', go: startJDC },
    { id: 'catch40', badge: 'C40', name: 'tr_catch', desc: 'tr_catch_d', go: configCatch }
  ];

  function trainProfile() {
    const id = Store.state.settings.trainProfile;
    return Store.profile(id) || Store.state.profiles[0] || null;
  }

  function renderTab(view) {
    view.appendChild(h('h1', { style: 'margin-bottom:4px' }, t('nav_training')));
    view.appendChild(h('div', { class: 'sub', style: 'margin:0 4px 14px;font-size:13px' }, t('train_sub')));
    if (!Store.state.profiles.length) {
      view.appendChild(h('div', { class: 'card center' },
        h('div', { class: 'sub', style: 'margin-bottom:12px' }, t('need_profile_train')),
        h('button', { class: 'btn', onClick: () => App.editProfile(null, () => App.rerender()) }, '+ ' + t('new_profile'))));
      return;
    }
    const cur = trainProfile();
    const chipRow = h('div', { style: 'margin-bottom:8px;display:flex;flex-wrap:wrap' });
    Store.state.profiles.forEach(p => {
      chipRow.appendChild(h('span', {
        class: 'chip' + (cur && p.id === cur.id ? ' on' : ''),
        onClick: () => { Store.state.settings.trainProfile = p.id; Store.save(); App.rerender(); }
      }, UI.avatar(p.name), p.name));
    });
    view.appendChild(chipRow);
    if (cur) {
      const streak = Store.trainStreak(cur);
      if (streak > 0) view.appendChild(h('div', { class: 'sub', style: 'margin:0 4px 10px;color:var(--grn)' }, t('streak_days', { n: streak })));
    }
    TRAIN_DEFS.forEach(m => {
      const tr = cur && cur.trainings[m.id];
      const last = tr && tr.series && tr.series.length ? tr.series[tr.series.length - 1].v : null;
      view.appendChild(h('div', { class: 'mrow', onClick: () => { if (cur) m.go(cur); } },
        h('span', { class: 'badge' }, m.badge),
        h('span', { class: 'mtxt' },
          h('span', { class: 'ttl', style: 'font-size:15px' }, t(m.name)),
          h('span', { class: 'dsc' }, t(m.desc))),
        tr && tr.best !== null
          ? h('span', { class: 'meta' }, (last !== null && last !== tr.best ? t('last_lbl') + ': ' + last : 'Best: ' + tr.best))
          : h('span', { class: 'chev' }, '›')));
    });
  }

  return { renderTab, TRAIN_DEFS };
})();
