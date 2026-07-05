/* One80 – Statistiken, Erfolge, Trainings-Empfehlungen, Head-to-Head */
const Stats = (() => {

  /* ---------- Erfolge ---------- */
  const ACH = [
    { id: 'first_win', icon: '🏁', prog: p => [Math.min(1, p.agg.wins), 1] },
    { id: 'm10', icon: '🎲', prog: p => [Math.min(10, p.agg.matches), 10] },
    { id: 'm50', icon: '🎰', prog: p => [Math.min(50, p.agg.matches), 50] },
    { id: 't180', icon: '💥', prog: p => [Math.min(1, p.agg.n180), 1] },
    { id: 't180x10', icon: '🔥', prog: p => [Math.min(10, p.agg.n180), 10] },
    { id: 'ton', icon: '💯', prog: p => [Math.min(1, p.agg.n100 + p.agg.n140 + p.agg.n180), 1] },
    { id: 'hf100', icon: '🚀', prog: p => [p.agg.hiFinish >= 100 ? 1 : 0, 1] },
    { id: 'hf150', icon: '🌟', prog: p => [p.agg.hiFinish >= 150 ? 1 : 0, 1] },
    { id: 'avg50', icon: '📈', prog: p => [(p.agg.bestAvg || 0) >= 50 ? 1 : 0, 1] },
    { id: 'avg70', icon: '🏹', prog: p => [(p.agg.bestAvg || 0) >= 70 ? 1 : 0, 1] },
    { id: 'leg15', icon: '⚡', prog: p => [p.agg.bestLeg && p.agg.bestLeg <= 15 ? 1 : 0, 1] },
    { id: 'leg9', icon: '👑', prog: p => [p.agg.bestLeg === 9 ? 1 : 0, 1] },
    { id: 'bull_finish', icon: '🎯', flag: 'bullFinish' },
    { id: 'shanghai_fin', icon: '🀄', flag: 'shanghai' },
    { id: 'bob_survive', icon: '🛡', flag: 'bobSurvive' },
    { id: 'jdc500', icon: '🏅', prog: p => [(p.trainings.jdc && p.trainings.jdc.best >= 500) ? 1 : 0, 1] },
    { id: 'ladder100', icon: '🪜', prog: p => [Math.min(100, p.ladderLevel || 0), 100] },
    { id: 'streak3', icon: '📅', prog: p => [Math.min(3, Store.trainStreak(p)), 3] },
    { id: 'streak7', icon: '🗓', prog: p => [Math.min(7, Store.trainStreak(p)), 7] },
    { id: 'doubles50', icon: '✌️', flag: 'doubles50' },
    { id: 'tourwin', icon: '🏆', prog: p => [Math.min(1, p.agg.tourWins || 0), 1] }
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
      fresh.forEach(a => UI.toast(a.icon + ' ' + t('ach_unlocked') + ': ' + t('ach_' + a.id), 'gold'));
    }
    return fresh;
  }

  /* ---------- Match-Erfassung ---------- */
  function recordX01Match(st) {
    const summary = {
      d: Date.now(), mode: 'x01', start: st.cfg.start, winnerIdx: st.winnerIdx,
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
      recs.push({ icon: '🏁', txt: t('rec_co', { v: Math.round(co) }), mode: 'checkout' });
    // schwächstes Doppel
    let worst = null;
    for (const k in a.doubles) {
      const d = a.doubles[k];
      if (d.a >= 6) {
        const r = d.h / d.a;
        if (!worst || r < worst.r) worst = { k, r, d };
      }
    }
    if (worst && worst.r < 0.25)
      recs.push({ icon: '🔂', txt: t('rec_double', { d: worst.k === 'DB' ? 'Bull' : worst.k, v: Math.round(worst.r * 100) }), mode: 'double_single' });
    if (avg > 0 && avg < 45)
      recs.push({ icon: '💥', txt: t('rec_scoring', { v: UI.f1(avg) }), mode: 'scoring' });
    if (Store.trainStreak(p) === 0 && p.trainDays.length > 0)
      recs.push({ icon: '🔥', txt: t('rec_streak'), mode: null });
    if (p.ladderLevel)
      recs.push({ icon: '🪜', txt: t('rec_ladder', { v: p.ladderLevel }), mode: 'ladder' });
    if (p.trainings.bobs27 && p.trainings.bobs27.best !== null && p.trainings.bobs27.best < 27)
      recs.push({ icon: '🛡', txt: t('rec_bobs'), mode: 'bobs27' });
    if (!recs.length) recs.push({ icon: '✅', txt: t('rec_ok'), mode: null });
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
        h('div', { class: 'ic' }, r.icon),
        h('div', { class: 'grow', style: 'font-size:14px' }, r.txt),
        r.mode ? h('div', { class: 'arr' }, '›') : null));
    });
    UI.modal({ title: '🧠 ' + t('recommendations'), body, buttons: [{ label: t('ok') }] });
  }

  /* ---------- Erfolge-Screen ---------- */
  function achScreen(p) {
    App.show(view => {
      view.appendChild(h('div', { class: 'mhead' },
        h('button', { class: 'iconbtn', onClick: () => App.back() }, '‹'),
        h('div', { class: 'ttl' }, '🏅 ' + t('achievements') + ' – ' + p.name)));
      const total = ACH.length, got = ACH.filter(a => p.achievements[a.id]).length;
      view.appendChild(h('div', { class: 'sub', style: 'margin-bottom:10px' }, got + ' / ' + total));
      ACH.forEach(a => {
        const won = !!p.achievements[a.id];
        let progEl = null;
        if (!won && a.prog) {
          const [cur, max] = a.prog(p);
          if (max > 1) progEl = h('div', { class: 'bar', style: 'margin-top:5px' }, h('i', { style: `width:${(cur / max) * 100}%` }));
        }
        view.appendChild(h('div', { class: 'card' },
          h('div', { class: 'ach' + (won ? ' won' : '') },
            h('div', { class: 'ic' }, a.icon),
            h('div', { class: 'grow' },
              h('div', { style: 'font-weight:700' }, t('ach_' + a.id)),
              h('div', { class: 'sub' }, t('ach_' + a.id + '_d')),
              progEl,
              won ? h('div', { class: 'sub', style: 'color:var(--gold)' }, UI.dstr(p.achievements[a.id])) : null))));
      });
    });
  }

  /* ---------- Head-to-Head ---------- */
  function h2hScreen() {
    App.show(view => {
      view.appendChild(h('div', { class: 'mhead' },
        h('button', { class: 'iconbtn', onClick: () => App.back() }, '‹'),
        h('div', { class: 'ttl' }, '⚔️ Head-to-Head')));
      let a = Store.state.profiles[0] || null, b = Store.state.profiles[1] || null;
      const selHost = h('div', { class: 'card' });
      const out = h('div');
      view.append(selHost, out);
      function renderSel() {
        selHost.innerHTML = '';
        [['A', a, v => a = v], ['B', b, v => b = v]].forEach(([lbl, cur, set]) => {
          const row = h('div', { style: 'margin-bottom:4px' }, h('span', { class: 'sub', style: 'margin-right:8px' }, lbl + ':'));
          Store.state.profiles.forEach(p => {
            row.appendChild(h('span', {
              class: 'chip' + (cur && cur.id === p.id ? ' on' : ''),
              onClick: () => { set(p); renderSel(); renderOut(); }
            }, p.emoji + ' ' + p.name));
          });
          selHost.appendChild(row);
        });
      }
      function renderOut() {
        out.innerHTML = '';
        if (!a || !b || a.id === b.id) { out.appendChild(h('div', { class: 'sub center' }, t('h2h_pick'))); return; }
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
          h('div', { class: 'sub' }, t('h2h_direct')),
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
          h('tr', null, h('th', null, ''), h('th', null, a.emoji + ' ' + a.name), h('th', null, b.emoji + ' ' + b.name)));
        rows.forEach(r => tb.appendChild(h('tr', null, h('td', { class: 'sub' }, r[0]), h('td', null, String(r[1])), h('td', null, String(r[2])))));
        out.appendChild(h('div', { class: 'card' }, tb));
        const sA = a.history.filter(x => x.avg).map(x => x.avg).slice(-15);
        const sB = b.history.filter(x => x.avg).map(x => x.avg).slice(-15);
        out.appendChild(h('div', { class: 'card' },
          h('div', { class: 'sub', style: 'margin-bottom:6px' },
            t('form_curve') + ' – ', h('span', { style: 'color:var(--green)' }, a.name), ' / ',
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

  function renderTab(view) {
    view.appendChild(h('h1', null, '📈 ' + t('nav_stats')));
    if (!Store.state.profiles.length) {
      view.appendChild(h('div', { class: 'card center' },
        h('div', { class: 'sub', style: 'margin-bottom:10px' }, t('need_profile_stats')),
        h('button', { class: 'btn', onClick: () => App.editProfile(null, () => App.rerender()) }, '＋ ' + t('new_profile'))));
      return;
    }
    const p = statProfile();
    const chips = h('div', { style: 'margin-bottom:8px' });
    Store.state.profiles.forEach(q => {
      chips.appendChild(h('span', {
        class: 'chip' + (p && q.id === p.id ? ' on' : ''),
        onClick: () => { Store.state.settings.statsProfile = q.id; Store.save(); App.rerender(); }
      }, h('span', { class: 'av' }, q.emoji), q.name));
    });
    view.appendChild(chips);
    if (!p) return;
    const a = p.agg;
    const stat = (v, l) => h('div', { class: 'stat' }, h('div', { class: 'v' }, String(v)), h('div', { class: 'l' }, l));
    view.appendChild(h('div', { class: 'card' },
      h('div', { class: 'statgrid' },
        stat(UI.f1(Store.avgOf(a)), 'Ø 3-Dart'),
        stat(a.f9darts ? UI.f1((a.f9points / a.f9darts) * 3) : '–', 'First 9'),
        stat(a.coAtt ? Math.round(Store.coPct(a)) + '%' : '–', 'Checkout'),
        stat(a.matches, t('matches')),
        stat(a.matches ? Math.round((a.wins / a.matches) * 100) + '%' : '–', t('winrate')),
        stat(a.hiFinish || '–', 'High Finish'),
        stat(a.n180, '180er'),
        stat(a.bestLeg || '–', t('best_leg')),
        stat('🔥' + Store.trainStreak(p), t('streak'))
      )));
    // Aktionen
    view.appendChild(h('div', { class: 'row', style: 'margin-bottom:12px' },
      h('button', { class: 'btn sec small', style: 'flex:1', onClick: () => showRecs(p) }, '🧠 ' + t('recommendations')),
      h('button', { class: 'btn sec small', style: 'flex:1', onClick: () => achScreen(p) }, '🏅 ' + t('achievements')),
      h('button', { class: 'btn sec small', style: 'flex:1', onClick: () => h2hScreen() }, '⚔️ H2H')));
    // Formkurve
    const avgs = p.history.filter(x => x.avg).map(x => x.avg).slice(-20);
    view.appendChild(h('div', { class: 'card' },
      h('div', { class: 'sub', style: 'margin-bottom:6px' }, t('form_curve') + ' (Ø 3-Dart, ' + t('last_matches', { n: avgs.length }) + ')'),
      UI.lineChart([{ values: avgs }])));
    // Trainings-Verläufe
    Training.TRAIN_DEFS.forEach(m => {
      const tr = p.trainings[m.id];
      if (!tr || !tr.series || tr.series.length < 1) return;
      view.appendChild(h('div', { class: 'card' },
        h('div', { class: 'row', style: 'margin-bottom:6px' },
          h('div', { class: 'sub grow' }, m.icon + ' ' + t(m.name)),
          h('div', { style: 'font-weight:800' }, 'Best: ' + tr.best)),
        UI.lineChart([{ values: tr.series.map(s => s.v).slice(-20) }])));
    });
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
      view.appendChild(h('div', { class: 'card' },
        h('div', { class: 'sub', style: 'margin-bottom:6px' }, t('double_rates')), tb));
    }
    // Heatmap
    if (Object.keys(a.heat).length) {
      view.appendChild(h('div', { class: 'card' },
        h('div', { class: 'sub', style: 'margin-bottom:6px' }, '🔥 ' + t('heatmap') + ' (' + t('heatmap_hint') + ')'),
        UI.boardSVG({ heat: a.heat })));
    }
  }

  return { renderTab, recordX01Match, recordCasual, afterTraining, recordTourWin, check, ACH, achScreen };
})();
