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
        name: p.name, profileId: p.profileId || null, bot: p.bot || null,
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

  /* Aufnahme-Ende: Statistik sofort, Anzeige bleibt stehen –
     Spielerwechsel/Leg-Reset erst über advance() (kurze Pause im UI). */
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
    if (bust) p.score = p.visitStart;   // Punktestand der Aufnahme zurücksetzen
    const ev = { visitEnd: true, visitTotal: total, bust, finished, playerIdx: st.cur };
    if (finished) ev.leg = legWon(st);
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
        if (w.sets >= st.setsToWin) { st.over = true; st.winnerIdx = st.cur; result.type = 'match'; }
        else result.type = 'set';
      } else { st.over = true; st.winnerIdx = st.cur; result.type = 'match'; }
    }
    return result;
  }

  /* Nach der UI-Pause: Aufnahme abräumen, Spieler wechseln bzw. neues Leg aufbauen */
  function advance(st, ev) {
    if (st.over) return;
    if (ev && ev.leg) {
      if (ev.leg.type === 'set') st.players.forEach(p => p.legs = 0);
      st.legNo++;
      st.legStarter = (st.legStarter + 1) % st.players.length;
      st.cur = st.legStarter;
      st.players.forEach(p => {
        p.score = st.cfg.start; p.opened = !st.cfg.din; p.legDarts = 0; p.visitNo = 0;
        p.visitDarts = []; p.visitPoints = 0; p.visitStart = st.cfg.start;
      });
    } else {
      const p = st.players[st.cur];
      p.visitDarts = []; p.visitPoints = 0; p.visitStart = p.score;
      st.cur = (st.cur + 1) % st.players.length;
      const q = st.players[st.cur];
      q.visitDarts = []; q.visitPoints = 0; q.visitStart = q.score;
    }
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
    let pendTimer = null;
    const persist = () => {
      if (!isTournament) { Store.state.active = { kind: 'x01', st }; Store.save(); }
    };
    persist();

    App.show(view => {
      const wrap = h('div', { class: 'mwrap' });
      view.appendChild(wrap);

      const meta = h('div', { class: 'mmeta' });
      const head = h('div', { class: 'mtop' },
        h('button', { class: 'cbtn', onClick: quit }, '✕'),
        meta,
        h('button', { class: 'cbtn', onClick: undo }, '⌫')
      );
      const mcard = h('div', { class: 'mcard' });
      const slotsEl = h('div', { class: 'slots' });
      const coEl = h('div', { class: 'corow' });
      const inpHost = h('div', { style: 'margin-top:auto;display:flex;flex-direction:column' });
      wrap.append(head, mcard, slotsEl, coEl, inpHost);

      const inp = Input.create(inpHost, {
        modes: ['board', 'keys', 'sum'],
        mode: Store.state.settings.input,
        onDart: d => {
          if (st.over || st.players[st.cur].bot || pendTimer) return;
          snap();
          after(x01Dart(st, d));
        },
        onSum: total => { if (!st.over && !st.players[st.cur].bot && !pendTimer) handleSum(total); },
        onUndo: undo
      });

      function snap() { hist.push(JSON.stringify(st)); if (hist.length > 50) hist.shift(); }

      function undo() {
        if (!hist.length || st.over) return;
        clearTimeout(pendTimer); pendTimer = null;
        let s = JSON.parse(hist.pop());
        while (s.players[s.cur].bot && hist.length) s = JSON.parse(hist.pop());
        Object.keys(st).forEach(k => delete st[k]);
        Object.assign(st, s);
        persist(); inp.setDisabled(false); update();
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
            h('button', { class: 'btn sec', style: 'flex:1;height:46px', onClick: () => { m.close(); cb(n); } }, String(n))
          ))
        });
      }

      function after(ev) {
        persist();
        if (ev && ev.visitEnd) {
          const pl = st.players[ev.playerIdx];
          if (ev.bust) {
            UI.sfx.bust(); UI.say('Bust!');
            UI.toast(t('bust_stay', { n: pl.name, v: pl.score }));
          } else if (!ev.finished) {
            UI.callScore(ev.visitTotal);
          }
        }
        update();
        if (st.over) { finishMatch(); return; }
        if (ev && ev.visitEnd) {
          if (ev.leg) {
            const wname = st.players[ev.leg.winnerIdx].name;
            UI.say('Game shot!');
            UI.toast(ev.leg.type === 'set' ? t('set_won', { n: wname }) : t('leg_won', { n: wname }));
          }
          inp.setDisabled(true);
          const delay = ev.leg ? 1150 : ev.bust ? 950 : 900;
          pendTimer = setTimeout(() => {
            pendTimer = null;
            advance(st, ev);
            persist(); update();
            inp.setDisabled(false);
            maybeBot();
          }, delay);
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
          if (st.over || !st.players[st.cur].bot || pendTimer) return;
          snap();
          const b = botThink(st);
          after(x01Sum(st, b.total, b));
        }, 1200);
      }

      function update() {
        const setNo = st.cfg.sets > 1 ? st.players.reduce((s, p) => s + p.sets, 0) + 1 : 0;
        meta.innerHTML = '';
        meta.append(
          st.cfg.start + ' · Best of ' + st.cfg.legs + ' · ',
          h('b', null, (setNo ? 'Set ' + setNo + ' · ' : '') + t('leg_no', { n: st.legNo }))
        );
        mcard.innerHTML = '';
        const p = st.players[st.cur];
        const avg = q => q.darts ? UI.f1((q.points / q.darts) * 3) : UI.f1(0);
        // aktive Spieler-Karte
        mcard.appendChild(h('div', { class: 'mc-top' },
          h('span', { class: 'mc-name' },
            h('span', { class: 'nm' }, p.name),
            !st.over ? h('span', { class: 'turnpill' }, t('to_throw')) : null),
          h('span', { class: 'dots' },
            Array.from({ length: st.legsToWin }, (_, i) => h('i', { class: i < p.legs ? 'on' : '' })))
        ));
        mcard.appendChild(h('div', { class: 'bigrow' },
          h('span', { class: 'bigscore' }, String(p.score)),
          h('span', { class: 'bigside' },
            h('span', null, 'Ø ' + avg(p)),
            h('span', null, p.darts + ' Darts'),
            st.cfg.sets > 1 ? h('span', null, 'Sets ' + p.sets) : null)
        ));
        st.players.forEach((q, i) => {
          if (i === st.cur) return;
          mcard.appendChild(h('div', { class: 'oppo' },
            h('span', { class: 'nm' }, q.name),
            h('span', { class: 'right' },
              h('span', { class: 'mini' }, 'Ø ' + avg(q) + ' · Legs ' + q.legs + (st.cfg.sets > 1 ? ' · Sets ' + q.sets : '')),
              h('span', { class: 'rem' }, String(q.score)))
          ));
        });
        // Aufnahme-Slots
        slotsEl.innerHTML = '';
        for (let i = 0; i < 3; i++) {
          const d = p.visitDarts[i];
          slotsEl.appendChild(h('span', { class: 'slot ' + (d ? 'filled' : 'free') }, d ? UI.dartLabel(d.key) : '–'));
        }
        slotsEl.appendChild(h('span', { class: 'vsum' },
          h('span', { class: 'micro' }, t('visit_lbl')),
          h('span', { class: 'val' }, String(p.visitDarts.reduce((a, d) => a + d.score, 0)))));
        // Checkout-Hinweis
        coEl.innerHTML = '';
        const dartsLeft = 3 - p.visitDarts.length;
        if (Store.state.settings.coHints !== false && !st.over && dartsLeft > 0) {
          if (!p.opened && st.cfg.din) {
            coEl.appendChild(h('span', { class: 'copill' }, t('need_double_in')));
          } else if (p.opened) {
            const route = DartMath.checkout(p.score, dartsLeft, st.cfg.out);
            if (route) coEl.appendChild(h('span', { class: 'copill' }, 'Checkout: ' + route.map(UI.dartLabel).join(' · ')));
          }
        }
      }

      function statsModal() {
        const rows = st.players.map(p => {
          const avg = p.darts ? (p.points / p.darts) * 3 : 0;
          const f9 = p.f9d ? (p.f9p / p.f9d) * 3 : 0;
          const co = p.coAtt ? Math.round((p.coHits / p.coAtt) * 100) : 0;
          return h('tr', null,
            h('td', null, p.name), h('td', null, UI.f1(avg)), h('td', null, UI.f1(f9)),
            h('td', null, co + '%'), h('td', null, String(p.n180)),
            h('td', null, p.hiFinish || '–'), h('td', null, p.bestLeg || '–'));
        });
        UI.modal({
          title: t('match_stats'),
          body: h('table', { class: 'tbl' },
            h('tr', null, h('th', null, ''), h('th', null, 'Ø3'), h('th', null, 'F9'), h('th', null, 'CO'),
              h('th', null, '180'), h('th', null, 'HiFin'), h('th', null, t('best_leg'))),
            rows),
          buttons: [{ label: t('ok') }]
        });
      }

      function quit() {
        if (isTournament) {
          UI.confirm(t('quit_match_q'), () => { cleanupUi(); App.back(); });
          return;
        }
        // Match bleibt gespeichert – zurück zur Übersicht
        persist(); Store.saveNow();
        cleanupUi();
        App.root('play');
      }

      function cleanupUi() { App.gameMode(false); UI.wakeLock(false); clearTimeout(pendTimer); }

      function finishMatch() {
        clearTimeout(pendTimer); pendTimer = null;
        Store.state.active = null; Store.saveNow();
        UI.sfx.win();
        UI.say('Game shot, and the match!');
        Stats.recordX01Match(st);
        showWinOverlay();
      }

      function showWinOverlay() {
        const w = st.players[st.winnerIdx];
        const score = st.cfg.sets > 1
          ? st.players.map(p => p.sets).join('–') + ' (Sets)'
          : st.players.map(p => p.legs).join('–');
        const back = h('div', { class: 'winback' });
        const btns = [];
        if (isTournament) {
          btns.push(h('button', {
            class: 'btn', style: 'flex:1', onClick: () => {
              back.remove(); cleanupUi();
              onDone({ winnerIdx: st.winnerIdx, legs: st.players.map(p => p.legsTotal) });
            }
          }, t('continue')));
        } else {
          btns.push(h('button', {
            class: 'btn', style: 'flex:1', onClick: () => {
              back.remove(); cleanupUi();
              App.back();
              matchScreen(newX01(st.cfg), null);
            }
          }, t('rematch')));
          btns.push(h('button', {
            class: 'btn sec', style: 'flex:1', onClick: () => { back.remove(); cleanupUi(); App.root('play'); }
          }, t('done')));
        }
        back.appendChild(h('div', { class: 'wincard' },
          h('span', { class: 'wtag' }, t('match_over')),
          h('span', { class: 'wname' }, w.name),
          h('span', { class: 'wsub' }, t('wins_match', { s: score, p: st.cfg.start })),
          h('div', { class: 'wbtns' }, btns),
          h('button', { class: 'wlink', onClick: statsModal }, t('match_stats'))
        ));
        document.body.appendChild(back);
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
      const wrap = h('div', { class: 'mwrap' });
      view.appendChild(wrap);
      const head = h('div', { class: 'mtop' },
        h('button', { class: 'cbtn', onClick: quit }, '✕'),
        h('div', { class: 'mmeta' }, h('b', null, game.title), game.sub ? ' · ' + game.sub : ''),
        h('button', { class: 'cbtn', onClick: doUndo }, '⌫')
      );
      const scoreEl = h('div');
      const inpHost = h('div', { style: 'margin-top:auto;display:flex;flex-direction:column' });
      wrap.append(head, scoreEl, inpHost);
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
        onUndo: doUndo
      });
      function doUndo() {
        if (!hist.length || game.st.over) return;
        const s = JSON.parse(hist.pop());
        Object.keys(game.st).forEach(k => delete game.st[k]);
        Object.assign(game.st, s);
        update();
      }
      function update() { scoreEl.innerHTML = ''; game.render(game.st, scoreEl); }
      function cleanup() { App.gameMode(false); UI.wakeLock(false); }
      function quit() { UI.confirm(t('quit_match_q'), () => { cleanup(); App.root('play'); }); }
      function finish() {
        UI.sfx.win();
        const w = game.st.players[game.st.winnerIdx];
        Stats.recordCasual(game.mode, game.st.players, game.st.winnerIdx, game.flags ? game.flags(game.st) : {});
        const back = h('div', { class: 'winback' });
        back.appendChild(h('div', { class: 'wincard' },
          h('span', { class: 'wtag' }, t('match_over')),
          h('span', { class: 'wname' }, w.name),
          h('span', { class: 'wsub' }, t('wins_casual', { g: game.title })),
          h('div', { class: 'wbtns' },
            h('button', { class: 'btn', style: 'flex:1', onClick: () => { back.remove(); cleanup(); App.back(); game.again(); } }, t('rematch')),
            h('button', { class: 'btn sec', style: 'flex:1', onClick: () => { back.remove(); cleanup(); App.root('play'); } }, t('done')))
        ));
        document.body.appendChild(back);
      }
      update();
    });
  }

  const visitRow = st => h('div', { class: 'slots', style: 'margin-bottom:4px' },
    [0, 1, 2].map(i => h('span', {
      class: 'slot ' + (st.visitDarts[i] ? 'filled' : 'free'),
      style: 'height:44px;font-size:14px'
    }, st.visitDarts[i] ? UI.dartLabel(st.visitDarts[i]) : '–')));

  const pRow = (p, active, right) => h('div', { class: 'card', style: 'padding:13px 16px;margin-bottom:8px' },
    h('div', { class: 'row' },
      h('div', { class: 'grow row', style: 'gap:8px' },
        h('span', { style: 'font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, p.name),
        active ? h('span', { class: 'turnpill' }, t('to_throw')) : null),
      right));

  /* ================= CRICKET ================= */

  const CRICKET_KEYS = ['20', '19', '18', '17', '16', '15', '25'];

  function newCricket(cfg) {
    return {
      players: cfg.players.map(p => ({
        name: p.name, profileId: p.profileId || null,
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
      st.players.map((p, i) => h('th', { style: i === st.cur ? 'color:var(--grn)' : '' }, p.name))));
    CRICKET_KEYS.forEach(k => {
      tb.appendChild(h('tr', null,
        h('td', { style: 'font-weight:700' }, k === '25' ? 'Bull' : k),
        st.players.map(p => h('td', { class: 'center', style: 'font-size:16px;' + (p.marks[k] >= 3 ? 'color:var(--grn);font-weight:700' : '') }, MK[p.marks[k]]))
      ));
    });
    tb.appendChild(h('tr', null, h('td', { style: 'font-weight:700' }, t('points')),
      st.players.map(p => h('td', { class: 'center', style: 'font-weight:700;font-size:16px' }, String(p.points)))));
    el.appendChild(h('div', { class: 'card', style: 'padding:8px 12px' }, tb));
    el.appendChild(visitRow(st));
  }

  /* ================= AROUND THE CLOCK ================= */

  function newATC(cfg) {
    const targets = [];
    for (let n = 1; n <= 20; n++) targets.push(n);
    if (cfg.bull && cfg.variant !== 'triple') targets.push(25);
    return {
      players: cfg.players.map(p => ({ name: p.name, profileId: p.profileId || null, idx: 0, darts: 0 })),
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
      el.appendChild(h('div', { class: 'card', style: 'padding:13px 16px;margin-bottom:8px' },
        h('div', { class: 'row' },
          h('div', { class: 'grow' },
            h('div', { class: 'row', style: 'gap:8px' },
              h('span', { style: 'font-weight:600;font-size:15px' }, p.name),
              i === st.cur ? h('span', { class: 'turnpill' }, t('to_throw')) : null),
            h('div', { class: 'sub', style: 'font-size:11.5px;margin-top:2px' }, p.idx + ' / ' + st.targets.length + ' · ' + p.darts + ' Darts')),
          h('div', { style: 'font-size:24px;font-weight:700' }, tgt !== undefined ? (pref + (tgt === 25 ? 'Bull' : tgt)) : '✓')),
        h('div', { class: 'bar', style: 'margin-top:8px' }, h('i', { style: `width:${(p.idx / st.targets.length) * 100}%` }))));
    });
    el.appendChild(visitRow(st));
  }

  /* ================= SHANGHAI ================= */

  function newShanghai(cfg) {
    return {
      players: cfg.players.map(p => ({ name: p.name, profileId: p.profileId || null, points: 0 })),
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

  function targetCard(label, sub) {
    return h('div', { class: 'card center', style: 'padding:14px' },
      h('div', { class: 'micro', style: 'color:var(--mut2)' }, sub),
      h('div', { style: 'font-size:34px;font-weight:700;margin-top:2px' }, label));
  }

  function renderShanghai(st, el) {
    const r = Math.min(st.round, st.rounds);
    el.appendChild(targetCard(String(r), t('round_x_of', { a: r, b: st.rounds })));
    st.players.forEach((p, i) => {
      el.appendChild(pRow(p, i === st.cur, h('div', { style: 'font-size:24px;font-weight:700' }, String(p.points))));
    });
    el.appendChild(visitRow(st));
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
        name: p.name, profileId: p.profileId || null,
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
        ev.toast = p.name + ' → Killer!';
        ev.say = 'Killer!';
      } else if (p.killer) {
        const victim = st.players.find(q => !q.out && q !== p && q.num === d.v);
        if (victim) {
          victim.lives--;
          if (victim.lives <= 0) { victim.out = true; ev.toast = t('eliminated', { n: victim.name }); }
          else ev.toast = victim.name + ' −1 ' + t('life');
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
        class: 'card', style: 'padding:13px 16px;margin-bottom:8px' + (p.out ? ';opacity:.4' : '')
      },
        h('div', { class: 'row' },
          h('div', { class: 'grow' },
            h('div', { class: 'row', style: 'gap:8px' },
              h('span', { style: 'font-weight:600;font-size:15px' }, p.name),
              i === st.cur && !p.out ? h('span', { class: 'turnpill' }, t('to_throw')) : null,
              p.killer ? h('span', { class: 'tagpill', style: 'font-size:10px;padding:2px 8px' }, 'KILLER') : null),
            h('div', { class: 'sub', style: 'font-size:11.5px;margin-top:2px' }, t('your_double') + ': D' + p.num)),
          p.out
            ? h('span', { class: 'sub' }, t('out_lbl'))
            : h('span', { class: 'dots' }, Array.from({ length: p.lives }, () => h('i', { class: 'on' })))
        )));
    });
    el.appendChild(visitRow(st));
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
      players: cfg.players.map(p => ({ name: p.name, profileId: p.profileId || null, score: 40 })),
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
    // nach der letzten Runde steht ridx über dem Array – auf den letzten Eintrag klemmen
    const ri = Math.min(st.ridx, HALVE_ROUNDS.length - 1);
    el.appendChild(targetCard(halveLabel(HALVE_ROUNDS[ri].k),
      t('round_x_of', { a: ri + 1, b: HALVE_ROUNDS.length })));
    st.players.forEach((p, i) => {
      el.appendChild(pRow(p, i === st.cur, h('div', { style: 'font-size:24px;font-weight:700' }, String(p.score))));
    });
    el.appendChild(visitRow(st));
  }

  /* ================= SPIELER-AUSWAHL (Chips) ================= */

  function playerPicker(host, opts) {
    const sel = [];
    const max = opts.max || 6;
    const wrap = h('div');
    host.appendChild(wrap);
    let adding = false;

    function names() {
      return sel.map(s => {
        if (s.type === 'profile') { const p = Store.profile(s.id); return { name: p.name, profileId: p.id }; }
        return { name: 'Bot Ø' + s.avg, bot: { avg: s.avg } };
      });
    }

    function render() {
      wrap.innerHTML = '';
      const row = h('div', { style: 'display:flex;flex-wrap:wrap' });
      Store.state.profiles.forEach(p => {
        const idx = sel.findIndex(s => s.type === 'profile' && s.id === p.id);
        const on = idx >= 0;
        row.appendChild(h('span', {
          class: 'chip' + (on ? ' on' : ''),
          onClick: () => {
            if (on) sel.splice(idx, 1);
            else {
              if (sel.length >= max) { UI.toast(t('max_players', { n: max })); return; }
              sel.push({ type: 'profile', id: p.id });
            }
            render();
          }
        }, UI.avatar(p.name), p.name));
      });
      sel.forEach((s, i) => {
        if (s.type !== 'bot') return;
        row.appendChild(h('span', {
          class: 'chip on', onClick: () => { sel.splice(i, 1); render(); }
        }, h('span', { class: 'avc' }, 'B'), 'Bot Ø' + s.avg));
      });
      row.appendChild(h('span', {
        class: 'chip dash', onClick: () => { adding = !adding; render(); }
      }, '+ ' + t('new_lbl')));
      if (opts.bot) {
        row.appendChild(h('span', { class: 'chip dash', onClick: addBot }, '+ Bot'));
      }
      wrap.appendChild(row);
      if (adding) {
        const inp = h('input', { type: 'text', placeholder: t('profile_name'), style: 'flex:1' });
        wrap.appendChild(h('div', { style: 'display:flex;gap:8px;margin:2px 0 8px' },
          inp,
          h('button', {
            class: 'btn', style: 'width:auto;height:auto;padding:0 18px;border-radius:12px;font-size:13px',
            onClick: () => {
              const n = inp.value.trim(); if (!n) return;
              const np = Store.newProfile(n);
              if (sel.length < max) sel.push({ type: 'profile', id: np.id });
              adding = false; render();
            }
          }, 'OK')));
        setTimeout(() => inp.focus(), 40);
      }
      if (opts.onChange) opts.onChange(sel.length);
    }

    function addBot() {
      const rng = h('input', { type: 'range', min: '40', max: '100', step: '5', value: '60', style: 'width:100%' });
      const lbl = h('div', { class: 'center', style: 'font-size:22px;font-weight:700;margin:6px' }, 'Ø 60');
      rng.addEventListener('input', () => lbl.textContent = 'Ø ' + rng.value);
      UI.modal({
        title: t('bot_level'), body: h('div', null, lbl, rng),
        buttons: [
          { label: t('cancel'), cls: 'sec' },
          { label: t('ok'), onClick: () => { if (sel.length < max) { sel.push({ type: 'bot', avg: parseInt(rng.value, 10) }); render(); } } }
        ]
      });
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
    seg.set = v => { val = v; [...seg.children].forEach((c, j) => c.classList.toggle('on', values[j] === val)); };
    return seg;
  }

  function configX01() {
    App.gameMode(true);
    App.show(view => {
      const s = Store.state.settings.x01;
      const wrap = h('div', { class: 'mwrap' });
      view.appendChild(wrap);
      wrap.appendChild(h('div', { class: 'shead' },
        h('button', { class: 'cbtn', onClick: () => { App.gameMode(false); App.back(); } }, '‹'),
        h('div', { class: 'ttl' }, t('new_game')),
        h('span', { class: 'tagpill' }, 'X01')));

      const scroll = h('div', { style: 'flex:1;overflow-y:auto;min-height:0;margin:0 -4px;padding:0 4px' });
      wrap.appendChild(scroll);

      const pLabel = h('div', { class: 'mlabel', style: 'margin-top:6px' });
      scroll.appendChild(pLabel);
      const pickHost = h('div');
      scroll.appendChild(pickHost);
      const startBtn = h('button', { class: 'btn', onClick: start }, t('start_match'));
      const picker = playerPicker(pickHost, {
        min: 1, max: 6, bot: true,
        onChange: n => {
          pLabel.textContent = t('players_of', { a: n, b: 6 });
          startBtn.disabled = n === 0;
        }
      });

      scroll.appendChild(h('div', { class: 'mlabel' }, t('points_lbl')));
      const segStart = segPick([301, 501, 701], ['301', '501', '701'], [301, 501, 701].includes(s.start) ? s.start : 501);
      scroll.appendChild(segStart);

      scroll.appendChild(h('div', { class: 'mlabel' }, 'Legs'));
      const segLegs = segPick([3, 5, 7], ['Best of 3', 'Best of 5', 'Best of 7'], [3, 5, 7].includes(s.legs) ? s.legs : 5);
      scroll.appendChild(segLegs);

      // Double-Out-Zeile mit Switch
      let out = s.out || 'double';
      const doInput = h('input', { type: 'checkbox', ...(out !== 'straight' ? { checked: '' } : {}) });
      let segOut;
      doInput.addEventListener('change', () => {
        out = doInput.checked ? 'double' : 'straight';
        if (segOut) segOut.set(out);
      });
      scroll.appendChild(h('div', {
        class: 'rrow', style: 'margin-top:22px', onClick: e => {
          if (e.target.closest('.switch')) return;
          doInput.checked = !doInput.checked;
          doInput.dispatchEvent(new Event('change'));
        }
      },
        h('span', { class: 'rtxt' },
          h('span', { class: 'ttl' }, 'Double Out'),
          h('span', { class: 'dsc' }, t('double_out_d'))),
        h('label', { class: 'switch' }, doInput, h('span'))));

      // Erweitert
      let advOpen = false;
      const advHost = h('div', { style: 'display:none' });
      const advToggle = h('div', { class: 'mlabel', style: 'cursor:pointer', onClick: () => {
        advOpen = !advOpen; advHost.style.display = advOpen ? '' : 'none';
        advToggle.textContent = t('advanced') + (advOpen ? ' −' : ' +');
      } }, t('advanced') + ' +');
      scroll.appendChild(advToggle);
      scroll.appendChild(advHost);

      segOut = segPick(['double', 'master', 'straight'], ['Double', 'Master', 'Straight'], out, v => {
        out = v;
        doInput.checked = v !== 'straight';
      });
      const segSets = segPick([1, 3, 5, 7], ['1', '3', '5', '7'], s.sets || 1);
      let din = !!s.din;
      const dinInput = h('input', { type: 'checkbox', ...(din ? { checked: '' } : {}), onChange: e => din = e.target.checked });
      advHost.appendChild(h('div', { class: 'card' },
        h('label', { class: 'fld' }, 'Out-Modus', segOut),
        h('label', { class: 'fld' }, 'Best of ... Sets', segSets),
        h('div', { class: 'toggline' },
          h('span', null, 'Double In'),
          h('label', { class: 'switch' }, dinInput, h('span')))));

      wrap.appendChild(h('div', { style: 'padding:16px 0 4px' }, startBtn));

      function start() {
        const players = picker.players();
        if (!players.length) { UI.toast(t('pick_players_hint')); return; }
        Object.assign(s, { start: segStart.value(), out, legs: segLegs.value(), sets: segSets.value(), din });
        Store.save();
        startX01({ start: s.start, out: s.out, din: s.din, legs: s.legs, sets: s.sets, players });
      }
    });
  }

  function simpleConfig(titleTxt, tag, opts, buildAndRun) {
    App.gameMode(true);
    App.show(view => {
      const wrap = h('div', { class: 'mwrap' });
      view.appendChild(wrap);
      wrap.appendChild(h('div', { class: 'shead' },
        h('button', { class: 'cbtn', onClick: () => { App.gameMode(false); App.back(); } }, '‹'),
        h('div', { class: 'ttl' }, titleTxt),
        tag ? h('span', { class: 'tagpill' }, tag) : null));
      const scroll = h('div', { style: 'flex:1;overflow-y:auto;min-height:0' });
      wrap.appendChild(scroll);
      const pLabel = h('div', { class: 'mlabel', style: 'margin-top:6px' });
      scroll.appendChild(pLabel);
      const pickHost = h('div');
      scroll.appendChild(pickHost);
      const startBtn = h('button', {
        class: 'btn', onClick: () => {
          const players = picker.players();
          if (players.length < (opts.min || 1)) { UI.toast(t('need_players', { n: opts.min || 1 })); return; }
          buildAndRun(players, extras);
        }
      }, t('start_match'));
      const picker = playerPicker(pickHost, {
        min: opts.min || 1, max: opts.max || 6, bot: false,
        onChange: n => {
          pLabel.textContent = t('players_of', { a: n, b: opts.max || 6 });
          startBtn.disabled = n < (opts.min || 1);
        }
      });
      const extraHost = h('div');
      const extras = opts.extras ? opts.extras(extraHost) : null;
      if (opts.extras) {
        scroll.appendChild(h('div', { class: 'mlabel' }, t('game_settings')));
        scroll.appendChild(extraHost);
      }
      wrap.appendChild(h('div', { style: 'padding:16px 0 4px' }, startBtn));
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
        mode: 'killer', st, title: 'Killer', sub: lives + ' ' + t('lives'),
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

  /* ================= SPIELEN-TAB (Home) ================= */

  /* Kategorien – Reihenfolge bestimmt die Anzeige im Spielen-Tab */
  const GAME_CATS = [
    { id: 'count', name: 'gc_count' },
    { id: 'classic', name: 'gc_classic' },
    { id: 'fun', name: 'gc_fun' }
  ];

  const GAME_DEFS = [
    { cat: 'count', badge: '01', name: 'X01', desc: 'g_x01_d', go: configX01 },
    {
      cat: 'classic', badge: 'CR', name: 'Cricket', desc: 'g_cricket_d',
      go: () => simpleConfig('Cricket', 'CR', {
        min: 2, max: 4,
        extras: host => {
          const seg = segPick(['std', 'cut'], ['Standard', 'Cut-Throat'], 'std');
          host.appendChild(seg);
          return { seg };
        }
      }, (players, ex) => startCricket(players, ex.seg.value() === 'cut'))
    },
    {
      cat: 'classic', badge: 'AC', name: 'Around the Clock', desc: 'g_atc_d',
      go: () => simpleConfig('Around the Clock', 'AC', {
        min: 1, max: 6,
        extras: host => {
          const seg = segPick(['any', 'double', 'triple'], [t('v_any'), 'Doubles', 'Triples'], 'any');
          let bull = true;
          host.appendChild(seg);
          host.appendChild(h('div', { class: 'rrow', style: 'margin-top:8px', onClick: e => {
            if (e.target.closest('.switch')) return;
            const c = host.querySelector('.switch input');
            c.checked = !c.checked; bull = c.checked;
          } },
            h('span', { class: 'rtxt' }, h('span', { class: 'ttl' }, '+ Bull')),
            h('label', { class: 'switch' },
              h('input', { type: 'checkbox', checked: '', onChange: e => bull = e.target.checked }), h('span'))));
          return { seg, bull: () => bull };
        }
      }, (players, ex) => startATC(players, ex.seg.value(), ex.bull()))
    },
    {
      cat: 'classic', badge: 'SH', name: 'Shanghai', desc: 'g_shanghai_d',
      go: () => simpleConfig('Shanghai', 'SH', {
        min: 1, max: 6,
        extras: host => {
          const seg = segPick([7, 20], ['7 ' + t('rounds'), '20 ' + t('rounds')], 7);
          host.appendChild(seg);
          return { seg };
        }
      }, (players, ex) => startShanghai(players, ex.seg.value()))
    },
    {
      cat: 'fun', badge: 'KI', name: 'Killer', desc: 'g_killer_d',
      go: () => simpleConfig('Killer', 'KI', {
        min: 2, max: 6,
        extras: host => {
          const seg = segPick([3, 5], ['3 ' + t('lives'), '5 ' + t('lives')], 3);
          host.appendChild(seg);
          return { seg };
        }
      }, (players, ex) => startKiller(players, ex.seg.value()))
    },
    {
      cat: 'classic', badge: '½', name: 'Halve It', desc: 'g_halve_d',
      go: () => simpleConfig('Halve It', '½', { min: 1, max: 6 }, players => startHalve(players))
    }
  ];

  /* Registrierung weiterer Spielmodi aus games-extra.js */
  function register(def) {
    if (!GAME_DEFS.some(g => g.name === def.name)) GAME_DEFS.push(def);
    return def;
  }

  function renderTab(view) {
    // Kopfzeile: Logo + Einstellungen
    view.appendChild(h('div', { class: 'apphead' },
      h('div', { class: 'logo' }, h('span', { class: 'ring' }, h('i')), 'one80'),
      h('span', { class: 'headic', onClick: () => App.root('more') }, UI.ic('sliders'))));

    // Resume- / Schnellstart-Karte
    const a = Store.state.active;
    const hasMatch = a && a.kind === 'x01' && !a.st.over;
    const s = Store.state.settings.x01;
    view.appendChild(h('div', { class: 'resume' },
      h('div', { class: 'rcol' },
        h('span', { class: 'rtag' }, hasMatch ? t('running_match') : t('quickstart')),
        h('span', { class: 'rtitle' }, hasMatch ? a.st.players.map(p => p.name).join(' – ') : t('new_game')),
        h('span', { class: 'rsub' }, hasMatch
          ? a.st.cfg.start + ' · Best of ' + a.st.cfg.legs + ' · ' + a.st.players.map(p => p.legs).join('–')
          : s.start + ' · Best of ' + s.legs + (s.out === 'double' ? ' · Double Out' : ''))),
      h('button', { class: 'rbtn', onClick: () => hasMatch ? resumeActive() : configX01() },
        hasMatch ? t('resume_btn') : t('start_btn2'))));

    const open = Store.state.settings.gameOpen = Store.state.settings.gameOpen || {};
    const gameRow = g => h('div', { class: 'mrow', onClick: g.go },
      h('span', { class: 'badge' }, g.badge),
      h('span', { class: 'mtxt' },
        h('span', { class: 'ttl' }, g.name),
        h('span', { class: 'dsc' }, t(g.desc))),
      h('span', { class: 'chev' }, '›'));

    GAME_CATS.forEach((c, ci) => {
      const list = GAME_DEFS.filter(g => (g.cat || 'classic') === c.id);
      if (!list.length) return;
      if (open[c.id] === undefined) open[c.id] = true;
      const body = h('div', { style: open[c.id] ? '' : 'display:none' }, list.map(gameRow));
      const caret = h('span', { class: 'chev', style: 'transition:transform .18s' + (open[c.id] ? ';transform:rotate(90deg)' : '') }, '›');
      view.appendChild(h('div', {
        class: 'mlabel', style: 'display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none' + (ci === 0 ? ';margin-top:0' : ''),
        onClick: () => {
          open[c.id] = !open[c.id];
          body.style.display = open[c.id] ? '' : 'none';
          caret.style.transform = open[c.id] ? 'rotate(90deg)' : '';
          Store.save();
        }
      }, caret, t(c.name), h('span', { style: 'color:var(--dim);font-weight:600' }, String(list.length))));
      view.appendChild(body);
    });
  }

  return {
    renderTab, startX01, resumeActive, newX01, playerPicker, segPick,
    GAME_DEFS, GAME_CATS, register,
    /* Bausteine für games-extra.js */
    runCasual, nextTurn, visitRow, pRow, targetCard, simpleConfig
  };
})();
