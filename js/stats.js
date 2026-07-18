/* One80 – Statistiken, Erfolge, Trainings-Empfehlungen, Head-to-Head */
const Stats = (() => {

  /* ---------- Erfolge (Badge-Kürzel statt Emojis) ---------- */
  const ACH = [
    { id: 'first_win', b: 'W', prog: p => [Math.min(1, p.agg.wins), 1] },
    { id: 'm10', b: '10', prog: p => [Math.min(10, p.agg.matches), 10] },
    { id: 'm50', b: '50', prog: p => [Math.min(50, p.agg.matches), 50] },
    { id: 't180', b: '180', prog: p => [Math.min(1, p.agg.n180), 1] },
    { id: 't180x10', b: '10×', prog: p => [Math.min(10, p.agg.n180), 10] },
    { id: 'ton', b: '100', prog: p => [Math.min(1, p.agg.n100 + p.agg.n140 + p.agg.n180), 1] },
    { id: 'hf100', b: 'HF', prog: p => [p.agg.hiFinish >= 100 ? 1 : 0, 1] },
    { id: 'hf150', b: '150', prog: p => [p.agg.hiFinish >= 150 ? 1 : 0, 1] },
    { id: 'avg50', b: '50+', prog: p => [(p.agg.bestAvg || 0) >= 50 ? 1 : 0, 1] },
    { id: 'avg70', b: '70+', prog: p => [(p.agg.bestAvg || 0) >= 70 ? 1 : 0, 1] },
    { id: 'leg15', b: '15', prog: p => [p.agg.bestLeg && p.agg.bestLeg <= 15 ? 1 : 0, 1] },
    { id: 'leg9', b: '9', prog: p => [p.agg.bestLeg === 9 ? 1 : 0, 1] },
    { id: 'bull_finish', b: 'DB', flag: 'bullFinish' },
    { id: 'shanghai_fin', b: 'SH', flag: 'shanghai' },
    { id: 'bob_survive', b: '27', flag: 'bobSurvive' },
    { id: 'jdc500', b: 'JDC', prog: p => [(p.trainings.jdc && p.trainings.jdc.best >= 500) ? 1 : 0, 1] },
    { id: 'ladder100', b: '170', prog: p => [Math.min(100, p.ladderLevel || 0), 100] },
    { id: 'streak3', b: '3T', prog: p => [Math.min(3, Store.trainStreak(p)), 3] },
    { id: 'streak7', b: '7T', prog: p => [Math.min(7, Store.trainStreak(p)), 7] },
    { id: 'doubles50', b: 'D%', flag: 'doubles50' },
    { id: 'tourwin', b: 'T1', prog: p => [Math.min(1, p.agg.tourWins || 0), 1] }
  ];

  function earned(a, p) {
    if (a.flag) return !!(p.flags && p.flags[a.flag]);
    const [cur, max] = a.prog(p);
    return cur >= max;
  }

  function check(p) {
    p.flags = p.flags || {};
    const fresh = [];
    ACH.forEach(a => {
      if (!p.achievements[a.id] && earned(a, p)) {
        p.achievements[a.id] = Date.now();
        fresh.push(a);
      }
    });
    if (fresh.length) {
      Store.save();
      UI.sfx.ach();
      fresh.forEach(a => UI.toast(t('ach_unlocked') + ': ' + t('ach_' + a.id), 'gold'));
    }
    return fresh;
  }

  /* ---------- Match-Erfassung ---------- */
  function recordX01Match(st) {
    const summary = {
      d: Date.now(), mode: 'x01', start: st.cfg.start, legs: st.cfg.legs, winnerIdx: st.winnerIdx,
      players: st.players.map(p => ({
        name: p.name, profileId: p.profileId,
        avg: p.darts ? Math.round((p.points / p.darts) * 30) / 10 : 0,
        legs: p.legsTotal, sets: p.sets
      }))
    };
    Store.state.matches.push(summary);
    if (Store.state.matches.length > 200) Store.state.matches = Store.state.matches.slice(-200);

    st.players.forEach((p, i) => {
      if (!p.profileId) return;
      const prof = Store.profile(p.profileId);
      if (!prof) return;
      const a = prof.agg;
      a.matches++;
      if (st.winnerIdx === i) a.wins++;
      a.legsWon += p.legsTotal;
      a.legs += st.players.reduce((s, q) => s + q.legsTotal, 0);
      a.darts += p.darts; a.points += p.points;
      a.f9darts += p.f9d; a.f9points += p.f9p;
      a.coHits += p.coHits; a.coAtt += p.coAtt;
      a.hiFinish = Math.max(a.hiFinish, p.hiFinish);
      a.n180 += p.n180; a.n140 += p.n140; a.n100 += p.n100; a.n60 += p.n60;
      if (p.bestLeg) a.bestLeg = a.bestLeg ? Math.min(a.bestLeg, p.bestLeg) : p.bestLeg;
      for (const k in p.doubles) {
        const d = a.doubles[k] = a.doubles[k] || { a: 0, h: 0 };
        d.a += p.doubles[k].a; d.h += p.doubles[k].h;
      }
      for (const k in p.heat) a.heat[k] = (a.heat[k] || 0) + p.heat[k];
      const mAvg = p.darts ? (p.points / p.darts) * 3 : 0;
      if (p.darts >= 30) a.bestAvg = Math.max(a.bestAvg || 0, Math.round(mAvg * 10) / 10);
      prof.flags = prof.flags || {};
      if (p.dbFinish) prof.flags.bullFinish = true;
      prof.history.push({
        d: Date.now(), mode: 'x01',
        avg: Math.round(mAvg * 10) / 10,
        co: p.coAtt ? Math.round((p.coHits / p.coAtt) * 100) : null,
        win: st.winnerIdx === i
      });
      if (prof.history.length > 100) prof.history = prof.history.slice(-100);
      Store.markTrainDay(prof);
      check(prof);
    });
    Store.save();
  }

  function recordCasual(mode, players, winnerIdx, flags) {
    players.forEach((p, i) => {
      if (!p.profileId) return;
      const prof = Store.profile(p.profileId);
      if (!prof) return;
      prof.agg.matches++;
      if (winnerIdx === i) prof.agg.wins++;
      prof.flags = prof.flags || {};
      if (flags && flags.shanghai && winnerIdx === i) prof.flags.shanghai = true;
      prof.history.push({ d: Date.now(), mode, avg: null, co: null, win: winnerIdx === i });
      if (prof.history.length > 100) prof.history = prof.history.slice(-100);
      Store.markTrainDay(prof);
      check(prof);
    });
    Store.save();
  }

  function afterTraining(profile, ctx) {
    profile.flags = profile.flags || {};
    if (ctx.doubles50) profile.flags.doubles50 = true;
    if (ctx.bobSurvive) profile.flags.bobSurvive = true;
    check(profile);
  }

  function recordTourWin(profileId) {
    const prof = Store.profile(profileId);
    if (!prof) return;
    prof.agg.tourWins = (prof.agg.tourWins || 0) + 1;
    check(prof);
    Store.save();
  }

  /* ---------- Empfehlungen ---------- */
  function recommendations(p) {
    const recs = [];
    const a = p.agg;
    const co = Store.coPct(a);
    const avg = Store.avgOf(a);
    if (a.coAtt >= 10 && co < 20)
      recs.push({ txt: t('rec_co', { v: Math.round(co) }), mode: 'checkout' });
    let worst = null;
    for (const k in a.doubles) {
      const d = a.doubles[k];
      if (d.a >= 6) {
        const r = d.h / d.a;
        if (!worst || r < worst.r) worst = { k, r, d };
      }
    }
    if (worst && worst.r < 0.25)
      recs.push({ txt: t('rec_double', { d: worst.k === 'DB' ? 'Bull' : worst.k, v: Math.round(worst.r * 100) }), mode: 'double_single' });
    if (avg > 0 && avg < 45)
      recs.push({ txt: t('rec_scoring', { v: UI.f1(avg) }), mode: 'scoring' });
    if (Store.trainStreak(p) === 0 && p.trainDays.length > 0)
      recs.push({ txt: t('rec_streak'), mode: null });
    if (p.ladderLevel)
      recs.push({ txt: t('rec_ladder', { v: p.ladderLevel }), mode: 'ladder' });
    if (p.trainings.bobs27 && p.trainings.bobs27.best !== null && p.trainings.bobs27.best < 27)
      recs.push({ txt: t('rec_bobs'), mode: 'bobs27' });
    if (!recs.length) recs.push({ txt: t('rec_ok'), mode: null });
    return recs.slice(0, 4);
  }

  function showRecs(p) {
    const body = h('div');
    recommendations(p).forEach(r => {
      body.appendChild(h('div', {
        class: 'listitem', onClick: () => {
          if (r.mode) {
            document.querySelector('.modal-back') && document.querySelector('.modal-back').remove();
            Store.state.settings.trainProfile = p.id; Store.save();
            App.root('training');
          }
        }
      },
        h('div', { class: 'grow', style: 'font-size:13.5px' }, r.txt),
        r.mode ? h('div', { class: 'chev' }, '›') : null));
    });
    UI.modal({ title: t('recommendations'), body, buttons: [{ label: t('ok') }] });
  }

  /* ---------- Erfolge-Screen ---------- */
  function achScreen(p) {
    App.show(view => {
      view.appendChild(h('div', { class: 'shead' },
        h('button', { class: 'cbtn', onClick: () => App.back() }, '‹'),
        h('div', { class: 'ttl' }, t('achievements'),
          h('div', { class: 'sub2' }, p.name))));
      const total = ACH.length, got = ACH.filter(a => p.achievements[a.id]).length;
      view.appendChild(h('div', { class: 'sub', style: 'margin:6px 4px 12px' }, got + ' / ' + total));
      ACH.forEach(a => {
        const won = !!p.achievements[a.id];
        let progEl = null;
        if (!won && a.prog) {
          const [cur, max] = a.prog(p);
          if (max > 1) progEl = h('div', { class: 'bar', style: 'margin-top:6px' }, h('i', { style: `width:${(cur / max) * 100}%` }));
        }
        view.appendChild(h('div', { class: 'card', style: 'padding:13px 16px' },
          h('div', { class: 'ach' + (won ? ' won' : '') },
            h('div', { class: 'badge' }, a.b),
            h('div', { class: 'grow' },
              h('div', { style: 'font-weight:600;font-size:14.5px' }, t('ach_' + a.id)),
              h('div', { class: 'sub', style: 'font-size:12px' }, t('ach_' + a.id + '_d')),
              progEl,
              won ? h('div', { class: 'sub', style: 'color:var(--grn);font-size:11.5px;margin-top:2px' }, UI.dstr(p.achievements[a.id])) : null))));
      });
    });
  }

  /* ---------- Head-to-Head ---------- */
  function h2hScreen() {
    App.show(view => {
      view.appendChild(h('div', { class: 'shead' },
        h('button', { class: 'cbtn', onClick: () => App.back() }, '‹'),
        h('div', { class: 'ttl' }, 'Head-to-Head')));
      let a = Store.state.profiles[0] || null, b = Store.state.profiles[1] || null;
      const selHost = h('div', { style: 'margin-top:8px' });
      const out = h('div');
      view.append(selHost, out);
      function renderSel() {
        selHost.innerHTML = '';
        [['A', a, v => a = v], ['B', b, v => b = v]].forEach(([lbl, cur, set]) => {
          const row = h('div', { style: 'margin-bottom:4px;display:flex;flex-wrap:wrap;align-items:center' },
            h('span', { class: 'sub', style: 'margin-right:10px;width:14px' }, lbl));
          Store.state.profiles.forEach(p => {
            row.appendChild(h('span', {
              class: 'chip' + (cur && cur.id === p.id ? ' on' : ''),
              onClick: () => { set(p); renderSel(); renderOut(); }
            }, UI.avatar(p.name), p.name));
          });
          selHost.appendChild(row);
        });
      }
      function renderOut() {
        out.innerHTML = '';
        if (!a || !b || a.id === b.id) { out.appendChild(h('div', { class: 'sub center', style: 'margin-top:16px' }, t('h2h_pick'))); return; }
        let winsA = 0, winsB = 0;
        Store.state.matches.forEach(m => {
          if (m.mode !== 'x01') return;
          const ia = m.players.findIndex(p => p.profileId === a.id);
          const ib = m.players.findIndex(p => p.profileId === b.id);
          if (ia < 0 || ib < 0) return;
          if (m.winnerIdx === ia) winsA++;
          if (m.winnerIdx === ib) winsB++;
        });
        out.appendChild(h('div', { class: 'hero center' },
          h('div', { class: 'micro', style: 'color:var(--mut2)' }, t('h2h_direct')),
          h('div', { class: 'big', style: 'font-size:38px' }, winsA + ' : ' + winsB),
          h('div', { class: 'sub' }, a.name + ' vs ' + b.name)));
        const rows = [
          ['Ø 3-Dart', UI.f1(Store.avgOf(a.agg)), UI.f1(Store.avgOf(b.agg))],
          ['Checkout %', Math.round(Store.coPct(a.agg)) + '%', Math.round(Store.coPct(b.agg)) + '%'],
          ['180er', a.agg.n180, b.agg.n180],
          ['High Finish', a.agg.hiFinish || '–', b.agg.hiFinish || '–'],
          [t('best_leg'), a.agg.bestLeg || '–', b.agg.bestLeg || '–'],
          [t('matches'), a.agg.matches, b.agg.matches]
        ];
        const tb = h('table', { class: 'tbl' },
          h('tr', null, h('th', null, ''), h('th', null, a.name), h('th', null, b.name)));
        rows.forEach(r => tb.appendChild(h('tr', null, h('td', { class: 'sub' }, r[0]), h('td', null, String(r[1])), h('td', null, String(r[2])))));
        out.appendChild(h('div', { class: 'card' }, tb));
        const sA = a.history.filter(x => x.avg).map(x => x.avg).slice(-15);
        const sB = b.history.filter(x => x.avg).map(x => x.avg).slice(-15);
        out.appendChild(h('div', { class: 'card' },
          h('div', { class: 'sub', style: 'margin-bottom:6px' },
            t('form_curve') + ' – ', h('span', { style: 'color:var(--grn)' }, a.name), ' / ',
            h('span', { style: 'color:var(--red)' }, b.name)),
          UI.lineChart([{ values: sA }, { values: sB }])));
      }
      renderSel(); renderOut();
    });
  }

  /* ---------- Stats-Tab ---------- */
  function statProfile() {
    const id = Store.state.settings.statsProfile;
    return Store.profile(id) || Store.state.profiles[0] || null;
  }

  function matchRow(p, m) {
    const me = m.players.findIndex(q => q.profileId === p.id);
    if (me < 0) return null;
    const won = m.winnerIdx === me;
    const others = m.players.filter((_, i) => i !== me).map(q => q.name).join(', ');
    const wd = new Date(m.d).toLocaleDateString(Store.state.settings.lang === 'de' ? 'de-DE' : 'en-GB', { weekday: 'short' });
    const meta = m.mode === 'x01'
      ? wd + ' · ' + m.start + (m.legs ? ' · Best of ' + m.legs : '')
      : wd + ' · ' + m.mode;
    const score = m.mode === 'x01' ? m.players.map(q => q.legs).join('–') : (won ? 'S' : 'N');
    return h('div', { class: 'resrow' },
      h('span', { class: 'rescircle' + (won ? ' win' : '') }, won ? 'S' : 'N'),
      h('span', { class: 'mtxt' },
        h('span', { class: 'ttl' }, t('vs_lbl') + ' ' + (others || '–')),
        h('span', { class: 'dsc' }, meta)),
      h('span', { class: 'score' }, score));
  }

  function renderTab(view) {
    view.appendChild(h('h1', null, t('nav_stats')));
    if (!Store.state.profiles.length) {
      view.appendChild(h('div', { class: 'card center' },
        h('div', { class: 'sub', style: 'margin-bottom:12px' }, t('need_profile_stats')),
        h('button', { class: 'btn', onClick: () => App.editProfile(null, () => App.rerender()) }, '+ ' + t('new_profile'))));
      return;
    }
    const p = statProfile();
    const chips = h('div', { style: 'margin-bottom:14px;display:flex;flex-wrap:wrap' });
    Store.state.profiles.forEach(q => {
      chips.appendChild(h('span', {
        class: 'chip' + (p && q.id === p.id ? ' on' : ''),
        onClick: () => { Store.state.settings.statsProfile = q.id; Store.save(); App.rerender(); }
      }, UI.avatar(q.name), q.name));
    });
    view.appendChild(chips);
    if (!p) return;
    const a = p.agg;

    // Kachel-Grid 2×2
    const tile = (l, v) => h('div', { class: 'tile' }, h('span', { class: 'tl' }, l), h('span', { class: 'tv' }, String(v)));
    view.appendChild(h('div', { class: 'tiles' },
      tile('3-Dart-Ø', UI.f1(Store.avgOf(a))),
      tile(t('best_leg'), a.bestLeg ? a.bestLeg + ' Darts' : '–'),
      tile('180er', a.n180),
      tile('Checkout-' + t('rate_lbl'), a.coAtt ? Math.round(Store.coPct(a)) + ' %' : '–')));

    // Form (letzte 10)
    const avgs = p.history.filter(x => x.avg).map(x => x.avg).slice(-10);
    view.appendChild(h('div', { class: 'mlabel' }, t('form_lbl')));
    view.appendChild(h('div', { class: 'card' },
      avgs.length ? UI.barsChart(avgs) : h('div', { class: 'sub' }, t('no_data')),
      h('div', { class: 'fcap' }, t('avg_last10'))));

    // Letzte Matches
    const mine = Store.state.matches.filter(m => m.players.some(q => q.profileId === p.id)).slice(-6).reverse();
    if (mine.length) {
      view.appendChild(h('div', { class: 'mlabel' }, t('last_matches_lbl')));
      mine.forEach(m => { const r = matchRow(p, m); if (r) view.appendChild(r); });
    }

    // Mehr Werte
    view.appendChild(h('div', { class: 'mlabel' }, t('more_stats')));
    view.appendChild(h('div', { class: 'tiles' },
      tile('First 9', a.f9darts ? UI.f1((a.f9points / a.f9darts) * 3) : '–'),
      tile(t('winrate'), a.matches ? Math.round((a.wins / a.matches) * 100) + ' %' : '–'),
      tile('High Finish', a.hiFinish || '–'),
      tile(t('matches'), a.matches),
      tile('100+ / 140+', a.n100 + ' / ' + a.n140),
      tile(t('streak'), Store.trainStreak(p) + ' ' + t('days_lbl'))));

    // Aktionen
    view.appendChild(h('div', { class: 'row', style: 'margin:14px 0 4px' },
      h('button', { class: 'btn sec small', style: 'flex:1', onClick: () => showRecs(p) }, t('recommendations')),
      h('button', { class: 'btn sec small', style: 'flex:1', onClick: () => achScreen(p) }, t('achievements')),
      h('button', { class: 'btn sec small', style: 'flex:1', onClick: () => h2hScreen() }, 'H2H')));

    // Trainings-Verläufe
    const trainCards = [];
    Training.TRAIN_DEFS.forEach(m => {
      const tr = p.trainings[m.id];
      if (!tr || !tr.series || tr.series.length < 1) return;
      trainCards.push(h('div', { class: 'card' },
        h('div', { class: 'row', style: 'margin-bottom:6px' },
          h('div', { class: 'sub grow' }, t(m.name)),
          h('div', { style: 'font-weight:700' }, 'Best: ' + tr.best)),
        UI.lineChart([{ values: tr.series.map(s => s.v).slice(-20) }])));
    });
    if (trainCards.length) {
      view.appendChild(h('div', { class: 'mlabel' }, t('nav_training')));
      trainCards.forEach(c => view.appendChild(c));
    }

    // Doppel-Quoten
    const dEntries = Object.entries(a.doubles).filter(([, d]) => d.a > 0).sort((x, y) => y[1].a - x[1].a).slice(0, 12);
    if (dEntries.length) {
      const tb = h('table', { class: 'tbl' },
        h('tr', null, h('th', null, t('double_col')), h('th', null, t('hits')), h('th', null, '%'), h('th', { style: 'width:40%' }, '')));
      dEntries.forEach(([k, d]) => {
        const r = Math.round((d.h / d.a) * 100);
        tb.appendChild(h('tr', null,
          h('td', { style: 'font-weight:700' }, k === 'DB' ? 'Bull' : k),
          h('td', null, d.h + '/' + d.a),
          h('td', null, r + '%'),
          h('td', null, h('div', { class: 'bar' + (r < 25 ? ' low' : '') }, h('i', { style: `width:${r}%` })))));
      });
      view.appendChild(h('div', { class: 'mlabel' }, t('double_rates')));
      view.appendChild(h('div', { class: 'card' }, tb));
    }

    // Heatmap
    if (Object.keys(a.heat).length) {
      view.appendChild(h('div', { class: 'mlabel' }, t('heatmap')));
      view.appendChild(h('div', { class: 'card' },
        h('div', { class: 'sub', style: 'margin-bottom:6px' }, t('heatmap_hint')),
        UI.boardSVG({ heat: a.heat })));
    }
  }

  return { renderTab, recordX01Match, recordCasual, afterTraining, recordTourWin, check, ACH, achScreen };
})();
