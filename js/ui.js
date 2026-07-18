/* One80 – UI-Helfer, Dartboard-SVG, Charts, Sounds, Checkout-Rechner */

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v === null || v === undefined) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(9)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.appendChild(typeof kid === 'object' ? kid : document.createTextNode(kid));
  }
  return el;
}

const UI = (() => {

  function toast(msg, cls) {
    const el = h('div', { class: 'toast' + (cls ? ' ' + cls : '') }, msg);
    document.getElementById('toasts').appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 1800);
    setTimeout(() => el.remove(), 2200);
  }

  function modal(opts) {
    const root = document.getElementById('modal-root');
    const box = h('div', { class: 'modal' });
    if (opts.title) box.appendChild(h('h3', null, opts.title));
    if (opts.body) box.appendChild(opts.body);
    const back = h('div', { class: 'modal-back' }, box);
    const api = { close: () => back.remove(), box };
    if (opts.buttons && opts.buttons.length) {
      box.appendChild(h('div', { class: 'mbtns' },
        opts.buttons.map(b => h('button', {
          class: 'btn' + (b.cls ? ' ' + b.cls : ''),
          onClick: () => { if (b.onClick) b.onClick(api); if (!b.keep) api.close(); }
        }, b.label))
      ));
    }
    if (opts.dismiss !== false) back.addEventListener('pointerdown', e => { if (e.target === back) api.close(); });
    root.appendChild(back);
    return api;
  }

  function confirm(msg, onYes) {
    modal({
      title: msg,
      buttons: [
        { label: t('cancel'), cls: 'sec' },
        { label: t('ok'), onClick: () => onYes() }
      ]
    });
  }

  /* ---------- Stroke-Icons (24er ViewBox, geometrisch, keine Emojis) ---------- */
  const ICONS = {
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
    crosshair: '<circle cx="12" cy="12" r="7"/><path d="M12 2v3"/><path d="M12 19v3"/><path d="M2 12h3"/><path d="M19 12h3"/>',
    bars: '<path d="M5 20v-8"/><path d="M12 20V5"/><path d="M19 20v-5"/>',
    bracket: '<path d="M4 6h5v4"/><path d="M4 18h5v-4"/><path d="M9 12h6"/><path d="M15 12h5"/>',
    dots: '<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
    sliders: '<path d="M4 8h16"/><path d="M4 16h16"/><circle cx="9" cy="8" r="2.4" fill="var(--bg)"/><circle cx="15" cy="16" r="2.4" fill="var(--bg)"/>'
  };

  function ic(name) {
    const el = document.createElement('div');
    el.innerHTML = '<svg class="sic" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || ICONS.target) + '</svg>';
    return el.firstChild;
  }

  /* ---------- Initialen-Avatare ---------- */
  function initials(name) {
    return String(name || '?').trim().slice(0, 2).toUpperCase();
  }
  function avatar(name, size) {
    return h('span', { class: 'avc' + (size ? ' s' + size : '') }, initials(name));
  }

  /* ---------- Dart-Anzeige-Label (S20 → „20", DB → „Bull") ---------- */
  function dartLabel(key) {
    if (!key || key === 'MISS') return '0';
    if (key === 'SB') return '25';
    if (key === 'DB') return 'Bull';
    if (key[0] === 'S') return key.slice(1);
    return key;
  }

  /* ---------- Dartboard SVG ---------- */
  const ORDER = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
  const RAD = { db: 3.73, sb: 9.35, tin: 58.2, tout: 62.9, din: 95.3, dout: 100 };

  function pt(r, deg) {
    const a = (deg - 90) * Math.PI / 180;
    return [r * Math.cos(a), r * Math.sin(a)];
  }
  function sector(r0, r1, a0, a1) {
    const [x0, y0] = pt(r1, a0), [x1, y1] = pt(r1, a1);
    const [x2, y2] = pt(r0, a1), [x3, y3] = pt(r0, a0);
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r1} ${r1} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} ` +
           `L ${x2.toFixed(2)} ${y2.toFixed(2)} A ${r0} ${r0} 0 0 0 ${x3.toFixed(2)} ${y3.toFixed(2)} Z`;
  }

  function boardSVG(opts = {}) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '-118 -118 236 236');
    const mk = (d, fill, key) => {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d); p.setAttribute('fill', fill);
      p.setAttribute('stroke', '#0b0d0f'); p.setAttribute('stroke-width', '0.55');
      if (key) { p.setAttribute('data-key', key); p.classList.add('bseg'); }
      svg.appendChild(p); return p;
    };
    const bg = document.createElementNS(NS, 'circle');
    bg.setAttribute('r', '117'); bg.setAttribute('fill', '#121a15');
    svg.appendChild(bg);
    const segEls = {};
    ORDER.forEach((n, i) => {
      const a0 = i * 18 - 9, a1 = i * 18 + 9;
      const dark = i % 2 === 0;
      const sing = dark ? '#24302a' : '#e9e2cf';
      const ring = dark ? '#c9463c' : '#3f9464';
      segEls['S' + n + 'a'] = mk(sector(RAD.sb, RAD.tin, a0, a1), sing, 'S' + n);
      segEls['T' + n] = mk(sector(RAD.tin, RAD.tout, a0, a1), ring, 'T' + n);
      segEls['S' + n + 'b'] = mk(sector(RAD.tout, RAD.din, a0, a1), sing, 'S' + n);
      segEls['D' + n] = mk(sector(RAD.din, RAD.dout, a0, a1), ring, 'D' + n);
      const [tx, ty] = pt(108.5, i * 18);
      const txt = document.createElementNS(NS, 'text');
      txt.setAttribute('x', tx.toFixed(1)); txt.setAttribute('y', ty.toFixed(1));
      txt.setAttribute('fill', '#cbd3cc'); txt.setAttribute('font-size', '12');
      txt.setAttribute('font-weight', '600'); txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('dominant-baseline', 'central');
      txt.textContent = n;
      svg.appendChild(txt);
    });
    const sb = document.createElementNS(NS, 'circle');
    sb.setAttribute('r', RAD.sb); sb.setAttribute('fill', '#3f9464');
    sb.setAttribute('stroke', '#0b0d0f'); sb.setAttribute('stroke-width', '0.55');
    sb.setAttribute('data-key', 'SB'); sb.classList.add('bseg');
    svg.appendChild(sb); segEls['SB'] = sb;
    const db = document.createElementNS(NS, 'circle');
    db.setAttribute('r', RAD.db); db.setAttribute('fill', '#c9463c');
    db.setAttribute('stroke', '#0b0d0f'); db.setAttribute('stroke-width', '0.55');
    db.setAttribute('data-key', 'DB'); db.classList.add('bseg');
    svg.appendChild(db); segEls['DB'] = db;

    const wrap = h('div', { class: 'boardwrap' });
    wrap.appendChild(svg);

    if (opts.onHit) {
      svg.addEventListener('pointerdown', e => {
        const t2 = e.target.closest ? e.target.closest('[data-key]') : null;
        const key = t2 ? t2.getAttribute('data-key') : (e.target.getAttribute && e.target.getAttribute('data-key'));
        if (!key) return;
        opts.onHit(DartMath.fromKey(key));
      });
    }

    if (opts.heat) {
      const max = Math.max(1, ...Object.values(opts.heat));
      for (const key in opts.heat) {
        const alpha = 0.15 + 0.75 * (opts.heat[key] / max);
        const paint = el => { if (el) { el.setAttribute('fill', mixHeat(alpha)); } };
        if (key.startsWith('S') && key !== 'SB') { paint(segEls[key + 'a']); paint(segEls[key + 'b']); }
        else paint(segEls[key]);
      }
    }
    return wrap;
  }
  function mixHeat(a) {
    // von dunkel nach warmgrün
    const c1 = [36, 48, 42], c2 = [126, 200, 150];
    const c = c1.map((v, i) => Math.round(v + (c2[i] - v) * a));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }

  /* ---------- Balken-Chart (Formkurve) ---------- */
  function barsChart(values, opts = {}) {
    const wrap = h('div', { class: 'fbars' });
    if (!values.length) {
      wrap.appendChild(h('span', { style: 'height:6px' }));
      return wrap;
    }
    const min = Math.min(...values), max = Math.max(...values);
    values.forEach((v, i) => {
      const p = max - min < 0.001 ? 0.7 : (v - min) / (max - min);
      const px = Math.round(22 + p * 50);
      wrap.appendChild(h('span', {
        class: i === values.length - 1 && opts.hiLast !== false ? 'hi' : '',
        style: 'height:' + px + 'px'
      }));
    });
    return wrap;
  }

  /* ---------- Mini-Liniendiagramm ---------- */
  function lineChart(seriesList, opts = {}) {
    const w = opts.w || 340, hh = opts.h || 130, pad = 26;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${hh}`);
    svg.classList.add('chart');
    const all = seriesList.flatMap(s => s.values).filter(v => isFinite(v));
    if (!all.length) {
      const txt = document.createElementNS(NS, 'text');
      txt.setAttribute('x', w / 2); txt.setAttribute('y', hh / 2);
      txt.setAttribute('fill', 'var(--mut2)'); txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('font-size', '12');
      txt.textContent = t('no_data');
      svg.appendChild(txt);
      return svg;
    }
    let ymin = opts.ymin !== undefined ? opts.ymin : Math.min(...all);
    let ymax = opts.ymax !== undefined ? opts.ymax : Math.max(...all);
    if (ymax - ymin < 4) { ymax += 2; ymin = Math.max(0, ymin - 2); }
    const colors = opts.colors || ['var(--grn)', 'var(--red)', 'var(--gold)'];
    for (let i = 0; i <= 2; i++) {
      const y = pad / 2 + (hh - pad) * i / 2;
      const val = ymax - (ymax - ymin) * i / 2;
      const ln = document.createElementNS(NS, 'line');
      ln.setAttribute('x1', pad); ln.setAttribute('x2', w - 4);
      ln.setAttribute('y1', y); ln.setAttribute('y2', y);
      ln.setAttribute('stroke', 'var(--ln)'); ln.setAttribute('stroke-width', '0.6');
      svg.appendChild(ln);
      const txt = document.createElementNS(NS, 'text');
      txt.setAttribute('x', pad - 4); txt.setAttribute('y', y + 3.5);
      txt.setAttribute('fill', 'var(--mut2)'); txt.setAttribute('font-size', '9');
      txt.setAttribute('text-anchor', 'end');
      txt.textContent = Math.round(val * 10) / 10;
      svg.appendChild(txt);
    }
    seriesList.forEach((s, si) => {
      const vs = s.values;
      if (!vs.length) return;
      const step = vs.length > 1 ? (w - pad - 8) / (vs.length - 1) : 0;
      const pts = vs.map((v, i) => {
        const x = pad + i * step;
        const y = pad / 2 + (hh - pad) * (1 - (v - ymin) / (ymax - ymin || 1));
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });
      const pl = document.createElementNS(NS, 'polyline');
      pl.setAttribute('points', pts.join(' '));
      pl.setAttribute('fill', 'none');
      pl.setAttribute('stroke', colors[si % colors.length]);
      pl.setAttribute('stroke-width', '2');
      pl.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(pl);
      if (vs.length === 1) {
        const c = document.createElementNS(NS, 'circle');
        const [x, y] = pts[0].split(',');
        c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', '3');
        c.setAttribute('fill', colors[si % colors.length]);
        svg.appendChild(c);
      }
    });
    return svg;
  }

  /* ---------- Sound & Caller ---------- */
  let actx = null;
  function beep(freq, dur, type, vol, when) {
    if (!Store.state.settings.sfx) return;
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'triangle'; o.frequency.value = freq;
      g.gain.value = vol || 0.12;
      o.connect(g); g.connect(actx.destination);
      const t0 = actx.currentTime + (when || 0);
      o.start(t0); g.gain.setValueAtTime(vol || 0.12, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.stop(t0 + dur + 0.02);
    } catch (e) {}
  }
  const sfx = {
    hit: () => beep(620, 0.06),
    bust: () => { beep(300, 0.15); beep(200, 0.2, 'sawtooth', 0.1, 0.12); },
    win: () => { beep(523, 0.12); beep(659, 0.12, 'triangle', 0.12, 0.13); beep(784, 0.22, 'triangle', 0.12, 0.26); },
    ach: () => { beep(880, 0.1); beep(1175, 0.25, 'triangle', 0.1, 0.11); }
  };

  function say(text) {
    if (!Store.state.settings.caller || !window.speechSynthesis) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-GB'; u.rate = 0.95;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  function callScore(total) {
    if (total === 180) {
      say('One hundred and eighty!');
      const el = h('div', { class: 'big180' }, h('span', null, '180'));
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1400);
    } else if (total === 0) say('No score');
    else say(String(total));
  }

  function buzz(ms) {
    if (Store.state.settings.vibrate && navigator.vibrate) { try { navigator.vibrate(ms || 25); } catch (e) {} }
  }

  /* ---------- WakeLock ---------- */
  let lock = null;
  async function wakeLock(on) {
    try {
      if (on && navigator.wakeLock) {
        lock = await navigator.wakeLock.request('screen');
      } else if (!on && lock) { await lock.release(); lock = null; }
    } catch (e) {}
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && lock) wakeLock(true);
  });

  /* ---------- Format-Helfer ---------- */
  function f1(x) {
    const s = (Math.round(x * 10) / 10).toFixed(1);
    return (typeof Store !== 'undefined' && Store.state.settings.lang === 'de') ? s.replace('.', ',') : s;
  }
  const dstr = ts => new Date(ts).toLocaleDateString(Store.state.settings.lang === 'de' ? 'de-DE' : 'en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });

  return { toast, modal, confirm, boardSVG, barsChart, lineChart, sfx, say, callScore, buzz, wakeLock, f1, dstr, ic, initials, avatar, dartLabel };
})();

/* ---------- Dart-Mathematik ---------- */
const DartMath = (() => {
  function fromKey(key) {
    if (key === 'MISS') return MISS();
    if (key === 'SB') return { v: 25, m: 1, score: 25, ring: 'SB', key: 'SB' };
    if (key === 'DB') return { v: 25, m: 2, score: 50, ring: 'DB', key: 'DB' };
    const m = key[0] === 'T' ? 3 : key[0] === 'D' ? 2 : 1;
    const v = parseInt(key.slice(1), 10);
    return { v, m, score: v * m, ring: key[0], key };
  }
  const MISS = () => ({ v: 0, m: 0, score: 0, ring: 'MISS', key: 'MISS' });

  const ALL = (() => {
    const a = [];
    for (let n = 1; n <= 20; n++) {
      a.push({ k: 'S' + n, v: n }, { k: 'D' + n, v: 2 * n }, { k: 'T' + n, v: 3 * n });
    }
    a.push({ k: 'SB', v: 25 }, { k: 'DB', v: 50 });
    return a;
  })();

  // Setup-Darts in Präferenz-Reihenfolge für Checkout-Wege
  const SETUP = (() => {
    const pref = [];
    for (let n = 20; n >= 13; n--) pref.push('T' + n);
    pref.push('SB');
    for (let n = 20; n >= 1; n--) pref.push('S' + n);
    for (let n = 12; n >= 1; n--) pref.push('T' + n);
    for (let n = 20; n >= 1; n--) pref.push('D' + n);
    return pref.map(k => ({ k, v: fromKey(k).score }));
  })();

  function finKey(s, out) {
    if (out === 'straight') { const d = ALL.find(x => x.v === s); return d ? d.k : null; }
    if (s === 50) return 'DB';
    if (s % 2 === 0 && s >= 2 && s <= 40) return 'D' + (s / 2);
    if (out === 'master' && s % 3 === 0 && s >= 3 && s <= 60) return 'T' + (s / 3);
    return null;
  }

  function checkout(score, darts, out) {
    out = out || 'double';
    if (score < 1) return null;
    if (out !== 'straight' && score > 170) return null;
    function solve(s, n) {
      const f = finKey(s, out);
      if (f) return [f];
      if (n <= 1) return null;
      for (const c of SETUP) {
        if (c.v < s) {
          const rest = solve(s - c.v, n - 1);
          if (rest) return [c.k, ...rest];
        }
      }
      return null;
    }
    return solve(score, darts);
  }

  const IMPOSSIBLE3 = [163, 166, 169, 172, 173, 175, 176, 178, 179];
  function validVisitTotal(total) {
    return total >= 0 && total <= 180 && !IMPOSSIBLE3.includes(total);
  }

  // Kann mit EINEM Dart gecheckt werden? (für Checkout-Versuch-Zählung)
  function oneDartFinish(s, out) { return finKey(s, out) !== null; }

  return { fromKey, MISS, checkout, validVisitTotal, oneDartFinish, finKey };
})();
