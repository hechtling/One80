/* One80 – Eigene Turniere: KO, Liga (Round Robin), Gruppen + KO */
const Tour = (() => {

  const shuffle = arr => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const pairs = idxs => {
    const out = [];
    for (let i = 0; i < idxs.length; i++)
      for (let j = i + 1; j < idxs.length; j++) out.push([idxs[i], idxs[j]]);
    return shuffle(out);
  };

  /* ---------- Strukturen ---------- */

  function buildKORounds(seedIdxs) {
    const n = seedIdxs.length;
    const size = Math.pow(2, Math.ceil(Math.log2(Math.max(2, n))));
    const slots = seedIdxs.slice();
    while (slots.length < size) slots.push(null);
    const rounds = [];
    let mCount = size / 2;
    for (let r = 0; mCount >= 1; r++) {
      rounds.push(Array.from({ length: mCount }, (_, m) => ({
        p1: r === 0 ? slots[m * 2] : null,
        p2: r === 0 ? slots[m * 2 + 1] : null,
        winner: null, legs: [0, 0]
      })));
      mCount = Math.floor(mCount / 2);
    }
    rounds[0].forEach((m, i) => {
      if (m.p1 !== null && m.p2 === null) setKOWinner(rounds, 0, i, m.p1);
      else if (m.p1 === null && m.p2 !== null) setKOWinner(rounds, 0, i, m.p2);
    });
    return rounds;
  }

  function setKOWinner(rounds, r, mIdx, wIdx, legs) {
    const m = rounds[r][mIdx];
    m.winner = wIdx;
    if (legs) m.legs = legs;
    if (r + 1 < rounds.length) {
      const nm = rounds[r + 1][Math.floor(mIdx / 2)];
      if (mIdx % 2 === 0) nm.p1 = wIdx; else nm.p2 = wIdx;
    }
  }

  function standings(idxs, matches) {
    const rows = idxs.map(i => ({ i, pl: 0, w: 0, lf: 0, la: 0 }));
    const rowOf = i => rows.find(r => r.i === i);
    matches.forEach(m => {
      if (m.winner === null) return;
      const ra = rowOf(m.a), rb = rowOf(m.b);
      if (!ra || !rb) return;
      ra.pl++; rb.pl++;
      ra.lf += m.legs[0]; ra.la += m.legs[1];
      rb.lf += m.legs[1]; rb.la += m.legs[0];
      if (m.winner === m.a) ra.w++; else rb.w++;
    });
    rows.sort((x, y) => y.w - x.w || (y.lf - y.la) - (x.lf - x.la) || y.lf - x.lf);
    return rows;
  }

  function createTournament(name, mode, players, x01) {
    const tn = {
      id: Store.uid(), name, mode, created: Date.now(),
      players: players.map(p => ({ name: p.name, profileId: p.profileId || null })),
      x01, status: 'run', winnerIdx: null
    };
    const idxs = shuffle(players.map((_, i) => i));
    if (mode === 'ko') tn.rounds = buildKORounds(idxs);
    else if (mode === 'rr') tn.matches = pairs(idxs).map(([a, b]) => ({ a, b, winner: null, legs: [0, 0] }));
    else {
      tn.groups = [[], []];
      idxs.forEach((i, k) => tn.groups[k % 2].push(i));
      tn.gMatches = [];
      tn.groups.forEach((g, gi) => pairs(g).forEach(([a, b]) => tn.gMatches.push({ g: gi, a, b, winner: null, legs: [0, 0] })));
      tn.koRounds = null;
    }
    Store.state.tournaments.push(tn);
    Store.save();
    return tn;
  }

  const pname = (tn, idx) => (idx === null || idx === undefined) ? '–' : tn.players[idx].name;

  function finishTournament(tn, wIdx) {
    tn.status = 'done';
    tn.winnerIdx = wIdx;
    const w = tn.players[wIdx];
    UI.sfx.win();
    UI.toast(pname(tn, wIdx) + ' ' + t('tour_won'), 'gold');
    if (w.profileId) Stats.recordTourWin(w.profileId);
    Store.save();
  }

  /* ---------- Match spielen ---------- */
  function playMatch(tn, a, b, onResult) {
    const cfg = {
      start: tn.x01.start, out: 'double', din: false,
      legs: tn.x01.legs, sets: 1,
      players: [tn.players[a], tn.players[b]]
    };
    Games.startX01(cfg, res => {
      const wIdx = res.winnerIdx === 0 ? a : b;
      onResult(wIdx, res.legs);
      Store.save();
      App.back(); // Match schließen → Turnieransicht
    });
  }

  /* ---------- Detail-Ansicht ---------- */
  function detailScreen(tn) {
    App.show(view => {
      const modeLbl = { ko: 'KO', rr: t('t_league'), gko: t('t_groups') }[tn.mode];
      view.appendChild(h('div', { class: 'shead' },
        h('button', { class: 'cbtn', onClick: () => App.back() }, '‹'),
        h('div', { class: 'ttl' }, tn.name,
          h('div', { class: 'sub2' }, modeLbl + ' · ' + tn.players.length + ' ' + t('players') + ' · ' + tn.x01.start + ', Best of ' + tn.x01.legs))));

      if (tn.status === 'done') {
        view.appendChild(h('div', { class: 'hero center', style: 'margin-top:6px' },
          h('div', { class: 'micro', style: 'color:var(--grn)' }, t('tour_champion')),
          h('div', { class: 'big', style: 'margin-top:4px' }, pname(tn, tn.winnerIdx))));
      }

      const matchCard = (m, a, b, playable, onPlay, isFirstRound) => {
        const done = m.winner !== null;
        const lbl = x => x !== null ? pname(tn, x) : (isFirstRound ? t('bye') : '…');
        return h('div', {
          class: 'bmatch' + (playable ? ' open' : ''),
          style: 'margin-bottom:8px',
          onClick: playable ? onPlay : null
        },
          h('div', { class: 'bp' + (done ? (m.winner === a ? ' w' : ' l') : '') },
            h('span', null, lbl(a)),
            h('span', null, done ? String(m.legs[0]) : '')),
          h('div', { class: 'bp' + (done ? (m.winner === b ? ' w' : ' l') : '') },
            h('span', null, lbl(b)),
            h('span', null, done ? String(m.legs[1]) : '')),
          playable ? h('div', { style: 'font-size:11px;font-weight:600;color:var(--grn);margin-top:2px' }, t('play_match')) : null);
      };

      function renderKO(rounds, container, onWin) {
        const wrap = h('div', { class: 'bracket' });
        rounds.forEach((rd, r) => {
          const col = h('div', { class: 'bround' });
          const rName = rd.length === 1 ? t('final') : rd.length === 2 ? t('semifinal') : t('round_n', { n: r + 1 });
          col.appendChild(h('div', { class: 'sub center' }, rName));
          rd.forEach((m, mi) => {
            const playable = tn.status === 'run' && m.p1 !== null && m.p2 !== null && m.winner === null;
            col.appendChild(matchCard(m, m.p1, m.p2, playable, () => {
              playMatch(tn, m.p1, m.p2, (wIdx, legs) => {
                setKOWinner(rounds, r, mi, wIdx, wIdx === m.p1 ? legs : [legs[1], legs[0]]);
                if (r === rounds.length - 1) onWin(wIdx);
              });
            }, r === 0));
          });
          wrap.appendChild(col);
        });
        container.appendChild(wrap);
      }

      function renderTable(idxs, matches, container) {
        const rows = standings(idxs, matches);
        const tb = h('table', { class: 'tbl' },
          h('tr', null, h('th', null, ''), h('th', null, t('games_short')), h('th', null, 'S'), h('th', null, '+/−'), h('th', null, 'Legs')));
        rows.forEach((r, pos) => {
          tb.appendChild(h('tr', null,
            h('td', null, (pos + 1) + '. ' + pname(tn, r.i)),
            h('td', null, String(r.pl)), h('td', { style: 'font-weight:700' }, String(r.w)),
            h('td', null, String(r.lf - r.la)), h('td', null, r.lf + ':' + r.la)));
        });
        container.appendChild(h('div', { class: 'card', style: 'padding:8px 12px' }, tb));
        return rows;
      }

      if (tn.mode === 'ko') {
        renderKO(tn.rounds, view, wIdx => finishTournament(tn, wIdx));
      } else if (tn.mode === 'rr') {
        renderTable(tn.players.map((_, i) => i), tn.matches, view);
        view.appendChild(h('div', { class: 'mlabel' }, t('matches')));
        tn.matches.forEach(m => {
          const playable = tn.status === 'run' && m.winner === null;
          view.appendChild(matchCard(m, m.a, m.b, playable, () => {
            playMatch(tn, m.a, m.b, (wIdx, legs) => {
              m.winner = wIdx;
              m.legs = wIdx === m.a ? legs : [legs[1], legs[0]];
              if (tn.matches.every(x => x.winner !== null)) {
                const rows = standings(tn.players.map((_, i) => i), tn.matches);
                finishTournament(tn, rows[0].i);
              }
            });
          }));
        });
      } else { /* Gruppen + KO */
        tn.groups.forEach((g, gi) => {
          view.appendChild(h('div', { class: 'mlabel' }, t('group') + ' ' + String.fromCharCode(65 + gi)));
          const gm = tn.gMatches.filter(m => m.g === gi);
          renderTable(g, gm, view);
          gm.forEach(m => {
            const playable = tn.status === 'run' && !tn.koRounds && m.winner === null;
            view.appendChild(matchCard(m, m.a, m.b, playable, () => {
              playMatch(tn, m.a, m.b, (wIdx, legs) => {
                m.winner = wIdx;
                m.legs = wIdx === m.a ? legs : [legs[1], legs[0]];
                if (tn.gMatches.every(x => x.winner !== null) && !tn.koRounds) {
                  const sA = standings(tn.groups[0], tn.gMatches.filter(x => x.g === 0));
                  const sB = standings(tn.groups[1], tn.gMatches.filter(x => x.g === 1));
                  tn.koRounds = buildKORounds([sA[0].i, sB[1].i, sB[0].i, sA[1].i]);
                }
              });
            }));
          });
        });
        if (tn.koRounds) {
          view.appendChild(h('div', { class: 'mlabel' }, t('ko_phase')));
          renderKO(tn.koRounds, view, wIdx => finishTournament(tn, wIdx));
        } else {
          view.appendChild(h('div', { class: 'sub center', style: 'margin-top:10px' }, t('gko_hint')));
        }
      }

      view.appendChild(h('button', {
        class: 'btn sec', style: 'margin-top:18px;height:46px;font-size:14px',
        onClick: () => UI.confirm(t('del_tour_q'), () => {
          Store.state.tournaments = Store.state.tournaments.filter(x => x.id !== tn.id);
          Store.save(); App.back();
        })
      }, t('del_tour')));
    });
  }

  /* ---------- Erstellen ---------- */
  function createScreen() {
    App.show(view => {
      view.appendChild(h('div', { class: 'shead' },
        h('button', { class: 'cbtn', onClick: () => App.back() }, '‹'),
        h('div', { class: 'ttl' }, t('new_tour'))));
      const nameInp = h('input', { type: 'text', value: t('tour_default_name') + ' ' + new Date().toLocaleDateString() });
      view.appendChild(h('div', { class: 'mlabel', style: 'margin-top:6px' }, t('tour_name')));
      view.appendChild(nameInp);
      const pLabel = h('div', { class: 'mlabel' }, t('players'));
      view.appendChild(pLabel);
      const pickHost = h('div');
      view.appendChild(pickHost);
      const picker = Games.playerPicker(pickHost, {
        bot: false, max: 16,
        onChange: n => { pLabel.textContent = t('players_of', { a: n, b: 16 }); }
      });
      let mode = 'ko', start = 501, legs = 3;
      view.appendChild(h('div', { class: 'mlabel' }, t('mode')));
      view.appendChild(Games.segPick(['ko', 'rr', 'gko'], ['KO', t('t_league'), t('t_groups')], mode, v => mode = v));
      view.appendChild(h('div', { class: 'mlabel' }, t('points_lbl')));
      view.appendChild(Games.segPick([301, 501], ['301', '501'], start, v => start = v));
      view.appendChild(h('div', { class: 'mlabel' }, 'Legs'));
      view.appendChild(Games.segPick([1, 3, 5], ['Best of 1', 'Best of 3', 'Best of 5'], legs, v => legs = v));
      view.appendChild(h('button', {
        class: 'btn', style: 'margin-top:22px', onClick: () => {
          const players = picker.players();
          const min = mode === 'gko' ? 4 : 2;
          if (players.length < min) { UI.toast(t('need_players', { n: min })); return; }
          const tour = createTournament(nameInp.value.trim() || t('tour_default_name'), mode, players, { start, legs });
          App.back();
          detailScreen(tour);
        }
      }, t('create_tour')));
    });
  }

  /* ---------- Tab ---------- */
  function renderTab(view) {
    view.appendChild(h('h1', null, t('nav_tour')));
    const ts = Store.state.tournaments.slice().reverse();
    if (!ts.length) {
      view.appendChild(h('div', { class: 'empty' },
        h('div', { html: '<svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="var(--dim)" stroke-width="1.4"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3" fill="var(--dim)" stroke="none"/></svg>' }),
        h('div', { class: 'et' }, t('no_tours_t')),
        h('div', { class: 'ed' }, t('no_tours_d')),
        h('button', { class: 'btn', onClick: createScreen }, t('create_tour_btn'))));
      return;
    }
    view.appendChild(h('button', { class: 'btn', style: 'margin:8px 0 16px', onClick: createScreen }, '+ ' + t('new_tour')));
    ts.forEach(tour => {
      const modeLbl = { ko: 'KO', rr: t('t_league'), gko: t('t_groups') }[tour.mode];
      view.appendChild(h('div', { class: 'mrow', onClick: () => detailScreen(tour) },
        h('span', { class: 'badge', style: tour.status === 'done' ? 'background:var(--grnT);color:var(--grn)' : '' },
          tour.mode === 'ko' ? 'KO' : tour.mode === 'rr' ? 'LI' : 'GR'),
        h('span', { class: 'mtxt' },
          h('span', { class: 'ttl' }, tour.name),
          h('span', { class: 'dsc' }, modeLbl + ' · ' + tour.players.length + ' ' + t('players') +
            (tour.status === 'done' ? ' · ' + t('winner_lbl') + ': ' + pname(tour, tour.winnerIdx) : ''))),
        h('span', { class: 'chev' }, '›')));
    });
  }

  return { renderTab };
})();
