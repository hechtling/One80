/* One80 – QR: Encoder (Byte-Modus, Version 1–40) + SVG-Renderer + Kamera-Scanner.
   Komplett eigenständig, keine externen Dependencies, offline-tauglich. */
const QR = (() => {

  /* ---------- Tabellen (Index = Version 1–40, [0] ist Dummy) ---------- */

  /* Fehlerkorrektur-Codewörter pro Block */
  const ECC_CW = {
    L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    Q: [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    H: [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
  };

  /* Anzahl Fehlerkorrektur-Blöcke */
  const ECC_BLOCKS = {
    L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    Q: [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    H: [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
  };

  const EC_FORMAT = { L: 1, M: 0, Q: 3, H: 2 };

  /* ---------- Kapazität ---------- */

  /* Rohe Datenmodule einer Version (ohne Funktionsmuster und Formatinfo) */
  function rawDataModules(v) {
    let r = (16 * v + 128) * v + 64;
    if (v >= 2) {
      const n = Math.floor(v / 7) + 2;
      r -= (25 * n - 10) * n - 55;
      if (v >= 7) r -= 36;
    }
    return r;
  }

  function totalCodewords(v) { return Math.floor(rawDataModules(v) / 8); }

  function dataCodewords(v, ec) {
    return totalCodewords(v) - ECC_CW[ec][v] * ECC_BLOCKS[ec][v];
  }

  /* Bits des Zeichenzahl-Indikators im Byte-Modus */
  function countBits(v) { return v <= 9 ? 8 : 16; }

  /* ---------- Galois-Feld GF(256) für Reed-Solomon ---------- */

  const EXP = new Uint8Array(256), LOG = new Uint8Array(256);
  (() => {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x; LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11D;   // Generatorpolynom x^8 + x^4 + x^3 + x^2 + 1
    }
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[(LOG[a] + LOG[b]) % 255];
  }

  /* Generatorpolynom vom Grad `degree` */
  function rsDivisor(degree) {
    const res = new Uint8Array(degree);
    res[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < degree; j++) {
        res[j] = gfMul(res[j], root);
        if (j + 1 < degree) res[j] ^= res[j + 1];
      }
      root = gfMul(root, 2);
    }
    return res;
  }

  function rsRemainder(data, divisor) {
    const res = new Uint8Array(divisor.length);
    for (const b of data) {
      const factor = b ^ res[0];
      res.copyWithin(0, 1);
      res[res.length - 1] = 0;
      for (let i = 0; i < divisor.length; i++) res[i] ^= gfMul(divisor[i], factor);
    }
    return res;
  }

  /* ---------- Datenkodierung ---------- */

  function toBytes(text) {
    const out = [];
    for (const ch of text) {
      let cp = ch.codePointAt(0);
      if (cp < 0x80) out.push(cp);
      else if (cp < 0x800) out.push(0xC0 | (cp >> 6), 0x80 | (cp & 63));
      else if (cp < 0x10000) out.push(0xE0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      else out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    }
    return out;
  }

  function pickVersion(len, ec, minVersion) {
    for (let v = minVersion || 1; v <= 40; v++) {
      if (dataCodewords(v, ec) * 8 >= 4 + countBits(v) + len * 8) return v;
    }
    throw new Error('QR: Daten zu lang');
  }

  /* Bitstrom → Datencodewörter inkl. Terminator und Füllbytes */
  function buildData(bytes, v, ec) {
    const bits = [];
    const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };

    push(4, 4);                       // Modus: Byte
    push(bytes.length, countBits(v)); // Länge
    for (const b of bytes) push(b, 8);

    const cap = dataCodewords(v, ec) * 8;
    for (let i = 0; i < 4 && bits.length < cap; i++) bits.push(0);  // Terminator
    while (bits.length % 8 !== 0) bits.push(0);                     // auf Bytegrenze

    const cw = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      cw.push(b);
    }
    for (let pad = 0xEC; cw.length < dataCodewords(v, ec); pad ^= 0xEC ^ 0x11) cw.push(pad);
    return cw;
  }

  /* Blöcke bilden, Fehlerkorrektur anhängen, verschachteln */
  function interleave(data, v, ec) {
    const numBlocks = ECC_BLOCKS[ec][v];
    const eccLen = ECC_CW[ec][v];
    const total = totalCodewords(v);
    const shortLen = Math.floor(total / numBlocks) - eccLen;
    const numShort = numBlocks - (total % numBlocks);
    const divisor = rsDivisor(eccLen);

    const blocks = [];
    for (let i = 0, off = 0; i < numBlocks; i++) {
      const len = shortLen + (i < numShort ? 0 : 1);
      const dat = data.slice(off, off + len);
      off += len;
      blocks.push({ dat, ecc: rsRemainder(dat, divisor) });
    }

    const out = [];
    for (let i = 0; i < shortLen + 1; i++)
      for (const b of blocks) if (i < b.dat.length) out.push(b.dat[i]);
    for (let i = 0; i < eccLen; i++)
      for (const b of blocks) out.push(b.ecc[i]);
    return out;
  }

  /* ---------- Matrixaufbau ---------- */

  function alignPositions(v) {
    if (v === 1) return [];
    const n = Math.floor(v / 7) + 2;
    const step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
    const res = [6];
    /* Positionen entstehen absteigend, müssen aber aufsteigend hinter der 6 stehen */
    for (let pos = v * 4 + 10; res.length < n; pos -= step) res.splice(1, 0, pos);
    return res;
  }

  function buildMatrix(codewords, v, ec, forceMask) {
    const size = v * 4 + 17;
    const mod = [], fn = [];
    for (let y = 0; y < size; y++) { mod.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }

    const setFn = (x, y, val) => {
      if (x < 0 || y < 0 || x >= size || y >= size) return;
      mod[y][x] = val; fn[y][x] = true;
    };

    /* Timing-Muster */
    for (let i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }

    /* Suchmuster inkl. Trennlinie */
    const finder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        setFn(cx + dx, cy + dy, d !== 2 && d !== 4);
      }
    };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);

    /* Ausrichtungsmuster */
    const ap = alignPositions(v);
    for (let i = 0; i < ap.length; i++) for (let j = 0; j < ap.length; j++) {
      const corner = (i === 0 && j === 0) || (i === 0 && j === ap.length - 1) || (i === ap.length - 1 && j === 0);
      if (corner) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
        setFn(ap[i] + dx, ap[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }

    /* Formatinfo-Felder reservieren (Werte kommen später) */
    drawFormat(setFn, size, ec, 0);

    /* Versionsinfo ab Version 7 */
    if (v >= 7) {
      let rem = v;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      const bits = (v << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const bit = ((bits >>> i) & 1) === 1;
        const a = size - 11 + (i % 3), b = Math.floor(i / 3);
        setFn(a, b, bit); setFn(b, a, bit);
      }
    }

    /* Datenbits im Zickzack platzieren */
    let bitIdx = 0;
    const totalBits = codewords.length * 8;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;                       // Spalte 6 ist Timing-Muster
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (fn[y][x] || bitIdx >= totalBits) continue;
          mod[y][x] = ((codewords[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1) === 1;
          bitIdx++;
        }
      }
    }

    /* Maske wählen */
    let best = forceMask, bestPenalty = Infinity;
    if (forceMask === undefined || forceMask === null) {
      for (let m = 0; m < 8; m++) {
        applyMask(mod, fn, size, m);
        drawFormat((x, y, val) => { mod[y][x] = val; }, size, ec, m);
        const p = penalty(mod, size);
        if (p < bestPenalty) { bestPenalty = p; best = m; }
        applyMask(mod, fn, size, m);   // XOR ist selbstinvers → zurücksetzen
      }
    }
    applyMask(mod, fn, size, best);
    drawFormat((x, y, val) => { mod[y][x] = val; }, size, ec, best);

    return mod;
  }

  function drawFormat(set, size, ec, mask) {
    const data = (EC_FORMAT[ec] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = i => ((bits >>> i) & 1) === 1;

    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6));
    set(8, 8, bit(7));
    set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));

    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);   // immer dunkles Modul
  }

  const MASKS = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x, y) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
    (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0,
    (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0
  ];

  function applyMask(mod, fn, size, m) {
    const f = MASKS[m];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++)
      if (!fn[y][x] && f(x, y)) mod[y][x] = !mod[y][x];
  }

  /* ---------- Maskenbewertung (Regeln 1–4 nach ISO 18004) ---------- */

  function penalty(mod, size) {
    let p = 0;

    /* Regel 1: Läufe gleicher Farbe ab 5 Modulen */
    const runs = line => {
      let run = 1, sum = 0;
      for (let i = 1; i < size; i++) {
        if (line[i] === line[i - 1]) { run++; if (run === 5) sum += 3; else if (run > 5) sum++; }
        else run = 1;
      }
      return sum;
    };
    for (let y = 0; y < size; y++) p += runs(mod[y]);
    for (let x = 0; x < size; x++) p += runs(mod.map(r => r[x]));

    /* Regel 2: gleichfarbige 2×2-Blöcke */
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
      const c = mod[y][x];
      if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3;
    }

    /* Regel 3: Muster 1:1:3:1:1 mit vier hellen Modulen auf einer Seite.
       Module außerhalb des Symbols zählen als hell (Ruhezone). */
    const PAT = [true, false, true, true, true, false, true];
    const lightRun = (line, from, count) => {
      for (let k = 0; k < count; k++) {
        const i = from + k;
        if (i >= 0 && i < size && line[i]) return false;
      }
      return true;
    };
    /* Treffer werden nicht überlappend gezählt: nach einem gewerteten Muster geht es
       7 Module weiter, sonst 4 (Rest des Musters kann Anfang des nächsten sein). */
    const scan = line => {
      let sum = 0, i = 0;
      while (i + 7 <= size) {
        let hit = true;
        for (let k = 0; k < 7; k++) if (line[i + k] !== PAT[k]) { hit = false; break; }
        if (!hit) { i++; continue; }
        if (lightRun(line, i - 4, 4) || lightRun(line, i + 7, 4)) { sum += 40; i += 7; }
        else i += 4;
      }
      return sum;
    };
    for (let y = 0; y < size; y++) p += scan(mod[y]);
    for (let x = 0; x < size; x++) p += scan(mod.map(r => r[x]));

    /* Regel 4: Abweichung des Dunkelanteils von 50 % */
    let dark = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (mod[y][x]) dark++;
    const total = size * size;
    p += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;

    return p;
  }

  /* ---------- Öffentliche API ---------- */

  /* Text → 2D-Boolean-Matrix. opts: { ec:'L'|'M'|'Q'|'H', minVersion, mask } */
  function matrix(text, opts) {
    opts = opts || {};
    const ec = opts.ec || 'M';
    const bytes = toBytes(text);
    const v = pickVersion(bytes.length, ec, opts.minVersion);
    return buildMatrix(interleave(buildData(bytes, v, ec), v, ec), v, ec, opts.mask);
  }

  /* Text → SVG-String (Pfad statt Einzelrechtecke, damit es klein bleibt) */
  function svgString(text, opts) {
    opts = opts || {};
    const m = matrix(text, opts);
    const n = m.length;
    const q = opts.quiet == null ? 3 : opts.quiet;
    const total = n + q * 2;
    const dark = opts.dark || '#000';
    const light = opts.light || '#fff';
    let d = '';
    for (let y = 0; y < n; y++) {
      let x = 0;
      while (x < n) {
        if (!m[y][x]) { x++; continue; }
        let w = 1;
        while (x + w < n && m[y][x + w]) w++;
        d += 'M' + (x + q) + ' ' + (y + q) + 'h' + w + 'v1h-' + w + 'z';
        x += w;
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total + '" ' +
      'width="100%" height="100%" shape-rendering="crispEdges">' +
      '<rect width="' + total + '" height="' + total + '" fill="' + light + '"/>' +
      '<path d="' + d + '" fill="' + dark + '"/></svg>';
  }

  /* ---------- Kamera-Scanner ---------- */

  function scanSupported() {
    return typeof BarcodeDetector !== 'undefined' &&
      !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  /* Öffnet ein Vollbild-Overlay mit Kamerabild. onResult(text) wird einmal aufgerufen.
     Gibt ein Objekt mit close() zurück. */
  function scan(onResult, onError, labels) {
    labels = labels || {};
    const video = h('video', { playsinline: '', muted: '', autoplay: '' });
    video.muted = true;
    const frame = h('div', { class: 'qrframe' });
    const hint = h('div', { class: 'qrhint' }, labels.hint || '');
    const closeBtn = h('button', { class: 'cbtn qrclose' }, '✕');
    const box = h('div', { class: 'qrscan' }, video, frame, hint, closeBtn);

    let stream = null, stopped = false, raf = 0;

    const close = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach(t => t.stop());
      box.remove();
    };
    closeBtn.addEventListener('click', close);
    document.getElementById('modal-root').appendChild(box);

    if (!scanSupported()) { close(); onError && onError('unsupported'); return { close }; }

    const detector = new BarcodeDetector({ formats: ['qr_code'] });

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(s => {
        if (stopped) { s.getTracks().forEach(t => t.stop()); return; }
        stream = s;
        video.srcObject = s;
        return video.play();
      })
      .then(() => {
        const tick = () => {
          if (stopped) return;
          if (video.readyState >= 2) {
            detector.detect(video)
              .then(codes => {
                if (stopped || !codes || !codes.length) return;
                const val = codes[0].rawValue;
                if (!val) return;
                close();
                onResult(val);
              })
              .catch(() => { });
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      })
      .catch(err => { close(); onError && onError(err && err.name === 'NotAllowedError' ? 'denied' : 'camera'); });

    return { close };
  }

  return { matrix, svgString, scan, scanSupported, penalty };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = QR;   // nur für Tests
