/* One80 – Freunde: Profil-Export als Share-Code, Import, Vergleich, Rangliste */
const Friends = (() => {

  const PREFIX = 'ONE80.';
  /* Basis für QR-Links. Wird zur Laufzeit aus der Adresse abgeleitet, sofern die App
     unter http(s) läuft – in der APK (file://, localhost) greift der feste Fallback. */
  const HOME = 'https://hechtling.github.io/One80/';

  function makeSnapshot(p) {
    const a = p.agg;
    return {
      v: 1, n: p.name, ts: Date.now(),
      agg: {
        matches: a.matches, wins: a.wins,
        avg: Math.round(Store.avgOf(a) * 10) / 10,
        f9: a.f9darts ? Math.round((a.f9points / a.f9darts) * 30) / 10 : 0,
        co: a.coAtt ? Math.round(Store.coPct(a)) : 0,
        hi: a.hiFinish, n180: a.n180, bestLeg: a.bestLeg
      },
      series: p.history.filter(x => x.avg).map(x => x.avg).slice(-15)
    };
  }

  function encode(p) {
    return PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(makeSnapshot(p)))));
  }

  function decode(code) {
    code = code.trim();
    if (!code.startsWith(PREFIX)) throw new Error('bad prefix');
    const snap = JSON.parse(decodeURIComponent(escape(atob(code.slice(PREFIX.length)))));
    if (!snap || snap.v !== 1 || !snap.n || !snap.agg) throw new Error('bad data');
    return snap;
  }

  /* Kompakter Link für QR-Code und zum Verschicken.
     base64url, damit im Hash nichts prozent-kodiert werden muss (spart QR-Größe). */
  function shareUrl(p) {
    const b64 = encode(p).slice(PREFIX.length)
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const base = /^https?:$/.test(location.protocol) ? location.href.split('#')[0] : HOME;
    return base + '#f=' + b64;
  }

  /* Akzeptiert rohen Share-Code, QR-Link oder kopierten Text und liefert den Share-Code */
  function normalize(text) {
    text = String(text || '').trim();
    const m = text.match(/[#?&]f=([A-Za-z0-9\-_+/=%]+)/);
    if (m) {
      let b64 = decodeURIComponent(m[1]).replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      return PREFIX + b64;
    }
    /* Code auch aus umgebendem Text herausschneiden (z. B. kopierte WhatsApp-Nachricht) */
    const c = text.match(/ONE80\.([A-Za-z0-9+/]+=*)/);
    return c ? PREFIX + c[1] : text;
  }

  function importCode(code) {
    const snap = decode(normalize(code));
    const existing = Store.state.friends.findIndex(f => f.n === snap.n);
    if (existing >= 0) { Store.state.friends[existing] = snap; }
    else Store.state.friends.push(snap);
    Store.save();
    return snap;
  }

  async function shareCode(code) {
    if (navigator.share) {
      try { await navigator.share({ title: 'One80', text: code }); return; } catch (e) { }
    }
    try {
      await navigator.clipboard.writeText(code);
      UI.toast(t('copied'));
    } catch (e) {
      UI.modal({ title: t('my_code'), body: h('code', { class: 'sharecode' }, code), buttons: [{ label: t('ok') }] });
    }
  }

  /* Kamera öffnen und gescannten Code importieren */
  function startScan() {
    QR.scan(
      text => {
        try {
          const snap = importCode(text);
          UI.toast(snap.n + ' ' + t('friend_added'));
          App.rerender();
        } catch (e) { UI.toast(t('invalid_code')); }
      },
      err => UI.toast(err === 'denied' ? t('cam_denied')
        : err === 'unsupported' ? t('cam_unsupported') : t('cam_error')),
      { hint: t('scan_hint') }
    );
  }

  /* Beim Start: geteilten Link (#f=…) auswerten und Import anbieten.
     Gibt true zurück, wenn ein Link erkannt wurde. */
  function handleLink() {
    if (!/[#?&]f=/.test(location.hash || '')) return false;
    const code = normalize(location.hash);
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { }
    let snap;
    try { snap = decode(code); } catch (e) { UI.toast(t('invalid_code')); return false; }
    UI.confirm(t('add_friend_q', { n: snap.n }), () => {
      importCode(code);
      UI.toast(snap.n + ' ' + t('friend_added'));
      App.rerender();
    });
    return true;
  }

  function compareScreen(f) {
    App.show(view => {
      view.appendChild(h('div', { class: 'shead' },
        h('button', { class: 'cbtn', onClick: () => App.back() }, '‹'),
        h('div', { class: 'ttl' }, f.n,
          h('div', { class: 'sub2' }, t('friend_since') + ' ' + UI.dstr(f.ts)))));
      const me = Store.profile(Store.state.settings.statsProfile) || Store.state.profiles[0];
      if (!me) { view.appendChild(h('div', { class: 'sub center' }, t('need_profile_stats'))); return; }
      const myAgg = me.agg;
      const rows = [
        ['Ø 3-Dart', UI.f1(Store.avgOf(myAgg)), f.agg.avg],
        ['First 9', myAgg.f9darts ? UI.f1((myAgg.f9points / myAgg.f9darts) * 3) : '–', f.agg.f9 || '–'],
        ['Checkout %', myAgg.coAtt ? Math.round(Store.coPct(myAgg)) + '%' : '–', (f.agg.co || 0) + '%'],
        ['180er', myAgg.n180, f.agg.n180],
        ['High Finish', myAgg.hiFinish || '–', f.agg.hi || '–'],
        [t('best_leg'), myAgg.bestLeg || '–', f.agg.bestLeg || '–'],
        [t('matches'), myAgg.matches, f.agg.matches],
        [t('winrate'), myAgg.matches ? Math.round((myAgg.wins / myAgg.matches) * 100) + '%' : '–',
          f.agg.matches ? Math.round((f.agg.wins / f.agg.matches) * 100) + '%' : '–']
      ];
      const tb = h('table', { class: 'tbl' },
        h('tr', null, h('th', null, ''), h('th', null, me.name), h('th', null, f.n)));
      rows.forEach(r => tb.appendChild(h('tr', null,
        h('td', { class: 'sub' }, r[0]), h('td', null, String(r[1])), h('td', null, String(r[2])))));
      view.appendChild(h('div', { class: 'card', style: 'margin-top:8px' }, tb));
      const mySeries = me.history.filter(x => x.avg).map(x => x.avg).slice(-15);
      view.appendChild(h('div', { class: 'card' },
        h('div', { class: 'sub', style: 'margin-bottom:6px' },
          t('form_curve') + ' – ', h('span', { style: 'color:var(--grn)' }, me.name), ' / ',
          h('span', { style: 'color:var(--red)' }, f.n)),
        UI.lineChart([{ values: mySeries }, { values: f.series || [] }])));
      view.appendChild(h('button', {
        class: 'btn sec', style: 'margin-top:14px;height:46px;font-size:14px',
        onClick: () => UI.confirm(t('remove_friend_q'), () => {
          Store.state.friends = Store.state.friends.filter(x => x !== f);
          Store.save(); App.back();
        })
      }, t('remove_friend')));
    });
  }

  function screen() {
    App.show(view => {
      view.appendChild(h('div', { class: 'shead' },
        h('button', { class: 'cbtn', onClick: () => App.back() }, '‹'),
        h('div', { class: 'ttl' }, t('friends'))));

      /* Mein Code */
      view.appendChild(h('div', { class: 'mlabel', style: 'margin-top:6px' }, t('my_code')));
      const card = h('div', { class: 'card' });
      view.appendChild(card);
      if (!Store.state.profiles.length) {
        card.appendChild(h('div', { class: 'sub' }, t('need_profile_stats')));
      } else {
        let selId = Store.state.settings.statsProfile || Store.state.profiles[0].id;
        let link = '';
        const qrBox = h('div', { class: 'qrbox' });
        const codeEl = h('code', { class: 'sharecode', style: 'display:none' });
        const chips = h('div', { style: 'display:flex;flex-wrap:wrap' });
        const toggle = h('button', {
          class: 'btn sec small', style: 'flex:1', onClick: () => {
            const open = codeEl.style.display === 'none';
            codeEl.style.display = open ? 'block' : 'none';
            toggle.textContent = open ? t('hide_code') : t('show_code');
          }
        }, t('show_code'));
        const upd = () => {
          const p = Store.profile(selId) || Store.state.profiles[0];
          link = shareUrl(p);
          codeEl.textContent = encode(p);
          /* Inhalt ist vollständig selbst erzeugt (nur Zahlen), daher unkritisch */
          qrBox.innerHTML = QR.svgString(link, { ec: 'M', quiet: 2 });
          [...chips.children].forEach(c => c.classList.toggle('on', c.dataset.id === p.id));
        };
        Store.state.profiles.forEach(p => {
          chips.appendChild(h('span', { class: 'chip', 'data-id': p.id, onClick: () => { selId = p.id; upd(); } },
            UI.avatar(p.name), p.name));
        });
        card.append(chips, qrBox,
          h('div', { class: 'sub center', style: 'margin:2px 0 10px' }, t('qr_hint')),
          codeEl,
          h('div', { class: 'row' },
            toggle,
            h('button', { class: 'btn small', style: 'flex:1', onClick: () => shareCode(link) }, t('share'))));
        upd();
      }

      /* Import */
      view.appendChild(h('div', { class: 'mlabel' }, t('add_friend')));
      const inp = h('input', { type: 'text', placeholder: 'ONE80.…' });
      const imp = h('div', { class: 'card' });
      if (QR.scanSupported()) {
        imp.append(
          h('button', { class: 'btn', style: 'height:48px;font-size:14px', onClick: startScan }, t('scan_qr')),
          h('div', { class: 'sub center', style: 'margin:12px 0 2px' }, t('or_paste')));
      }
      imp.append(
        h('label', { class: 'fld' }, t('paste_code'), inp),
        h('button', {
          class: 'btn sec', style: 'height:46px;font-size:14px', onClick: () => {
            try {
              const snap = importCode(inp.value);
              UI.toast(snap.n + ' ' + t('friend_added'));
              App.rerender();
            } catch (e) { UI.toast(t('invalid_code')); }
          }
        }, t('import')));
      view.appendChild(imp);

      /* Rangliste (Profile + Freunde) */
      const entries = [];
      Store.state.profiles.forEach(p => entries.push({
        n: p.name, avg: Math.round(Store.avgOf(p.agg) * 10) / 10, n180: p.agg.n180, hi: p.agg.hiFinish, me: true
      }));
      Store.state.friends.forEach(f => entries.push({ n: f.n, avg: f.agg.avg, n180: f.agg.n180, hi: f.agg.hi, me: false }));
      if (entries.length > 1) {
        entries.sort((a, b) => b.avg - a.avg);
        view.appendChild(h('div', { class: 'mlabel' }, t('leaderboard')));
        const tb = h('table', { class: 'tbl' },
          h('tr', null, h('th', null, '#'), h('th', null, ''), h('th', null, 'Ø'), h('th', null, '180'), h('th', null, 'HiFin')));
        entries.forEach((x, i) => {
          tb.appendChild(h('tr', null,
            h('td', null, String(i + 1)),
            h('td', { style: x.me ? 'font-weight:700' : '' }, x.n),
            h('td', null, String(x.avg)), h('td', null, String(x.n180)), h('td', null, String(x.hi || '–'))));
        });
        view.appendChild(h('div', { class: 'card' }, tb));
      }

      /* Freundesliste */
      view.appendChild(h('div', { class: 'mlabel' }, t('friends')));
      if (!Store.state.friends.length) {
        view.appendChild(h('div', { class: 'card center sub' }, t('no_friends')));
      } else {
        Store.state.friends.forEach(f => {
          view.appendChild(h('div', { class: 'rrow', onClick: () => compareScreen(f) },
            h('div', { class: 'row', style: 'min-width:0' },
              UI.avatar(f.n, 34),
              h('span', { class: 'rtxt' },
                h('span', { class: 'ttl' }, f.n),
                h('span', { class: 'dsc' }, 'Ø ' + f.agg.avg + ' · CO ' + (f.agg.co || 0) + '% · ' + t('updated') + ' ' + UI.dstr(f.ts)))),
            h('span', { class: 'chev' }, '›')));
        });
      }
    });
  }

  return { screen, handleLink };
})();
