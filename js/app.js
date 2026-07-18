/* One80 – App-Rahmen: Navigation, Profile, Einstellungen, Backup, Dart-Welt */
const App = (() => {

  let curTab = 'play';
  let stack = [];
  let installEvt = null;

  const tabs = {
    play: v => Games.renderTab(v),
    training: v => Training.renderTab(v),
    stats: v => Stats.renderTab(v),
    tour: v => Tour.renderTab(v),
    more: v => moreTab(v)
  };

  function renderView() {
    const view = document.getElementById('view');
    view.innerHTML = '';
    window.scrollTo(0, 0);
    if (stack.length) stack[stack.length - 1](view);
    else tabs[curTab](view);
  }

  function show(fn) { stack.push(fn); renderView(); }
  function back(n) {
    n = n || 1;
    while (n-- > 0 && stack.length) stack.pop();
    renderView();
  }
  function root(tab) {
    stack = [];
    if (tab) curTab = tab;
    gameMode(false);
    updateNav();
    renderView();
  }
  function rerender() { renderView(); }
  function gameMode(v) { document.body.classList.toggle('game-mode', v); }

  function updateNav() {
    document.querySelectorAll('#nav button').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === curTab);
    });
    document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
  }

  function applyTheme(v) {
    document.documentElement.setAttribute('data-theme', v);
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', v === 'light' ? '#F2F1E8' : '#0F1D16');
  }

  /* ---------- Profile ---------- */
  function editProfile(p, cb) {
    const nameInp = h('input', { type: 'text', value: p ? p.name : '', placeholder: t('profile_name') });
    const body = h('div', null, h('label', { class: 'fld' }, t('profile_name'), nameInp));
    if (p) {
      body.appendChild(h('button', {
        class: 'wlink', style: 'color:var(--red);padding:4px 0;margin-top:4px',
        onClick: () => {
          document.querySelector('.modal-back') && document.querySelector('.modal-back').remove();
          UI.confirm(t('delete_profile_q', { n: p.name }), () => { Store.deleteProfile(p.id); rerender(); });
        }
      }, t('delete_profile')));
    }
    UI.modal({
      title: p ? p.name : t('new_profile'),
      body,
      buttons: [
        { label: t('cancel'), cls: 'sec' },
        {
          label: t('ok'), onClick: () => {
            const name = nameInp.value.trim();
            if (!name) return;
            if (p) { p.name = name; Store.save(); if (cb) cb(p); }
            else { const np = Store.newProfile(name); if (cb) cb(np); }
            rerender();
          }
        }
      ]
    });
    setTimeout(() => nameInp.focus(), 60);
  }

  function profilesScreen() {
    show(view => {
      view.appendChild(h('div', { class: 'shead' },
        h('button', { class: 'cbtn', onClick: () => back() }, '‹'),
        h('div', { class: 'ttl' }, t('more_players'))));
      view.appendChild(h('button', {
        class: 'btn', style: 'margin:8px 0 16px',
        onClick: () => editProfile(null, () => rerender())
      }, '+ ' + t('new_profile')));
      if (!Store.state.profiles.length) {
        view.appendChild(h('div', { class: 'card center sub' }, t('no_profiles')));
        return;
      }
      Store.state.profiles.forEach(p => {
        view.appendChild(h('div', { class: 'rrow', onClick: () => editProfile(p, () => rerender()) },
          h('div', { class: 'row', style: 'min-width:0' },
            UI.avatar(p.name, 44),
            h('span', { class: 'rtxt' },
              h('span', { class: 'ttl' }, p.name),
              h('span', { class: 'dsc' },
                t('matches') + ': ' + p.agg.matches + ' · Ø ' + UI.f1(Store.avgOf(p.agg)) +
                ' · ' + Object.keys(p.achievements).length + ' ' + t('achievements')))),
          h('span', { class: 'chev' }, '›')));
      });
    });
  }

  /* ---------- Eingabe & Checkout ---------- */
  function inputSettingsScreen() {
    show(view => {
      const s = Store.state.settings;
      view.appendChild(h('div', { class: 'shead' },
        h('button', { class: 'cbtn', onClick: () => back() }, '‹'),
        h('div', { class: 'ttl' }, t('more_input'))));
      view.appendChild(h('div', { class: 'mlabel', style: 'margin-top:8px' }, t('default_input')));
      view.appendChild(Games.segPick(['board', 'keys', 'sum'], [t('inp_board'), t('inp_keys'), t('inp_sum')], s.input, v => { s.input = v; Store.save(); }));
      const mkTog = (label, key, def) => h('div', { class: 'toggline' }, h('span', null, label),
        h('label', { class: 'switch' },
          h('input', {
            type: 'checkbox', ...((s[key] !== undefined ? s[key] : def) ? { checked: '' } : {}),
            onChange: e => { s[key] = e.target.checked; Store.save(); }
          }),
          h('span')));
      view.appendChild(h('div', { class: 'mlabel' }, t('game_settings')));
      view.appendChild(h('div', { class: 'card' },
        mkTog(t('co_hints'), 'coHints', true),
        mkTog(t('caller_lbl'), 'caller', true),
        mkTog(t('sfx_lbl'), 'sfx', true),
        mkTog(t('vibrate_lbl'), 'vibrate', true)));
    });
  }

  /* ---------- Backup ---------- */
  function backupScreen() {
    show(view => {
      view.appendChild(h('div', { class: 'shead' },
        h('button', { class: 'cbtn', onClick: () => back() }, '‹'),
        h('div', { class: 'ttl' }, 'Backup')));
      view.appendChild(h('div', { class: 'card', style: 'margin-top:8px' },
        h('div', { class: 'sub', style: 'margin-bottom:12px' }, t('backup_hint')),
        h('button', {
          class: 'btn', onClick: () => {
            const blob = new Blob([Store.exportState()], { type: 'application/json' });
            const a = h('a', { href: URL.createObjectURL(blob), download: 'one80-backup-' + new Date().toISOString().slice(0, 10) + '.json' });
            document.body.appendChild(a); a.click(); a.remove();
            UI.toast(t('backup_done'));
          }
        }, t('backup_export'))));
      const file = h('input', { type: 'file', accept: '.json,application/json', style: 'margin-bottom:10px' });
      view.appendChild(h('div', { class: 'card' },
        h('div', { class: 'sub', style: 'margin-bottom:12px' }, t('import_hint')),
        file,
        h('button', {
          class: 'btn sec', onClick: () => {
            const f = file.files && file.files[0];
            if (!f) { UI.toast(t('pick_file')); return; }
            UI.confirm(t('import_confirm_q'), () => {
              const rd = new FileReader();
              rd.onload = () => {
                try { Store.importState(rd.result); location.reload(); }
                catch (e) { UI.toast(t('invalid_code')); }
              };
              rd.readAsText(f);
            });
          }
        }, t('backup_import'))));
    });
  }

  /* ---------- Dart-Welt ---------- */
  const WORLD = [
    { b: 'PDC', name: 'PDC News', sub: 'pdc.tv', url: 'https://www.pdc.tv/news' },
    { b: 'DN', name: 'dartn.de', sub: 'News & Community', url: 'https://www.dartn.de' },
    { b: 'LS', name: 'Live-Scores', sub: 'Flashscore Darts', url: 'https://www.flashscore.de/dart/' },
    { b: '2K', name: '2K Dart Software', sub: 'world_2k_sub', url: 'https://www.2k-dart-software.com/' }
  ];

  function worldScreen() {
    show(view => {
      view.appendChild(h('div', { class: 'shead' },
        h('button', { class: 'cbtn', onClick: () => back() }, '‹'),
        h('div', { class: 'ttl' }, t('more_world'))));
      view.appendChild(h('div', { class: 'sub', style: 'margin:8px 4px 14px' }, t('world_hint')));
      WORLD.forEach(w => {
        view.appendChild(h('div', { class: 'mrow', onClick: () => window.open(w.url, '_blank') },
          h('span', { class: 'badge' }, w.b),
          h('span', { class: 'mtxt' },
            h('span', { class: 'ttl' }, w.name),
            h('span', { class: 'dsc' }, w.sub === 'world_2k_sub' ? t('world_2k_sub') : w.sub)),
          h('span', { class: 'chev' }, '↗')));
      });
    });
  }

  /* ---------- Über / Installieren ---------- */
  function aboutScreen() {
    show(view => {
      view.appendChild(h('div', { class: 'shead' },
        h('button', { class: 'cbtn', onClick: () => back() }, '‹'),
        h('div', { class: 'ttl' }, t('more_about'))));
      view.appendChild(h('div', { class: 'hero center', style: 'margin-top:8px' },
        h('div', { class: 'logo', style: 'justify-content:center;font-size:24px;margin-bottom:6px' },
          h('span', { class: 'ring', style: 'width:34px;height:34px' }, h('i', { style: 'width:13px;height:13px' })), 'one80'),
        h('div', { class: 'sub' }, t('about_tagline') + ' · v2.0')));
      if (installEvt) {
        view.appendChild(h('button', {
          class: 'btn', style: 'margin-bottom:8px',
          onClick: async () => { installEvt.prompt(); installEvt = null; }
        }, t('install_btn')));
      }
      view.appendChild(h('div', { class: 'card' },
        h('div', { style: 'font-weight:600;margin-bottom:6px' }, t('install_title')),
        h('div', { class: 'sub' }, t('install_hint'))));
      view.appendChild(h('div', { class: 'card sub' }, t('about_text')));
    });
  }

  /* ---------- Mehr-Tab ---------- */
  function moreTab(view) {
    const s = Store.state.settings;
    view.appendChild(h('h1', null, t('nav_more')));

    view.appendChild(h('div', { class: 'mlabel', style: 'margin-top:6px' }, t('design_lbl')));
    view.appendChild(Games.segPick(
      ['dark', 'light'], [t('theme_dark'), t('theme_light')], s.theme,
      v => { s.theme = v; Store.save(); applyTheme(v); }));

    view.appendChild(h('div', { class: 'mlabel' }, t('language')));
    view.appendChild(Games.segPick(
      ['de', 'en'], ['Deutsch', 'English'], s.lang,
      v => { s.lang = v; Store.save(); document.documentElement.lang = v; updateNav(); rerender(); }));

    view.appendChild(h('div', { class: 'mlabel' }, t('settings')));
    const rows = [
      [t('more_players'), t('more_players_d'), profilesScreen],
      [t('more_input'), t('more_input_d'), inputSettingsScreen],
      [t('friends'), t('friends_d'), () => Friends.screen()],
      [t('more_world'), t('world_d'), worldScreen],
      ['Backup', t('backup_d'), backupScreen],
      [t('more_about'), t('about_d'), aboutScreen]
    ];
    rows.forEach(([ttl, dsc, go]) => {
      view.appendChild(h('div', { class: 'rrow', onClick: go },
        h('span', { class: 'rtxt' },
          h('span', { class: 'ttl' }, ttl),
          h('span', { class: 'dsc' }, dsc)),
        h('span', { class: 'chev' }, '›')));
    });

    view.appendChild(h('div', { class: 'foot' }, 'One80 · v2.0'));
  }

  /* ---------- Boot ---------- */
  function boot() {
    const s = Store.state.settings;
    applyTheme(s.theme);
    document.documentElement.lang = s.lang;
    document.querySelectorAll('#nav button').forEach(b => {
      b.addEventListener('click', () => root(b.dataset.tab));
    });
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('sw.js').catch(() => { });
    }
    root('play');
  }

  return { show, back, root, rerender, gameMode, editProfile, boot };
})();

App.boot();
