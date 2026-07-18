/* One80 – Spielmodi: X01 (mit Bot), Cricket, Around the Clock, Shanghai, Killer, Halve It */
const Games = (() => {

  function gauss(mean, sd) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* ================= X01 ENGINE ================= */

  function newX01(cfg) {
    return {
      kind: 'x01', cfg,
      players: cfg.players.map(p => ({
        name: p.name, profileId: p.profileId || null, bot: p.bot || null, emoji: p.emoji || '👤',
        score: cfg.start, legs: 0, sets: 0, legsTotal: 0, opened: !cfg.din,
        darts: 0, points: 0, f9d: 0, f9p: 0,
        n180: 0, n140: 0, n100: 0, n60: 0,
        coHits: 0, coAtt: 0, hiFinish: 0, bestLeg: 0,
        legDarts: 0, visitNo: 0, visitStart: cfg.start, visitDarts: [], visitPoints: 0,
        doubles: {}, heat: {}, dbFinish: false
      })),
      cur: 0, legStarter: 0, over: false, winnerIdx: null,
      legsToWin: Math.ceil(cfg.legs / 2), setsToWin: Math.ceil(cfg.sets / 2),
      legNo: 1
    };
  }

  function validFinalDart(d, out) {
    if (out === 'straight') return d.score > 0;
    if (out === 'master') return d.m === 2 || d.m === 3;
    return d.m === 2;
  }

  function x01Dart(st, d) {
    const p = st.players[st.cur], cfg = st.cfg;
    if (p.opened && DartMath.oneDartFinish(p.score, cfg.out)) {
      p.coAtt++;
      const fk = DartMath.finKey(p.score, cfg.out);
      if (fk && (fk[0] === 'D' || fk === 'DB')) {
        const dd = p.doubles[fk] = p.doubles[fk] || { a: 0, h: 0 };
        dd.a++;
        if (d.key === fk) dd.h++;
      }
    }
    p.heat[d.key] = (p.heat[d.key] || 0) + 1;
    let counted = d.score;
    if (!p.opened) {
      if (cfg.din && d.m === 2) p.opened = true;
      if (!p.opened) counted = 0;
    }
    p.visitDarts.push(d);
    p.darts++; p.legDarts++;
    let busted = false, finished = false;
    if (p.opened) {
      const ns = p.score - counted;
      if (ns < 0 || (cfg.out !== 'straight' && ns === 1) || (ns === 0 && !validFinalDart(d, cfg.out))) busted = true;
      else { p.score = ns; p.visitPoints += counted; if (ns === 0) finished = true; }
    }
    if (busted) return endVisit(st, true, false, p.visitDarts.length);
    if (finished) {
      p.coHits++;
      if (d.key === 'DB') p.dbFinish = true;
      p.hiFinish = Math.max(p.hiFinish, p.visitStart);
      return endVisit(st, false, true, p.visitDarts.length);
    }
    if (p.visitDarts.length >= 3) return endVisit(st, false, false, 3);
    return { visitEnd: false };
  }

  function endVisit(st, bust, finished, dartsUsed) {
    const p = st.players[st.cur];
    const total = bust ? 0 : p.visitPoints;
    p.points += total;
    if (p.visitNo < 3) { p.f9p += total; p.f9d += dartsUsed; }
    if (!bust) {
      if (total === 180) p.n180++;
      else if (total >= 140) p.n140++;
      else if (total >= 100) p.n100++;
      else if (total >= 60) p.n60++;
    }
    p.visitNo++;
    const ev = { visitEnd: true, visitTotal: total, bust, finished, playerIdx: st.cur };
    if (finished) {
      ev.leg = legWon(st);
    } else {
      p.visitDarts = []; p.visitPoints = 0; p.visitStart = p.score;
      st.cur = (st.cur + 1) % st.players.length;
      const q = st.players[st.cur];
      q.visitDarts = []; q.visitPoints = 0; q.visitStart = q.score;
    }
    return ev;
  }

  function legWon(st) {
    const w = st.players[st.cur];
    w.legs++; w.legsTotal++;
    w.bestLeg = w.bestLeg ? Math.min(w.bestLeg, w.legDarts) : w.legDarts;
    const result = { type: 'leg', winnerIdx: st.cur };
    if (w.legs >= st.legsToWin) {
      if (st.cfg.sets > 1) {
        w.sets++;
        st.players.forEach(p => p.legs = 0);
        if (w.sets >= st.setsToWin) { st.over = true; st.winnerIdx = st.cur; result.type = 'match'; }
        else result.type = 'set';
      } else { st.over = true; st.winnerIdx = st.cur; result.type = 'match'; }
    }
    if (!st.over) {
      st.legNo++;
      st.legStarter = (st.legStarter + 1) % st.players.length;
      st.cur = st.legStarter;
      st.players.forEach(p => {
        p.score = st.cfg.start; p.opened = !st.cfg.din; p.legDarts = 0; p.visitNo = 0;
        p.visitDarts = []; p.visitPoints = 0; p.visitStart = st.cfg.start;
      });
    }
    return result;
  }

  // Aufnahme als Summe (Rundensumme / Bot). opts: {finish, darts, atDouble, bust}
  function x01Sum(st, total, opts) {
    const p = st.players[st.cur];
    const used = opts.finish ? opts.darts : 3;
    if (!p.opened && total > 0 && !opts.bust) p.opened = true;
    p.darts += used; p.legDarts += used;
    p.coAtt += opts.atDouble || 0;
    if (opts.finish) {
      p.coHits++;
      p.hiFinish = Math.max(p.hiFinish, p.score);
      p.visitPoints = p.score;
      p.score = 0;
    } else if (!opts.bust) {
      p.visitPoints = total;
      p.score -= total;
    } else p.visitPoints = 0;
    return endVisit(st, !!opts.bust, !!opts.finish, used);
  }

  function botThink(st) {
    const p = st.players[st.cur], A = p.bot.avg, cfg = st.cfg;
    const route = DartMath.checkout(p.score, 3, cfg.out);
    if (route) {
      const base = Math.min(0.75, Math.max(0.06, (A - 25) / 90));
      const diff = p.score <= 40 ? 1 : p.score <= 70 ? 0.8 : p.score <= 110 ? 0.55 : 0.35;
      if (Math.random() < base * diff) return { finish: true, darts: route.length, atDouble: 1, total: p.score };
    }
    let s = Math.round(gauss(A, A * 0.33));
    s = Math.max(0, Math.min(180, s));
    while (!DartMath.validVisitTotal(s)) s--;
    if (cfg.out === 'straight') { if (s >= p.score) s = Math.max(0, p.score - 1); }
    else { let guard = 0; while (s > 0 && p.score - s < 2 && guard++ < 60) s = Math.max(0, s - (1 + Math.floor(Math.random() * 20))); }
    while (!DartMath.validVisitTotal(s)) s--;
    const atD = DartMath.oneDartFinish(p.score, cfg.out) ? 1 + Math.floor(Math.random() * 2) : 0;
    return { finish: false, darts: 3, atDouble: atD, total: s };
  }

  /* ================= X01 MATCH-SCREEN ================= */

  function startX01(cfg, onDone) { matchScreen(newX01(cfg), onDone); }

  function resumeActive() {
    const a = Store.state.active;
    if (a && a.kind === 'x01') matchScreen(a.st, null);
  }

  function matchScreen(st, onDone) {
    App.gameMode(true);
    UI.wakeLock(true);
    const hist = [];
    const isTournament = !!onDone;
    const persist = () => {
      if (!isTournament) { Store.state.active = { kind: 'x01', st }; Store.save(); }
    };
    persist();

    App.show(view => {
      const outLbl = { double: 'Double-Out', master: 'Master-Out', straight: 'Straight-Out' }[st.cfg.out];
      const sub2 = h('div', { class: 'sub2' });
      const head = h('div', { class: 'mhead' },
        h('button', { class: 'iconbtn', onClick: quit }, '✕'),
        h('div', { class: 'ttl' }, `${st.cfg.start} · ${outLbl}`, h('div', { class: 'sub2' }, sub2)),
        h('button', { class: 'iconbtn', onClick: () => showMatchInfo() }, 'ℹ')
      );
      const pc = h('div', { class: 'pcards ' + (st.players.length >= 2 ? 'n' + Math.min(st.players.length, 4) : '') });
      const visitEl = h('div', { class: 'visit' });
      const inpHost = h('div');
      view.append(head, pc, visitEl, inpHost);

      const inp = Input.create(inpHost, {
        modes: ['board', 'keys', 'sum'],
        mode: Store.state.settings.input,
        onDart: d => {
          if (st.over || st.players[st.cur].bot) return;
          snap();
          after(x01Dart(st, d));
        },
        onSum: total => { if (!st.over && !st.players[st.cur].bot) handleSum(total); },
        onUndo: undo
      });

      function snap() { hist.push(JSON.stringify(st)); if (hist.length > 50) hist.shift(); }

      function undo() {
        if (!hist.length || st.over) return;
        let s = JSON.parse(hist.pop());
        while (s.players[s.cur].bot && hist.length) s = JSON.parse(hist.pop());
        Object.keys(st).forEach(k => delete st[k]);
        Object.assign(st, s);
        persist(); update();
        if (st.players[st.cur].bot) maybeBot();
      }

      function handleSum(total) {
        const p = st.players[st.cur];
        const rem = p.score - total;
        if (total === p.score && DartMath.checkout(p.score, 3, st.cfg.out)) {
          let minD = 3;
          for (let n = 1; n <= 3; n++) { if (DartMath.checkout(p.score, n, st.cfg.out)) { minD = n; break; } }
          askNum(t('co_darts_q'), [1, 2, 3].filter(n => n >= minD), darts => {
            if (st.cfg.out === 'straight') { apply({ finish: true, darts, atDouble: 0 }); return; }
            askNum(t('co_atdouble_q'), [1, 2, 3].filter(n => n <= darts), atD => apply({ finish: true, darts, atDouble: atD }));
          });
          return;
        }
        if (rem < 0 || (st.cfg.out !== 'straight' && (rem === 1 || rem === 0))) {
          UI.toast(t('bust'));
          UI.sfx.bust();
          snap();
          after(x01Sum(st, 0, { bust: true }));
          return;
        }
        if (st.cfg.out !== 'straight' && DartMath.oneDartFinish(p.score, st.cfg.out)) {
          askNum(t('atdouble_q'), [0, 1, 2, 3], atD => apply({ atDouble: atD }));
        } else apply({ atDouble: 0 });

        function apply(opts) { snap(); after(x01Sum(st, total, opts)); }
      }

      function askNum(title, nums, cb) {
        const m = UI.modal({
          title,
          dismiss: false,
          body: h('div', { class: 'row' }, nums.map(n =>
            h('button', { class: 'btn sec', style: 'flex:1', onClick: () => { m.close(); cb(n); } }, String(n))
          ))
        });
      }

      function after(ev, fromBot) {
        persist();
        if (ev && ev.visitEnd) {
          if (ev.bust) { UI.sfx.bust(); UI.say('No score'); }
          else UI.callScore(ev.visitTotal);
        }
        update();
        if (ev && ev.leg) {
          const wname = st.players[ev.leg.winnerIdx].name;
          if (ev.leg.type === 'match') { finishMatch(); return; }
          UI.say('Game shot!');
          UI.modal({
            title: (ev.leg.type === 'set' ? '📦 ' + t('set_won', { n: wname }) : '🎯 ' + t('leg_won', { n: wname })),
            dismiss: false,
            buttons: [{ label: t('continue'), onClick: () => { update(); maybeBot(); } }]
          });
          return;
        }
        maybeBot();
      }

      function maybeBot() {
        if (st.over) return;
        const p = st.players[st.cur];
        if (!p.bot) { inp.setDisabled(false); return; }
        inp.setDisabled(true);
        setTimeout(() => {
          if (st.over || !st.players[st.cur].bot) return;
          snap();
          const b = botThink(st);
          after(x01Sum(st, b.total, b), true);
        }, 1200);
      }

      function update() {
        sub2.textContent = t('leg_no', { n: st.legNo }) + ' · Best of ' + st.cfg.legs +
          (st.cfg.sets > 1 ? ' Legs, Best of ' + st.cfg.sets + ' Sets' : '');
        pc.innerHTML = '';
        st.players.forEach((p, i) => {
          const dartsLeft = i === st.cur ? 3 - p.visitDarts.length : 3;
          const route = p.opened && p.score <= 170 && !st.over ? DartMath.checkout(p.score, dartsLeft, st.cfg.out) : null;
          const avg = p.darts ? (p.points / p.darts) * 3 : 0;
          pc.appendChild(h('div', { class: 'pcard' + (i === st.cur && !st.over ? ' turn' : '') },
            h('div', { class: 'nm' }, p.emoji + ' ' + p.name),
            h('div', { class: 'legs' }, st.cfg.sets > 1 ? `S:${p.sets} L:${p.legs}` : `Legs: ${p.legs}`),
            h('div', { class: 'sc' }, String(p.score)),
            h('div', { class: 'co' }, route ? route.join(' ') : (!p.opened && st.cfg.din ? t('need_double_in') : '')),
            h('div', { class: 'mini' }, 'Ø ' + UI.f1(avg) + ' · 🎯 ' + p.darts)
          ));
        });
        visitEl.innerHTML = '';
        const p = st.players[st.cur];
        for (let i = 0; i < 3; i++) {
          const d = p.visitDarts[i];
          visitEl.appendChild(h('div', { class: 'vslot' + (d ? '' : ' empty') }, d ? d.key : '·'));
        }
        visitEl.appendChild(h('div', { class: 'vtotal' }, String(p.visitPoints)));
      }

      function showMatchInfo() {
        const rows = st.players.map(p => {
          const avg = p.darts ? (p.points / p.darts) * 3 : 0;
          const f9 = p.f9d ? (p.f9p / p.f9d) * 3 : 0;
          const co = p.coAtt ? Math.round((p.coHits / p.coAtt) * 100) : 0;
          return h('tr', null,
            h('td', null, p.name), h('td', null, UI.f1(avg)), h('td', null, UI.f1(f9)),
            h('td', null, co + '%'), h('td', null, String(p.n180)));
        });
        UI.modal({
          title: t('match_stats'),
          body: h('table', { class: 'tbl' },
            h('tr', null, h('th', null, ''), h('th', null, 'Ø3'), h('th', null, 'First 9'), h('th', null, 'CO'), h('th', null, '180')),
            rows),
          buttons: [{ label: t('ok') }]
        });
      }

      function quit() {
        UI.confirm(t('quit_match_q'), () => {
          cleanup();
          if (isTournament) App.back();
          else App.root('play');
        });
      }

      function cleanup() {
        Store.state.active = null; Store.saveNow();
        App.gameMode(false); UI.wakeLock(false);
      }

      function finishMatch() {
        Store.state.active = null; Store.saveNow();
        UI.sfx.win();
        UI.say('Game shot, and the match!');
        Stats.recordX01Match(st);
        showSummary();
      }

      function showSummary() {
        App.show(sv => {
          const w = st.players[st.winnerIdx];
          sv.appendChild(h('div', { class: 'hero center' },
            h('div', { style: 'font-size:44px' }, '🏆'),
            h('div', { class: 'big' }, t('wins', { n: w.name })),
            h('div', { class: 'sub' }, st.cfg.sets > 1
              ? st.players.map(p => p.sets).join(' : ') + ' Sets'
              : st.players.map(p => p.legs).join(' : ') + ' Legs')
          ));
          const tb = h('table', { class: 'tbl' },
            h('tr', null, h('th', null, ''), h('th', null, 'Ø3'), h('th', null, 'F9'), h('th', null, 'CO%'),
              h('th', null, 'HiFin'), h('th', null, '180'), h('th', null, t('best_leg'))));
          st.players.forEach(p => {
            const avg = p.darts ? (p.points / p.darts) * 3 : 0;
            const f9 = p.f9d ? (p.f9p / p.f9d) * 3 : 0;
            tb.appendChild(h('tr', null,
              h('td', null, p.emoji + ' ' + p.name),
              h('td', null, UI.f1(avg)),
              h('td', null, UI.f1(f9)),
              h('td', null, p.coAtt ? Math.round((p.coHits / p.coAtt) * 100) + '%' : '–'),
              h('td', null, p.hiFinish || '–'),
              h('td', null, String(p.n180)),
              h('td', null, p.bestLeg || '–')
            ));
          });
          sv.appendChild(h('div', { class: 'card' }, tb));
          if (isTournament) {
            sv.appendChild(h('button', {
              class: 'btn', onClick: () => {
                App.gameMode(false); UI.wakeLock(false);
                onDone({ winnerIdx: st.winnerIdx, legs: st.players.map(p => p.legsTotal) });
              }
            }, t('continue')));
          } else {
            sv.appendChild(h('button', {
              class: 'btn', onClick: () => { App.gameMode(false); UI.wakeLock(false); App.root('play'); }
            }, t('done')));
            sv.appendChild(h('div', { style: 'height:10px' }));
            sv.appendChild(h('button', {
              class: 'btn sec', onClick: () => matchScreen(newX01(st.cfg), null)
            }, '↻ ' + t('rematch')));
          }
        });
      }

      update();
      maybeBot();
    });
  }

  /* ================= CASUAL-GAME-SHELL ================= */

  function nextTurn(st, skip) {
    st.visitDarts = [];
    let i = st.cur, guard = 0;
    do { i = (i + 1) % st.players.length; } while (skip && skip(i) && guard++ < st.players.length);
    st.cur = i;
  }

  function runCasual(game) {
    App.gameMode(true); UI.wakeLock(true);
    const hist = [];
    App.show(view => {
      const head = h('div', { class: 'mhead' },
        h('button', { class: 'iconbtn', onClick: quit }, '✕'),
        h('div', { class: 'ttl' }, game.title, h('div', { class: 'sub2' }, game.sub || ''))
      );
      const scoreEl = h('div');
      const inpHost = h('div');
      view.append(head, scoreEl, inpHost);
      Input.create(inpHost, {
        modes: ['board', 'keys'],
        mode: Store.state.settings.input === 'sum' ? 'board' : Store.state.settings.input,
        onDart: d => {
          if (game.st.over) return;
          hist.push(JSON.stringify(game.st)); if (hist.length > 50) hist.shift();
          UI.buzz(15);
          const ev = game.dart(game.st, d) || {};
          if (ev.toast) UI.toast(ev.toast);
          if (ev.say) UI.say(ev.say);
          update();
          if (game.st.over) finish();
        },
        onUndo: () => {
          if (!hist.length || game.st.over) return;
          const s = JSON.parse(hist.pop());
          Object.keys(game.st).forEach(k => delete game.st[k]);
          Object.assign(game.st, s);
          update();
        }
      });
      function update() { scoreEl.innerHTML = ''; game.render(game.st, scoreEl); }
      function cleanup() { App.gameMode(false); UI.wakeLock(false); }
      function quit() { UI.confirm(t('quit_match_q'), () => { cleanup(); App.root('play'); }); }
      function finish() {
        UI.sfx.win();
        const w = game.st.players[game.st.winnerIdx];
        Stats.recordCasual(game.mode, game.st.players, game.st.winnerIdx, game.flags ? game.flags(game.st) : {});
        UI.modal({
          title: '🏆 ' + t('wins', { n: w.name }),
          dismiss: false,
          buttons: [
            { label: t('done'), onClick: () => { cleanup(); App.root('play'); } },
            { label: '↻ ' + t('rematch'), cls: 'sec', onClick: () => { cleanup(); game.again(); } }
          ]
        });
      }
      update();
    });
  }

  const pRow = (p, active, extra) => h('div', { class: 'pcard' + (active ? ' turn' : ''), style: 'margin-bottom:8px' },
    h('div', { class: 'row' },
      h('div', { class: 'nm grow' }, p.emoji + ' ' + p.name),
      extra
    ));

  /* ================= CRICKET ================= */

  const CRICKET_KEYS = ['20', '19', '18', '17', '16', '15', '25'];

  function newCricket(cfg) {
    return {
      players: cfg.players.map(p => ({
        name: p.name, profileId: p.profileId || null, emoji: p.emoji || '👤',
        marks: Object.fromEntries(CRICKET_KEYS.map(k => [k, 0])), points: 0
      })),
      cut: cfg.cut, cur: 0, visitDarts: [], over: false, winnerIdx: null
    };
  }

  function cricketDart(st, d) {
    st.visitDarts.push(d.key);
    const p = st.players[st.cur];
    if ([15, 16, 17, 18, 19, 20, 25].includes(d.v)) {
      const k = String(d.v);
      let hits = d.v === 25 ? Math.min(d.m, 2) : d.m;
      while (hits > 0 && p.marks[k] < 3) { p.marks[k]++; hits--; }
      if (hits > 0) {
        const open = st.players.filter((q, i) => i !== st.cur && q.marks[k] < 3);
        if (open.length) {
          if (st.cut) open.forEach(q => q.points += d.v * hits);
          else p.points += d.v * hits;
        }
      }
    }
    const closedAll = q => CRICKET_KEYS.every(k => q.marks[k] >= 3);
    if (closedAll(p)) {
      const pts = st.players.map(q => q.points);
      const ok = st.cut ? p.points <= Math.min(...pts) : p.points >= Math.max(...pts);
      if (ok) { st.over = true; st.winnerIdx = st.cur; return {}; }
    }
    if (st.visitDarts.length >= 3) nextTurn(st);
    return {};
  }

  function renderCricket(st, el) {
    const MK = ['', '／', '✕', '⊗'];
    const tb = h('table', { class: 'tbl' });
    tb.appendChild(h('tr', null, h('th', null, ''),
      st.players.map((p, i) => h('th', { style: i === st.cur ? 'color:var(--accent)' : '' }, p.emoji + ' ' + p.name))));
    CRICKET_KEYS.forEach(k => {
      tb.appendChild(h('tr', null,
        h('td', { style: 'font-weight:700' }, k === '25' ? 'Bull' : k),
        st.players.map(p => h('td', { class: 'center', style: 'font-size:17px;' + (p.marks[k] >= 3 ? 'color:var(--green);font-weight:800' : '') }, MK[p.marks[k]]))
      ));
    });
    tb.appendChild(h('tr', null, h('td', { style: 'font-weight:700' }, t('points')),
      st.players.map(p => h('td', { class: 'center', style: 'font-weight:800;font-size:17px' }, String(p.points)))));
    el.appendChild(h('div', { class: 'card', style: 'padding:8px' }, tb));
    el.appendChild(h('div', { class: 'visit' },
      [0, 1, 2].map(i => h('div', { class: 'vslot' + (st.visitDarts[i] ? '' : ' empty') }, st.visitDarts[i] || '·'))));
  }

  /* ================= AROUND THE CLOCK ================= */

  function newATC(cfg) {
    const targets = [];
    for (let n = 1; n <= 20; n++) targets.push(n);
    if (cfg.bull && cfg.variant !== 'triple') targets.push(25);
    return {
      players: cfg.players.map(p => ({ name: p.name, profileId: p.profileId || null, emoji: p.emoji || '👤', idx: 0, darts: 0 })),
      targets, variant: cfg.variant, cur: 0, visitDarts: [], over: false, winnerIdx: null
    };
  }

  function atcDart(st, d) {
    st.visitDarts.push(d.key);
    const p = st.players[st.cur];
    const tgt = st.targets[p.idx];
    p.darts++;
    const hit = d.v === tgt && (st.variant === 'any' || (st.variant === 'double' && d.m === 2) || (st.variant === 'triple' && d.m === 3));
    const ev = {};
    if (hit) {
      p.idx++;
      if (p.idx >= st.targets.length) { st.over = true; st.winnerIdx = st.cur; return ev; }
    }
    if (st.visitDarts.length >= 3) nextTurn(st);
    return ev;
  }

  function renderATC(st, el) {
    const pref = st.variant === 'double' ? 'D' : st.variant === 'triple' ? 'T' : '';
    st.players.forEach((p, i) => {
      const tgt = st.targets[p.idx];
      el.appendChild(h('div', { class: 'pcard' + (i === st.cur ? ' turn' : ''), style: 'margin-bottom:8px' },
        h('div', { class: 'row' },
          h('div', { class: 'grow' },
            h('div', { class: 'nm' }, p.emoji + ' ' + p.name),
            h('div', { class: 'mini' }, `${p.idx} / ${st.targets.length} · 🎯 ${p.darts}`)),
          h('div', { class: 'sc' }, tgt !== undefined ? (pref + (tgt === 25 ? 'Bull' : tgt)) : '✔')
        ),
        h('div', { class: 'bar', style: 'margin-top:6px' }, h('i', { style: `width:${(p.idx / st.targets.length) * 100}%` }))
      ));
    });
    el.appendChild(h('div', { class: 'visit' },
      [0, 1, 2].map(i => h('div', { class: 'vslot' + (st.visitDarts[i] ? '' : ' empty') }, st.visitDarts[i] || '·'))));
  }

  /* ================= SHANGHAI ================= */

  function newShanghai(cfg) {
    return {
      players: cfg.players.map(p => ({ name: p.name, profileId: p.profileId || null, emoji: p.emoji || '👤', points: 0 })),
      rounds: cfg.rounds, round: 1, cur: 0, visitDarts: [],
      flags: { s: false, d: false, t: false },
      over: false, winnerIdx: null, shanghaiWin: false
    };
  }

  function shanghaiDart(st, d) {
    st.visitDarts.push(d.key);
    const p = st.players[st.cur];
    if (d.v === st.round) {
      p.points += d.score;
      if (d.m === 1) st.flags.s = true;
      if (d.m === 2) st.flags.d = true;
      if (d.m === 3) st.flags.t = true;
    }
    const ev = {};
    if (st.visitDarts.length >= 3) {
      if (st.flags.s && st.flags.d && st.flags.t) {
        st.over = true; st.winnerIdx = st.cur; st.shanghaiWin = true;
        ev.say = 'Shanghai!';
        return ev;
      }
      st.flags = { s: false, d: false, t: false };
      const last = st.cur === st.players.length - 1;
      if (last) {
        st.round++;
        if (st.round > st.rounds) {
          st.over = true;
          let best = -1, bi = 0;
          st.players.forEach((q, i) => { if (q.points > best) { best = q.points; bi = i; } });
          st.winnerIdx = bi;
          return ev;
        }
      }
      nextTurn(st);
    }
    return ev;
  }

  function renderShanghai(st, el) {
    el.appendChild(h('div', { class: 'hero center', style: 'padding:10px' },
      h('div', { class: 'sub' }, t('round_x_of', { a: st.round, b: st.rounds })),
      h('div', { class: 'big', style: 'font-size:34px' }, '🎯 ' + st.round)
    ));
    st.players.forEach((p, i) => {
      el.appendChild(pRow(p, i === st.cur, h('div', { class: 'sc', style: 'font-size:26px' }, String(p.points))));
    });
    el.appendChild(h('div', { class: 'visit' },
      [0, 1, 2].map(i => h('div', { class: 'vslot' + (st.visitDarts[i] ? '' : ' empty') }, st.visitDarts[i] || '·'))));
  }

  /* ================= KILLER ================= */

  function newKiller(cfg) {
    const nums = [];
    while (nums.length < cfg.players.length) {
      const n = 1 + Math.floor(Math.random() * 20);
      if (!nums.includes(n)) nums.push(n);
    }
    return {
      players: cfg.players.map((p, i) => ({
        name: p.name, profileId: p.profileId || null, emoji: p.emoji || '👤',
        num: nums[i], lives: cfg.lives, killer: false, out: false
      })),
      cur: 0, visitDarts: [], over: false, winnerIdx: null
    };
  }

  function killerDart(st, d) {
    st.visitDarts.push(d.key);
    const p = st.players[st.cur];
    const ev = {};
    if (d.m === 2 && d.v >= 1 && d.v <= 20) {
      if (!p.killer && d.v === p.num) {
        p.killer = true;
        ev.toast = p.name + ' → KILLER! 🔪';
        ev.say = 'Killer!';
      } else if (p.killer) {
        const victim = st.players.find(q => !q.out && q !== p && q.num === d.v);
        if (victim) {
          victim.lives--;
          if (victim.lives <= 0) { victim.out = true; ev.toast = '💀 ' + t('eliminated', { n: victim.name }); }
          else ev.toast = victim.name + ' −1 ❤';
        }
      }
    }
    const alive = st.players.filter(q => !q.out);
    if (alive.length === 1) {
      st.over = true; st.winnerIdx = st.players.indexOf(alive[0]);
      return ev;
    }
    if (st.visitDarts.length >= 3) nextTurn(st, i => st.players[i].out);
    return ev;
  }

  function renderKiller(st, el) {
    st.players.forEach((p, i) => {
      el.appendChild(h('div', {
        class: 'pcard' + (i === st.cur && !p.out ? ' turn' : ''),
        style: 'margin-bottom:8px' + (p.out ? ';opacity:.4' : '')
      },
        h('div', { class: 'row' },
          h('div', { class: 'grow' },
            h('div', { class: 'nm' }, p.emoji + ' ' + p.name + (p.killer ? ' 🔪' : '')),
            h('div', { class: 'mini' }, t('your_double') + ': D' + p.num)),
          h('div', { style: 'font-size:18px' }, p.out ? '💀' : '❤'.repeat(p.lives))
        )));
    });
    el.appendChild(h('div', { class: 'visit' },
      [0, 1, 2].map(i => h('div', { class: 'vslot' + (st.visitDarts[i] ? '' : ' empty') }, st.visitDarts[i] || '·'))));
  }

  /* ================= HALVE IT ================= */

  const HALVE_ROUNDS = [
    { k: '20', f: d => d.v === 20 ? d.score : 0 },
    { k: '16', f: d => d.v === 16 ? d.score : 0 },
    { k: 'D', f: d => d.m === 2 ? d.score : 0 },
    { k: '17', f: d => d.v === 17 ? d.score : 0 },
    { k: '18', f: d => d.v === 18 ? d.score : 0 },
    { k: 'T', f: d => d.m === 3 ? d.score : 0 },
    { k: '19', f: d => d.v === 19 ? d.score : 0 },
    { k: 'B', f: d => d.v === 25 ? d.score : 0 }
  ];

  function newHalve(cfg) {
    return {
      players: cfg.players.map(p => ({ name: p.name, profileId: p.profileId || null, emoji: p.emoji || '👤', score: 40 })),
      ridx: 0, cur: 0, visitDarts: [], gain: 0, over: false, winnerIdx: null
    };
  }

  function halveDart(st, d) {
    st.visitDarts.push(d.key);
    st.gain += HALVE_ROUNDS[st.ridx].f(d);
    const ev = {};
    if (st.visitDarts.length >= 3) {
      const p = st.players[st.cur];
      if (st.gain === 0) { p.score = Math.ceil(p.score / 2); ev.toast = '½ ' + p.name + ': ' + p.score; }
      else p.score += st.gain;
      st.gain = 0;
      const last = st.cur === st.players.length - 1;
      if (last) {
        st.ridx++;
        if (st.ridx >= HALVE_ROUNDS.length) {
          st.over = true;
          let best = -1, bi = 0;
          st.players.forEach((q, i) => { if (q.score > best) { best = q.score; bi = i; } });
          st.winnerIdx = bi;
          return ev;
        }
      }
      nextTurn(st);
    }
    return ev;
  }

  function halveLabel(k) {
    if (k === 'D') return t('any_double');
    if (k === 'T') return t('any_triple');
    if (k === 'B') return 'Bull';
    return k;
  }

  function renderHalve(st, el) {
    el.appendChild(h('div', { class: 'hero center', style: 'padding:10px' },
      h('div', { class: 'sub' }, t('round_x_of', { a: st.ridx + 1, b: HALVE_ROUNDS.length }) + ' · ' +
        HALVE_ROUNDS.map((r, i) => i === st.ridx ? '●' : (i < st.ridx ? '✓' : '○')).join(' ')),
      h('div', { class: 'big', style: 'font-size:30px' }, '🎯 ' + halveLabel(HALVE_ROUNDS[st.ridx].k)),
      h('div', { class: 'sub' }, t('halve_hint'))
    ));
    st.players.forEach((p, i) => {
      el.appendChild(pRow(p, i === st.cur, h('div', { class: 'sc', style: 'font-size:26px' }, String(p.score))));
    });
    el.appendChild(h('div', { class: 'visit' },
      [0, 1, 2].map(i => h('div', { class: 'vslot' + (st.visitDarts[i] ? '' : ' empty') }, st.visitDarts[i] || '·'))));
  }

  /* ================= SPIELER-AUSWAHL ================= */

  function playerPicker(host, opts) {
    const sel = [];
    const wrap = h('div');
    host.appendChild(wrap);

    function names() {
      return sel.map(s => {
        if (s.type === 'profile') { const p = Store.profile(s.id); return { name: p.name, profileId: p.id, emoji: p.emoji }; }
        if (s.type === 'bot') return { name: 'Bot Ø' + s.avg, bot: { avg: s.avg }, emoji: '🤖' };
        return { name: s.name, emoji: '👤' };
      });
    }

    function render() {
      wrap.innerHTML = '';
      const selRow = h('div');
      if (sel.length) {
        sel.forEach((s, i) => {
          const nm = names()[i];
          selRow.appendChild(h('span', { class: 'chip on', onClick: () => { sel.splice(i, 1); render(); } },
            h('span', { class: 'av' }, nm.emoji), (i + 1) + '. ' + nm.name + ' ✕'));
        });
      } else selRow.appendChild(h('div', { class: 'sub', style: 'margin-bottom:8px' }, t('pick_players_hint')));
      wrap.appendChild(selRow);
      const av = h('div', { style: 'margin-top:6px' });
      Store.state.profiles.forEach(p => {
        if (sel.some(s => s.type === 'profile' && s.id === p.id)) return;
        av.appendChild(h('span', {
          class: 'chip',
          onClick: () => { if (sel.length < (opts.max || 8)) { sel.push({ type: 'profile', id: p.id }); render(); } }
        }, h('span', { class: 'av' }, p.emoji), p.name));
      });
      av.appendChild(h('span', {
        class: 'chip', onClick: () => {
          const inp = h('input', { type: 'text', placeholder: t('guest_name') });
          UI.modal({
            title: '+ ' + t('guest'), body: inp,
            buttons: [
              { label: t('cancel'), cls: 'sec' },
              { label: t('ok'), onClick: () => { const n = inp.value.trim(); if (n && sel.length < (opts.max || 8)) { sel.push({ type: 'guest', name: n }); render(); } } }
            ]
          });
          setTimeout(() => inp.focus(), 50);
        }
      }, '＋ ' + t('guest')));
      if (opts.bot) {
        av.appendChild(h('span', {
          class: 'chip', onClick: () => {
            const rng = h('input', { type: 'range', min: '40', max: '100', step: '5', value: '60', style: 'width:100%' });
            const lbl = h('div', { class: 'center', style: 'font-size:22px;font-weight:800;margin:6px' }, 'Ø 60');
            rng.addEventListener('input', () => lbl.textContent = 'Ø ' + rng.value);
            UI.modal({
              title: '🤖 ' + t('bot_level'), body: h('div', null, lbl, rng),
              buttons: [
                { label: t('cancel'), cls: 'sec' },
                { label: t('ok'), onClick: () => { if (sel.length < (opts.max || 8)) { sel.push({ type: 'bot', avg: parseInt(rng.value, 10) }); render(); } } }
              ]
            });
          }
        }, '＋ 🤖 Bot'));
      }
      if (!Store.state.profiles.length) {
        av.appendChild(h('div', null, h('button', {
          class: 'btn sec', style: 'margin-top:8px',
          onClick: () => App.editProfile(null, () => render())
        }, '＋ ' + t('new_profile'))));
      }
      wrap.appendChild(av);
    }
    render();
    return { players: names, count: () => sel.length };
  }

  /* ================= KONFIG-SCREENS ================= */

  function segPick(values, labels, initial, onCh) {
    let val = initial;
    const seg = h('div', { class: 'seg' });
    values.forEach((v, i) => {
      const b = h('button', { class: v === val ? 'on' : '', onClick: () => { val = v; [...seg.children].forEach((c, j) => c.classList.toggle('on', values[j] === val)); if (onCh) onCh(v); } }, labels[i]);
      seg.appendChild(b);
    });
    seg.value = () => val;
    return seg;
  }

  function configX01() {
    App.show(view => {
      const s = Store.state.settings.x01;
      view.appendChild(h('div', { class: 'mhead' },
        h('button', { class: 'iconbtn', onClick: () => App.back() }, '‹'),
        h('div', { class: 'ttl' }, 'X01')));
      view.appendChild(h('h2', null, t('players')));
      const pickHost = h('div', { class: 'card' });
      view.appendChild(pickHost);
      const picker = playerPicker(pickHost, { min: 1, max: 8, bot: true });
      view.appendChild(h('h2', null, t('game_settings')));
      const segStart = segPick([201, 301, 501, 701], ['201', '301', '501', '701'], s.start);
      const segOut = segPick(['double', 'master', 'straight'], ['Double', 'Master', 'Straight'], s.out);
      const segLegs = segPick([1, 3, 5, 7, 9, 11], ['1', '3', '5', '7', '9', '11'], s.legs);
      const segSets = segPick([1, 3, 5, 7], ['1', '3', '5', '7'], s.sets);
      let din = s.din;
      const dinT = h('label', { class: 'switch' },
        h('input', { type: 'checkbox', ...(din ? { checked: '' } : {}), onChange: e => din = e.target.checked }),
        h('span'));
      view.appendChild(h('div', { class: 'card' },
        h('label', { class: 'fld' }, t('start_score'), segStart),
        h('label', { class: 'fld' }, 'Out-Modus', segOut),
        h('label', { class: 'fld' }, 'Best of ... Legs', segLegs),
        h('label', { class: 'fld' }, 'Best of ... Sets', segSets),
        h('div', { class: 'toggline' }, h('span', null, 'Double-In'), dinT)
      ));
      view.appendChild(h('button', {
        class: 'btn', onClick: () => {
          const players = picker.players();
          if (!players.length) { UI.toast(t('pick_players_hint')); return; }
          Object.assign(s, { start: segStart.value(), out: segOut.value(), legs: segLegs.value(), sets: segSets.value(), din });
          Store.save();
          startX01({ start: s.start, out: s.out, din: s.din, legs: s.legs, sets: s.sets, players });
        }
      }, '▶ ' + t('start_game')));
    });
  }

  function simpleConfig(titleTxt, opts, buildAndRun) {
    App.show(view => {
      view.appendChild(h('div', { class: 'mhead' },
        h('button', { class: 'iconbtn', onClick: () => App.back() }, '‹'),
        h('div', { class: 'ttl' }, titleTxt)));
      view.appendChild(h('h2', null, t('players')));
      const pickHost = h('div', { class: 'card' });
      view.appendChild(pickHost);
      const picker = playerPicker(pickHost, { min: opts.min || 1, max: opts.max || 8, bot: false });
      const extraHost = h('div', { class: 'card' });
      const extras = opts.extras ? opts.extras(extraHost) : null;
      if (opts.extras) { view.appendChild(h('h2', null, t('game_settings'))); view.appendChild(extraHost); }
      view.appendChild(h('button', {
        class: 'btn', onClick: () => {
          const players = picker.players();
          if (players.length < (opts.min || 1)) { UI.toast(t('need_players', { n: opts.min || 1 })); return; }
          buildAndRun(players, extras);
        }
      }, '▶ ' + t('start_game')));
    });
  }

  function startCricket(players, cut) {
    const mk = () => {
      const st = newCricket({ players, cut });
      runCasual({
        mode: 'cricket', st, title: 'Cricket' + (cut ? ' (Cut-Throat)' : ''), sub: '15–20 + Bull',
        dart: cricketDart, render: renderCricket, again: mk
      });
    };
    mk();
  }

  function startATC(players, variant, bull) {
    const mk = () => {
      const st = newATC({ players, variant, bull });
      runCasual({
        mode: 'atc', st, title: 'Around the Clock',
        sub: variant === 'double' ? 'Doubles' : variant === 'triple' ? 'Triples' : '1–20' + (bull ? ' + Bull' : ''),
        dart: atcDart, render: renderATC, again: mk
      });
    };
    mk();
  }

  function startShanghai(players, rounds) {
    const mk = () => {
      const st = newShanghai({ players, rounds });
      runCasual({
        mode: 'shanghai', st, title: 'Shanghai', sub: rounds + ' ' + t('rounds'),
        dart: shanghaiDart, render: renderShanghai, again: mk,
        flags: s => ({ shanghai: s.shanghaiWin })
      });
    };
    mk();
  }

  function startKiller(players, lives) {
    const mk = () => {
      const st = newKiller({ players, lives });
      runCasual({
        mode: 'killer', st, title: 'Killer', sub: lives + ' ❤',
        dart: killerDart, render: renderKiller, again: mk
      });
    };
    mk();
  }

  function startHalve(players) {
    const mk = () => {
      const st = newHalve({ players });
      runCasual({
        mode: 'halveit', st, title: 'Halve It', sub: t('halve_hint'),
        dart: halveDart, render: renderHalve, again: mk
      });
    };
    mk();
  }

  /* ================= SPIELEN-TAB ================= */

  const GAME_DEFS = [
    { icon: 'target', name: 'X01', desc: 'g_x01_d', go: configX01 },
    {
      icon: 'hash', name: 'Cricket', desc: 'g_cricket_d',
      go: () => simpleConfig('Cricket', {
        min: 2, max: 4,
        extras: host => {
          const seg = segPick(['std', 'cut'], ['Standard', 'Cut-Throat'], 'std');
          host.appendChild(h('label', { class: 'fld' }, t('variant'), seg));
          return { seg };
        }
      }, (players, ex) => startCricket(players, ex.seg.value() === 'cut'))
    },
    {
      icon: 'clock', name: 'Around the Clock', desc: 'g_atc_d',
      go: () => simpleConfig('Around the Clock', {
        min: 1, max: 8,
        extras: host => {
          const seg = segPick(['any', 'double', 'triple'], [t('v_any'), 'Doubles', 'Triples'], 'any');
          let bull = true;
          host.appendChild(h('label', { class: 'fld' }, t('variant'), seg));
          host.appendChild(h('div', { class: 'toggline' }, h('span', null, '+ Bull'),
            h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: '', onChange: e => bull = e.target.checked }), h('span'))));
          return { seg, bull: () => bull };
        }
      }, (players, ex) => startATC(players, ex.seg.value(), ex.bull()))
    },
    {
      icon: 'stack', name: 'Shanghai', desc: 'g_shanghai_d',
      go: () => simpleConfig('Shanghai', {
        min: 1, max: 8,
        extras: host => {
          const seg = segPick([7, 20], ['7 ' + t('rounds'), '20 ' + t('rounds')], 7);
          host.appendChild(h('label', { class: 'fld' }, t('rounds'), seg));
          return { seg };
        }
      }, (players, ex) => startShanghai(players, ex.seg.value()))
    },
    {
      icon: 'skull', name: 'Killer', desc: 'g_killer_d',
      go: () => simpleConfig('Killer', {
        min: 2, max: 8,
        extras: host => {
          const seg = segPick([3, 5], ['3 ❤', '5 ❤'], 3);
          host.appendChild(h('label', { class: 'fld' }, t('lives'), seg));
          return { seg };
        }
      }, (players, ex) => startKiller(players, ex.seg.value()))
    },
    {
      icon: 'divide', name: 'Halve It', desc: 'g_halve_d',
      go: () => simpleConfig('Halve It', { min: 1, max: 8 }, players => startHalve(players))
    }
  ];

  function renderTab(view) {
    view.appendChild(h('h1', null, 'One80', h('span', { class: 'dot' }, '.')));
    const a = Store.state.active;
    if (a && a.kind === 'x01') {
      view.appendChild(h('div', { class: 'card tap', style: 'border-color:var(--accent)', onClick: () => resumeActive() },
        h('div', { class: 'row' },
          h('div', { class: 'gic hot' }, UI.ic('pause')),
          h('div', { class: 'grow' },
            h('div', { style: 'font-weight:700' }, t('resume_match')),
            h('div', { class: 'sub' }, a.st.cfg.start + ' · ' + t('leg_no', { n: a.st.legNo }) + ' · ' +
              a.st.players.map(p => p.name).join(' vs '))),
          h('div', { class: 'arr' }, '›'))));
    }
    GAME_DEFS.forEach(g => {
      view.appendChild(h('div', { class: 'card tap', onClick: g.go },
        h('div', { class: 'row' },
          h('div', { class: 'gic' }, UI.ic(g.icon)),
          h('div', { class: 'grow' },
            h('div', { style: 'font-weight:700;font-size:16.5px' }, g.name),
            h('div', { class: 'sub' }, t(g.desc))),
          h('div', { class: 'arr' }, '›'))));
    });
  }

  return { renderTab, startX01, resumeActive, newX01 };
})();
