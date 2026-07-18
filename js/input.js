/* One80 – Eingabe-Widget: Board / Tastenfeld / Rundensumme, live umschaltbar */
const Input = (() => {

  function create(host, opts) {
    const modes = opts.modes || ['board', 'keys', 'sum'];
    let mode = opts.mode && modes.includes(opts.mode) ? opts.mode : modes[0];
    let mod = 1; // 1 = Single, 2 = Double, 3 = Triple (Tastenfeld)
    let disabled = false;

    const wrap = h('div', { class: 'kwrap' });
    const bar = h('div', { class: 'inpbar' });
    const area = h('div', { style: 'display:flex;flex-direction:column;gap:10px' });
    wrap.appendChild(bar); wrap.appendChild(area);
    host.appendChild(wrap);

    const modeLabel = { board: t('inp_board'), keys: t('inp_keys'), sum: t('inp_sum') };

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
    }

    function emitDart(d) {
      if (disabled) return;
      UI.buzz(20); UI.sfx.hit();
      opts.onDart(d);
    }
    function undo() { if (!disabled && opts.onUndo) opts.onUndo(); }

    function renderBoard() {
      area.appendChild(UI.boardSVG({ onHit: d => emitDart(d) }));
      area.appendChild(h('div', { class: 'boardbtns' },
        h('button', { class: 'btn sec', onClick: () => emitDart(DartMath.MISS()) }, t('miss')),
        h('button', { class: 'btn sec', onClick: undo }, '⌫ ' + t('undo'))
      ));
    }

    /* Tastenfeld im Club-Stil: Modifier-Segmente + Kreis-Tasten */
    function renderKeys() {
      const seg = h('div', { class: 'seg' });
      const segBtns = [];
      const setMod = m => {
        mod = m;
        segBtns.forEach((b, i) => b.classList.toggle('on', i + 1 === mod));
      };
      ['Single', 'Double', 'Triple'].forEach((lbl, i) => {
        const b = h('button', { class: i === 0 ? 'on' : '', onClick: () => setMod(i + 1) }, lbl);
        segBtns.push(b); seg.appendChild(b);
      });
      area.appendChild(seg);

      const grid = h('div', { class: 'kgrid' });
      for (let n = 1; n <= 20; n++) {
        grid.appendChild(h('button', {
          class: 'key',
          onClick: () => {
            const key = (mod === 3 ? 'T' : mod === 2 ? 'D' : 'S') + n;
            emitDart(DartMath.fromKey(key));
            setMod(1);
          }
        }, String(n)));
      }
      area.appendChild(grid);

      area.appendChild(h('div', { class: 'krow' },
        h('button', {
          class: 'key', style: 'font-size:15px',
          onClick: () => {
            if (mod === 3) { UI.toast(t('no_t25')); return; }
            emitDart(DartMath.fromKey(mod === 2 ? 'DB' : 'SB'));
            setMod(1);
          }
        }, '25'),
        h('button', { class: 'key bull', onClick: () => { emitDart(DartMath.fromKey('DB')); setMod(1); } }, 'Bull'),
        h('button', { class: 'key ghost', onClick: () => { emitDart(DartMath.MISS()); setMod(1); } }, 'Miss'),
        h('button', { class: 'key ghost', style: 'font-size:16px', onClick: undo }, '⌫')
      ));
    }

    function renderSum() {
      let val = '';
      const pad = h('div', { class: 'sumpad' });
      const disp = h('div', { class: 'disp' }, ' ');
      const upd = () => { disp.textContent = val || ' '; };
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
      area.innerHTML = '';
      mod = 1;
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
