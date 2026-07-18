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

  /* ---------- Profile ---------- */
  const EMOJIS = ['🎯', '😎', '🦁', '🐍', '🔥', '⚡', '🍀', '👽', '🤠', '🐗', '🦅', '🍺', '💪', '🧨', '🐺', '👑'];

  function editProfile(p, cb) {
    const nameInp = h('input', { type: 'text', value: p ? p.name : '', placeholder: t('profile_name') });
    let emoji = p ? p.emoji : EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    const emRow = h('div', { style: 'margin-top:8px' });
    EMOJIS.forEach(e => {
      emRow.appendChild(h('span', {
        class: 'chip' + (e === emoji ? ' on' : ''),
        style: 'padding:6px 10px;font-size:20px',
        onClick: ev => { emoji = e; [...emRow.children].forEach(c => c.classList.remove('on')); ev.target.closest('.chip').classList.add('on'); }
      }, e));
    });
    UI.modal({
      title: p ? p.name : '＋ ' + t('new_profile'),
      body: h('div', null, h('label', { class: 'fld' }, t('profile_name'), nameInp), emRow),
      buttons: [
        { label: t('cancel'), cls: 'sec' },
        {
          label: t('ok'), onClick: () => {
            const name = nameInp.value.trim();
            if (!name) return;
            if (p) { p.name = name; p.emoji = emoji; Store.save(); if (cb) cb(p); }
            else { const np = Store.newProfile(name, emoji); if (cb) cb(np); }
            rerender();
          }
        }
      ]
    });
    setTimeout(() => nameInp.focus(), 60);
  }

  function profilesScreen() {
    show(view => {
      view.appendChild(h('div', { class: 'mhead' },
        h('button', { class: 'iconbtn', onClick: () => back() }, '‹'),
        h('div', { class: 'ttl' }, t('profiles'))));
      view.appendChild(h('button', {
        class: 'btn', style: 'margin-bottom:12px',
        onClick: () => editProfile(null, () => rerender())
      }, '＋ ' + t('new_profile')));
      if (!Store.state.profiles.length) {
        view.appendChild(h('div', { class: 'card center sub' }, t('no_profiles')));
        return;
      }
      Store.state.profiles.forEach(p => {
        view.appendChild(h('div', { class: 'card' },
          h('div', { class: 'row' },
            h('div', { class: 'avatar', style: 'background:var(--card2);font-size:22px' }, p.emoji),
            h('div', { class: 'grow' },
              h('div', { style: 'font-weight:700' }, p.name),
              h('div', { class: 'sub' },
                t('matches') + ': ' + p.agg.matches + ' · Ø ' + UI.f1(Store.avgOf(p.agg)) +
                ' · 🏅 ' + Object.keys(p.achievements).length)),
            h('button', { class: 'iconbtn', onClick: () => editProfile(p, () => rerender()) }, '✏️'),
            h('button', {
              class: 'iconbtn', onClick: () => UI.confirm(t('delete_profile_q', { n: p.name }), () => {
                Store.deleteProfile(p.id);
                rerender();
              })
            }, '🗑'))));
      });
    });
  }

  /* ---------- Einstellungen ---------- */
  function toggleLine(label, key) {
    const s = Store.state.settings;
    return h('div', { class: 'toggline' }, h('span', null, label),
      h('label', { class: 'switch' },
        h('input', { type: 'checkbox', ...(s[key] ? { checked: '' } : {}), onChange: e => { s[key] = e.target.checked; Store.save(); } }),
        h('span')));
  }

  function settingsScreen() {
    show(view => {
      const s = Store.state.settings;
      view.appendChild(h('div', { class: 'mhead' },
        h('button', { class: 'iconbtn', onClick: () => back() }, '‹'),
        h('div', { class: 'ttl' }, t('settings'))));
      const seg = (vals, labels, cur, onCh) => {
        const el = h('div', { class: 'seg' });
        vals.forEach((v, i) => el.appendChild(h('button', {
          class: v === cur ? 'on' : '',
          onClick: () => { onCh(v); [...el.children].forEach((c, j) => c.classList.toggle('on', vals[j] === v)); }
        }, labels[i])));
        return el;
      };
      view.appendChild(h('div', { class: 'card' },
        h('label', { class: 'fld' }, t('theme'),
          seg(['dark', 'light'], [t('theme_dark'), t('theme_light')], s.theme, v => {
            s.theme = v; Store.save();
            document.documentElement.setAttribute('data-theme', v);
          })),
        h('label', { class: 'fld' }, t('language'),
          seg(['de', 'en'], ['Deutsch', 'English'], s.lang, v => {
            s.lang = v; Store.save();
            document.documentElement.lang = v;
            updateNav(); rerender();
          })),
        h('label', { class: 'fld' }, t('default_input'),
          seg(['board', 'keys', 'sum'], [t('inp_board'), t('inp_keys'), t('inp_sum')], s.input, v => { s.input = v; Store.save(); }))));
      view.appendChild(h('div', { class: 'card' },
        toggleLine(t('caller_lbl'), 'caller'),
        toggleLine(t('sfx_lbl'), 'sfx'),
        toggleLine(t('vibrate_lbl'), 'vibrate')));
    });
  }

  /* ---------- Backup ---------- */
  function backupScreen() {
    show(view => {
      view.appendChild(h('div', { class: 'mhead' },
        h('button', { class: 'iconbtn', onClick: () => back() }, '‹'),
        h('div', { class: 'ttl' }, 'Backup')));
      view.appendChild(h('div', { class: 'card' },
        h('div', { class: 'sub', style: 'margin-bottom:10px' }, t('backup_hint')),
        h('button', {
          class: 'btn', onClick: () => {
            const blob = new Blob([Store.exportState()], { type: 'application/json' });
            const a = h('a', { href: URL.createObjectURL(blob), download: 'one80-backup-' + new Date().toISOString().slice(0, 10) + '.json' });
            document.body.appendChild(a); a.click(); a.remove();
            UI.toast('✓ ' + t('backup_done'));
          }
        }, '⬇ ' + t('backup_export'))));
      const file = h('input', { type: 'file', accept: '.json,application/json', style: 'margin-bottom:10px' });
      view.appendChild(h('div', { class: 'card' },
        h('div', { class: 'sub', style: 'margin-bottom:10px' }, t('import_hint')),
        file,
        h('button', {
          class: 'btn sec', onClick: () => {
            const f = file.files && file.files[0];
            if (!f) { UI.toast(t('pick_file')); return; }
            UI.confirm(t('import_confirm_q'), () => {
              const rd = new FileReader();
              rd.onload = () => {
                try { Store.importState(rd.result); location.reload(); }
                catch (e) { UI.toast('✗ ' + t('invalid_code')); }
              };
              rd.readAsText(f);
            });
          }
        }, '⬆ ' + t('backup_import'))));
    });
  }

  /* ---------- Dart-Welt ---------- */
  const WORLD = [
    { icon: '📰', name: 'PDC News', sub: 'pdc.tv', url: 'https://www.pdc.tv/news' },
    { icon: '🇩🇪', name: 'dartn.de', sub: 'News & Community', url: 'https://www.dartn.de' },
    { icon: '📊', name: 'Live-Scores', sub: 'Flashscore Darts', url: 'https://www.flashscore.de/dart/' },
    { icon: '🏟️', name: '2K Dart Software', sub: 'world_2k_sub', url: 'https://www.2k-dart-software.com/' }
  ];

  function worldScreen() {
    show(view => {
      view.appendChild(h('div', { class: 'mhead' },
        h('button', { class: 'iconbtn', onClick: () => back() }, '‹'),
        h('div', { class: 'ttl' }, t('more_world'))));
      view.appendChild(h('div', { class: 'sub', style: 'margin-bottom:12px' }, t('world_hint')));
      WORLD.forEach(w => {
        view.appendChild(h('div', { class: 'card tap', onClick: () => window.open(w.url, '_blank') },
          h('div', { class: 'row' },
            h('div', { style: 'font-size:28px' }, w.icon),
            h('div', { class: 'grow' },
              h('div', { style: 'font-weight:700' }, w.name),
              h('div', { class: 'sub' }, w.sub === 'world_2k_sub' ? t('world_2k_sub') : w.sub)),
            h('div', { class: 'arr' }, '↗'))));
      });
    });
  }

  /* ---------- Über / Installieren ---------- */
  function aboutScreen() {
    show(view => {
      view.appendChild(h('div', { class: 'mhead' },
        h('button', { class: 'iconbtn', onClick: () => back() }, '‹'),
        h('div', { class: 'ttl' }, t('more_about'))));
      view.appendChild(h('div', { class: 'hero center' },
        h('div', { class: 'gic hot', style: 'width:58px;height:58px;border-radius:18px;margin:0 auto 10px' }, UI.ic('target')),
        h('div', { class: 'big' }, 'One80', h('span', { class: 'dot', style: 'color:var(--accent)' }, '.')),
        h('div', { class: 'sub' }, t('about_tagline') + ' · v1.1')));
      if (installEvt) {
        view.appendChild(h('button', {
          class: 'btn', style: 'margin-bottom:12px',
          onClick: async () => { installEvt.prompt(); installEvt = null; }
        }, t('install_btn')));
      }
      view.appendChild(h('div', { class: 'card' },
        h('div', { style: 'font-weight:700;margin-bottom:6px' }, t('install_title')),
        h('div', { class: 'sub' }, t('install_hint'))));
      view.appendChild(h('div', { class: 'card sub' }, t('about_text')));
    });
  }

  /* ---------- Mehr-Tab ---------- */
  function moreTab(view) {
    view.appendChild(h('h1', null, t('nav_more'), h('span', { class: 'dot' }, '.')));
    const items = [
      ['user', t('profiles'), profilesScreen],
      ['users', t('friends'), () => Friends.screen()],
      ['world', t('more_world'), worldScreen],
      ['sliders', t('settings'), settingsScreen],
      ['save', 'Backup', backupScreen],
      ['info', t('more_about'), aboutScreen]
    ];
    const card = h('div', { class: 'card' });
    items.forEach(([ic, label, go]) => {
      card.appendChild(h('div', { class: 'listitem', onClick: go },
        h('div', { class: 'ic' }, UI.ic(ic)),
        h('div', { class: 'grow', style: 'font-weight:600' }, label),
        h('div', { class: 'arr' }, '›')));
    });
    view.appendChild(card);
  }

  /* ---------- Boot ---------- */
  function boot() {
    const s = Store.state.settings;
    document.documentElement.setAttribute('data-theme', s.theme);
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
