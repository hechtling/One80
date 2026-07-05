/* One80 – Eingabe-Widget: Board / Tastenfeld / Rundensumme, live umschaltbar */
const Input = (() => {

  function create(host, opts) {
    const modes = opts.modes || ['board', 'keys', 'sum'];
    let mode = opts.mode && modes.includes(opts.mode) ? opts.mode : modes[0];
    let mod = 1; // 1 = Single, 2 = Double, 3 = Triple (Tastenfeld)
    let disabled = false;

    const wrap = h('div', { class: 'inpwrap' });
    const bar = h('div', { class: 'inpbar' });
    const area = h('div');
    wrap.appendChild(bar); wrap.appendChild(area);
    host.appendChild(wrap);

    const modeLabel = { board: '🎯 ' + t('inp_board'), keys: '🔢 ' + t('inp_keys'), sum: 'Σ ' + t('inp_sum') };

    function renderBar() {
      bar.innerHTML = '';
      if (modes.length > 1) {
        const seg = h('div', { class: 'seg' });
        modes.forEach(m => {
          seg.appendChild(h('button', {
            class: mode === m ? 'on' : '',
            onClick: () => { mode = m; Store.state.settings.input = m; Store.save(); render(); }
          }, modeLabel[m]));
        });
        bar.appendChild(seg);
      }
      bar.appendChild(h('button', { class: 'iconbtn', onClick: () => { if (!disabled && opts.onUndo) opts.onUndo(); } }, '↶ ' + t('undo')));
    }

    function emitDart(d) {
      if (disabled) return;
      UI.buzz(20); UI.sfx.hit();
      opts.onDart(d);
    }

    function renderBoard() {
      area.innerHTML = '';
      area.appendChild(UI.boardSVG({ onHit: d => emitDart(d) }));
    }

    function renderKeys() {
      area.innerHTML = '';
      const pad = h('div', { class: 'keypad' });
      const modBtns = {};
      const setMod = m => {
        mod = (mod === m) ? 1 : m;
        modBtns[2].classList.toggle('on', mod === 2);
        modBtns[3].classList.toggle('on', mod === 3);
      };
      modBtns[2] = h('button', { class: 'mod wide', onClick: () => setMod(2) }, 'DOUBLE');
      modBtns[3] = h('button', { class: 'mod wide', onClick: () => setMod(3) }, 'TRIPLE');
      pad.appendChild(modBtns[2]);
      pad.appendChild(modBtns[3]);
      pad.appendChild(h('button', { class: 'danger', onClick: () => { if (!disabled) emitDart(DartMath.MISS()); } }, '✗'));
      for (let n = 1; n <= 20; n++) {
        pad.appendChild(h('button', {
          onClick: () => {
            const key = (mod === 3 ? 'T' : mod === 2 ? 'D' : 'S') + n;
            emitDart(DartMath.fromKey(key)); setModReset();
          }
        }, String(n)));
      }
      pad.appendChild(h('button', {
        class: 'wide',
        onClick: () => { emitDart(DartMath.fromKey(mod === 2 ? 'DB' : 'SB')); setModReset(); }
      }, mod === 2 ? 'BULL 50' : '25 / BULL'));
      const setModReset = () => { mod = 1; modBtns[2].classList.remove('on'); modBtns[3].classList.remove('on'); renderBullLabel(); };
      const renderBullLabel = () => { pad.lastChild.textContent = mod === 2 ? 'BULL 50' : '25 / BULL'; };
      modBtns[2].addEventListener('click', renderBullLabel);
      modBtns[3].addEventListener('click', renderBullLabel);
      area.appendChild(pad);
    }

    function renderSum() {
      area.innerHTML = '';
      let val = '';
      const pad = h('div', { class: 'sumpad' });
      const disp = h('div', { class: 'disp' }, ' ');
      const upd = () => { disp.textContent = val || ' '; };
      const submit = total => {
        if (disabled) return;
        if (!DartMath.validVisitTotal(total)) { UI.toast(t('invalid_score')); return; }
        UI.buzz(20); UI.sfx.hit();
        val = ''; upd();
        opts.onSum(total);
      };
      pad.appendChild(disp);
      const digits = [7, 8, 9, 26, 4, 5, 6, 45, 1, 2, 3, 60, 'C', 0, '⌫', 100];
      digits.forEach(d => {
        if (d === 'C') pad.appendChild(h('button', { class: 'danger', onClick: () => { val = ''; upd(); } }, 'C'));
        else if (d === '⌫') pad.appendChild(h('button', { onClick: () => { val = val.slice(0, -1); upd(); } }, '⌫'));
        else if (d === 26 || d === 45 || d === 60 || d === 100) pad.appendChild(h('button', { class: 'qs', onClick: () => submit(d) }, '+' + d));
        else pad.appendChild(h('button', {
          onClick: () => { if (val.length < 3) { val += String(d); upd(); } }
        }, String(d)));
      });
      pad.appendChild(h('button', { class: 'danger', onClick: () => submit(0) }, t('no_score_btn')));
      pad.appendChild(h('button', { class: 'qs', onClick: () => submit(140) }, '+140'));
      pad.appendChild(h('button', { class: 'qs', onClick: () => submit(180) }, '+180'));
      pad.appendChild(h('button', { class: 'go', onClick: () => { if (val !== '') submit(parseInt(val, 10)); } }, 'OK'));
      area.appendChild(pad);
    }

    function render() {
      renderBar();
      if (mode === 'board') renderBoard();
      else if (mode === 'keys') renderKeys();
      else renderSum();
      wrap.style.opacity = disabled ? '0.45' : '1';
      wrap.style.pointerEvents = disabled ? 'none' : 'auto';
    }

    render();

    return {
      el: wrap,
      get mode() { return mode; },
      setDisabled(v) { disabled = v; wrap.style.opacity = v ? '0.45' : '1'; wrap.style.pointerEvents = v ? 'none' : 'auto'; },
      refresh: render
    };
  }

  return { create };
})();
