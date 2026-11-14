/* Xoriguer Compactador — interfície. El treball pesat el fa motor.js (Web Worker amb 7-Zip en WebAssembly).
 * Textos: en català aquí; les traduccions són a traduccions.js (la clau és el text català exacte). */
'use strict';
(function () {
  const VERSIO = '1.0.0';
  const $ = (s) => document.querySelector(s);
  const T_ = (s, v) => I18N.t(s, v);
  const natiu = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const FSN = natiu ? window.Capacitor.registerPlugin('Filesystem') : null;
  const SHN = natiu ? window.Capacitor.registerPlugin('Share') : null;
  const mobil = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // ---------- Ajustos ----------
  const ls = {
    get(k, d) { try { const v = localStorage.getItem('xc.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('xc.' + k, JSON.stringify(v)); } catch { /* sense lloc */ } },
  };
  const aj = Object.assign({ idioma: '', format: 'zip', nivell: 5, carpeta: true, planes: false, recents: true }, ls.get('ajustos', {}));
  const desaAj = () => ls.set('ajustos', aj);
  I18N.posa(aj.idioma);
  document.documentElement.lang = I18N.llengua;

  // ---------- Utilitats ----------
  const nf = () => new Intl.NumberFormat(I18N.llengua, { maximumFractionDigits: 1 });
  function mida(b) {
    if (b == null || isNaN(b)) return '';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0; let x = b;
    while (x >= 1024 && i < u.length - 1) { x /= 1024; i++; }
    return nf().format(i === 0 ? x : x < 10 ? Math.round(x * 10) / 10 : Math.round(x)) + ' ' + u[i];
  }
  const dataTxt = (t) => (t ? new Intl.DateTimeFormat(I18N.llengua, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(t)) : '');
  const ext = (n) => { const m = /\.([^./]+)$/.exec(n || ''); return m ? m[1].toLowerCase() : ''; };
  const base = (n) => n.split('/').pop();
  const senseExt = (n) => n.replace(/(\.tar)?\.[^.]+$/i, '').replace(/\.part0*1$/i, '') || n;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const el = (tag, props = {}, ...fills) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    }
    for (const f of fills) if (f != null) e.append(f);
    return e;
  };

  const EXT_ARXIU = new Set(['zip', 'zipx', '7z', 'rar', 'tar', 'gz', 'tgz', 'bz2', 'tbz', 'tbz2', 'xz', 'txz', 'zst', 'tzst', 'lzma', 'z', 'taz', 'cab', 'iso', 'img', 'dmg', 'wim', 'esd', 'swm', 'lzh', 'lha', 'arj', 'cpio', 'rpm', 'deb', 'ar', 'a', 'xar', 'pkg', 'apk', 'jar', 'war', 'xpi', 'msi', 'chm', 'vhd', 'vhdx', 'vmdk', 'vdi', 'qcow2', 'squashfs', 'udf', 'hfs', 'nsis', 'epub', 'cbz', 'cbr', 'cb7', 'r00', '001', 'lz4', 'lz', 'appx', 'msix', 'ipa', 'docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp']);
  const COLORS = [
    [['zip', 'zipx', 'jar', 'apk', 'cbz', 'xpi', 'war', 'ipa', 'appx', 'msix'], '#C41E3A'],
    [['rar', 'cbr', 'r00'], '#1C76BE'],
    [['7z', 'cb7', '001'], '#2E923E'],
    [['tar', 'gz', 'tgz', 'bz2', 'tbz', 'tbz2', 'xz', 'txz', 'zst', 'tzst', 'lzma', 'z', 'taz', 'lz', 'lz4', 'cpio', 'rpm', 'deb', 'ar', 'xar', 'pkg'], '#8E5BD6'],
    [['iso', 'img', 'dmg', 'wim', 'esd', 'vhd', 'vhdx', 'vmdk', 'vdi', 'qcow2', 'squashfs', 'udf', 'hfs', 'cab', 'msi'], '#2A8C82'],
    [['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif', 'heic', 'tif', 'tiff', 'ico'], '#D9539A'],
    [['mp4', 'mkv', 'avi', 'mov', 'webm', 'wmv', 'm4v', '3gp'], '#E5484D'],
    [['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'opus', 'wma'], '#9B6BF2'],
    [['pdf'], '#D23B2F'],
    [['doc', 'docx', 'odt', 'rtf'], '#3B82F6'],
    [['xls', 'xlsx', 'ods', 'csv'], '#22A06B'],
    [['ppt', 'pptx', 'odp'], '#F2650F'],
    [['txt', 'md', 'log', 'ini', 'cfg', 'nfo'], '#6B7A90'],
    [['js', 'ts', 'py', 'html', 'htm', 'css', 'json', 'xml', 'java', 'c', 'cpp', 'h', 'cs', 'php', 'sh', 'bat', 'yml', 'yaml', 'sql', 'kt', 'go', 'rs'], '#C98A16'],
    [['exe', 'dll', 'bin', 'sys'], '#64748B'],
  ];
  const colorExt = (e) => { for (const [ll, c] of COLORS) if (ll.includes(e)) return c; return '#4B5B75'; };
  const SVG_CARPETA = '<svg viewBox="0 0 24 24"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8z"/></svg>';
  function icona(nom, dir) {
    if (dir) return el('span', { class: 'ico carpeta', html: SVG_CARPETA });
    const e = ext(nom);
    const s = el('span', { class: 'ico' }, (e || '·').slice(0, 4).toUpperCase());
    s.style.background = colorExt(e);
    return s;
  }

  // ---------- Avisos i diàlegs ----------
  let tAvis = 0;
  function avis(txt) {
    const a = $('#avis'); a.textContent = txt; a.hidden = false;
    clearTimeout(tAvis); tAvis = setTimeout(() => { a.hidden = true; }, 3500);
  }
  const dlg = $('#dlg');
  let enTancarDlg = null;
  function obreDlg(titol, ...cos) {
    $('#dlg-titol').textContent = titol;
    const c = $('#dlg-cos'); c.replaceChildren(...cos);
    if (!dlg.open) dlg.showModal();
    return c;
  }
  function tancaDlg() { if (dlg.open) dlg.close(); }
  dlg.addEventListener('close', () => { const f = enTancarDlg; enTancarDlg = null; if (f) f(); });
  $('#dlg-tanca').onclick = tancaDlg;
  function opcio(ic, titol, sub, fn) {
    return el('button', { type: 'button', onclick: fn }, el('span', { class: 'ic' }, ic), el('span', {}, el('b', {}, titol), sub ? el('small', {}, sub) : null));
  }

  const MISSATGES = {
    pw: () => T_('Contrasenya incorrecta o necessària.'),
    noarxiu: () => T_('No és un arxiu comprimit o el format no és compatible.'),
    trencat: () => T_("L'arxiu està incomplet o hi falta alguna part. Si és un arxiu en diverses parts, tria-les totes alhora."),
    dades: () => T_("L'arxiu està malmès (error de dades)."),
    memoria: () => T_("No hi ha prou memòria per a aquest arxiu. Prova-ho a l'ordinador o amb un arxiu més petit."),
    unsol: () => T_('Aquest format només admet un sol fitxer. Per a diversos, fes servir TAR.GZ, TAR.BZ2 o TAR.XZ.'),
    buit: () => T_("L'arxiu és buit."),
    worker: () => T_("El motor s'ha aturat (probablement per falta de memòria)."),
    altre: () => T_('Alguna cosa no ha anat bé.'),
  };
  function mostraError(e, titol) {
    if (e && e.codi === 'cancel') return;
    console.error(e);
    const txt = (MISSATGES[e && e.codi] || MISSATGES.altre)();
    obreDlg(titol || T_('Error'), el('p', {}, txt), e && e.detall ? el('details', {}, el('summary', { class: 'petit' }, T_('Detalls')), el('pre', { class: 'err', 'data-no-t': true }, e.detall)) : null);
  }

  // ---------- Progrés ----------
  const dPr = $('#dlg-progres');
  let cancelPr = null;
  function progres(titol, onCancel) {
    $('#pr-titol').textContent = titol;
    $('#pr-text').textContent = '';
    const b = $('#pr-barra'); b.style.width = ''; b.parentElement.classList.add('indef');
    cancelPr = onCancel || null;
    $('#pr-cancel').hidden = !onCancel;
    if (!dPr.open) dPr.showModal();
  }
  function avancaPr(fets, total, nom) {
    if (total > 0) {
      const b = $('#pr-barra'); b.parentElement.classList.remove('indef');
      b.style.width = Math.min(100, (100 * fets) / total) + '%';
    }
    if (nom != null) $('#pr-text').textContent = nom;
  }
  function amagaPr() { cancelPr = null; if (dPr.open) dPr.close(); }
  $('#pr-cancel').onclick = () => { const f = cancelPr; amagaPr(); if (f) f(); };
  dPr.addEventListener('cancel', (e) => e.preventDefault());
  const FASES = { envia: 'Preparant els fitxers…', extreu: 'Extraient…', comprimeix: 'Comprimint…' };
  const onProgres = (m) => {
    if (m.fase) { $('#pr-titol').textContent = T_(FASES[m.fase]); return; }
    avancaPr(m.fets, m.total, m.nom);
  };

  // ---------- Motor (worker) ----------
  class Motor {
    constructor() {
      this.w = new Worker('motor.js', { type: 'module' });
      this.n = 0; this.pend = new Map(); this.rebuts = new Map();
      this.w.onmessage = (e) => {
        const m = e.data;
        const p = this.pend.get(m.id);
        if (!p) return;
        if (m.tipus === 'fet') { this.pend.delete(m.id); p.ok({ res: m.res, fitxers: p.fitxers }); }
        else if (m.tipus === 'error') { this.pend.delete(m.id); p.ko(Object.assign(new Error(m.codi), { codi: m.codi, detall: m.detall })); }
        else if (m.tipus === 'fitxer') p.fitxers.push({ cami: m.cami, blob: new Blob([m.dades]), data: m.data });
        else if (m.tipus === 'carpeta') p.carpetes.push(m.cami);
        else if (m.tipus === 'progres' && p.on) p.on(m);
      };
      this.w.onerror = (e) => { this.falla(Object.assign(new Error('worker'), { codi: 'worker', detall: e.message || '' })); };
    }
    fes(op, dades, on) {
      const id = ++this.n;
      return new Promise((ok, ko) => { this.pend.set(id, { ok, ko, on, fitxers: [], carpetes: [] }); this.w.postMessage({ id, op, ...dades }); });
    }
    falla(err) { for (const p of this.pend.values()) p.ko(err); this.pend.clear(); }
    tanca() { this.w.terminate(); this.falla(Object.assign(new Error('cancel'), { codi: 'cancel' })); }
  }

  // ---------- Pestanyes ----------
  function vista(v) {
    document.querySelectorAll('.vista').forEach((s) => s.classList.toggle('activa', s.id === 'v-' + v));
    document.querySelectorAll('.pestanyes button').forEach((b) => b.classList.toggle('activa', b.dataset.v === v));
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('.pestanyes button').forEach((b) => { b.onclick = () => vista(b.dataset.v); });

  // ================================================================
  //  OBRIR
  // ================================================================
  const est = { motor: null, nom: '', fitxers: [], info: {}, arrel: null, cami: '', sel: new Set(), pw: '', cerca: '', ordre: 'nom', xifrat: false };

  /** De diverses parts tria la que s'ha d'obrir. */
  function triaPrincipal(fs) {
    if (fs.length === 1) return fs[0];
    const n = (f) => f.name.toLowerCase();
    return fs.find((f) => /\.part0*1\.rar$/.test(n(f))) || fs.find((f) => /\.(7z|zip|rar|tar)\.0*1$/.test(n(f)) || /\.0*1$/.test(n(f)))
      || fs.find((f) => /\.rar$/.test(n(f)) && !/\.part\d+\.rar$/.test(n(f))) || fs.find((f) => /\.zip$/.test(n(f)))
      || fs.find((f) => EXT_ARXIU.has(ext(f.name))) || fs[0];
  }

  function demanaPw(nom, incorrecta) {
    return new Promise((resol) => {
      const inp = el('input', { type: 'password', autocomplete: 'off', placeholder: T_('Contrasenya') });
      let fet = false;
      const acaba = (v) => { if (fet) return; fet = true; enTancarDlg = null; tancaDlg(); resol(v); };
      const form = el('form', { onsubmit: (e) => { e.preventDefault(); acaba(inp.value); } },
        el('p', {}, incorrecta ? T_('La contrasenya no és correcta. Torna-ho a provar.') : T_('«{nom}» està protegit amb contrasenya.', { nom })),
        el('label', { class: 'camp' }, el('span', { class: 'pw' }, inp, el('button', { type: 'button', class: 'discret ull', onclick: () => { inp.type = inp.type === 'password' ? 'text' : 'password'; } }, '👁'))),
        el('div', { class: 'accions-desa' }, el('button', { type: 'submit', class: 'primari' }, T_("D'acord"))));
      obreDlg(T_('Contrasenya'), form);
      enTancarDlg = () => acaba(null);
      setTimeout(() => inp.focus(), 50);
    });
  }

  /** Executa una operació del motor demanant la contrasenya tantes vegades com calgui. */
  async function ambPw(fn, titol) {
    for (let intents = 0; ; intents++) {
      try { return await fn(est.pw); } catch (e) {
        if (e.codi !== 'pw') throw e;
        amagaPr();
        const pw = await demanaPw(est.nom, intents > 0 || !!est.pw);
        if (pw == null) throw Object.assign(new Error('cancel'), { codi: 'cancel' });
        est.pw = pw;
        progres(titol, () => tancaArxiu());
      }
    }
  }

  async function obreFitxers(llista) {
    const fs = [...llista].filter((f) => f && f.size !== undefined);
    if (!fs.length) return;
    const princ = triaPrincipal(fs);
    tancaArxiu();
    vista('obrir');
    const m = new Motor();
    Object.assign(est, { motor: m, nom: princ.name, fitxers: fs, pw: '', cami: '', sel: new Set(), cerca: '' });
    $('#cerca').value = '';
    const titol = T_('Obrint {nom}…', { nom: princ.name });
    progres(titol, () => tancaArxiu());
    try {
      const { res } = await ambPw((pw) => m.fes('obre', { fitxers: fs, principal: princ.name, pw }), titol);
      if (est.motor !== m) return;
      est.info = res.info;
      est.arrel = fesArbre(res.entrades);
      est.xifrat = res.entrades.some((e) => e.xifrat) || /7zAES|AES|ZipCrypto/i.test(res.info.Method || '') || !!est.pw;
      amagaPr();
      pintaArxiu();
      recent({ nom: princ.name, mida: fs.reduce((a, f) => a + f.size, 0), accio: 'obert' });
    } catch (e) {
      amagaPr();
      if (est.motor === m) tancaArxiu();
      if (e.codi === 'noarxiu' && /\.(0*[2-9]\d*|part0*[2-9]\d*\.rar|r\d\d|z\d\d)$/i.test(princ.name)) e.codi = 'trencat';
      mostraError(e, T_("No s'ha pogut obrir"));
    }
  }

  function fesArbre(entrades) {
    const arrel = { nom: '', cami: '', dir: true, fills: new Map(), mida: 0, comp: 0, n: 0 };
    for (const e of entrades) {
      const parts = e.cami.split('/').filter(Boolean);
      if (!parts.length) continue;
      let n = arrel, c = '';
      parts.forEach((p, i) => {
        c = c ? c + '/' + p : p;
        const ultim = i === parts.length - 1;
        let f = n.fills.get(p);
        if (!f) { f = { nom: p, cami: c, dir: !ultim || e.dir, fills: new Map(), mida: 0, n: 0, data: null }; n.fills.set(p, f); }
        if (ultim) {
          f.data = e.data;
          if (!e.dir) Object.assign(f, { dir: false, mida: e.mida, comp: e.comp, xifrat: e.xifrat, metode: e.metode });
        }
        n = f;
      });
    }
    const suma = (n) => {
      if (!n.dir) return [n.mida, 1, n.comp || 0];
      let m = 0, c = 0, k = 0;
      for (const f of n.fills.values()) { const [a, b, d] = suma(f); m += a; c += b; k += d; }
      n.mida = m; n.n = c; n.comp = k; return [m, c, k];
    };
    suma(arrel);
    return arrel;
  }
  function node(cami) {
    let n = est.arrel;
    if (!cami) return n;
    for (const p of cami.split('/')) { n = n && n.fills.get(p); }
    return n;
  }
  function tots(n, out = []) { for (const f of n.fills.values()) { out.push(f); if (f.dir) tots(f, out); } return out; }

  function tancaArxiu() {
    if (est.motor) est.motor.tanca();
    Object.assign(est, { motor: null, arrel: null, info: {}, fitxers: [], sel: new Set(), pw: '' });
    $('#obrir-ple').hidden = true; $('#obrir-buit').hidden = false;
    pintaRecents();
  }
  $('#b-tanca-arxiu').onclick = tancaArxiu;

  function pintaArxiu() {
    $('#obrir-buit').hidden = true; $('#obrir-ple').hidden = false;
    const e = ext(est.nom);
    const ico = $('#ico-arxiu'); ico.textContent = (e || '?').slice(0, 4).toUpperCase(); ico.style.background = colorExt(e);
    $('#a-nom').textContent = est.nom;
    const r = est.arrel;
    const fisica = +est.info['Physical Size'] || est.fitxers.reduce((a, f) => a + f.size, 0);
    $('#a-resum').textContent = T_('{n} fitxers · {mida} descomprimit', { n: nf().format(r.n), mida: mida(r.mida) });
    const det = [];
    if (est.info.Type) det.push(est.info.Type.toUpperCase());
    det.push(mida(fisica));
    if (r.mida > 0 && fisica > 0 && fisica < r.mida) det.push(T_('ocupa el {p} %', { p: Math.max(1, Math.round((100 * fisica) / r.mida)) }));
    if (est.info.Method) det.push(est.info.Method);
    if (est.info.Solid === '+') det.push(T_('sòlid'));
    if (+est.info.Volumes > 1 || est.fitxers.length > 1) det.push(T_('{n} parts', { n: est.info.Volumes || est.fitxers.length }));
    const box = $('#a-detalls'); box.replaceChildren(...det.map((t) => el('span', { class: 'etiqueta' }, t)));
    if (est.xifrat) box.append(el('span', { class: 'etiqueta alerta' }, '🔒 ' + T_('amb contrasenya')));
    pintaLlista();
  }

  function ordena(a) {
    const o = est.ordre;
    return a.sort((x, y) => (y.dir - x.dir) || (o === 'mida' ? y.mida - x.mida : o === 'data' ? (y.data || 0) - (x.data || 0)
      : o === 'tipus' ? ext(x.nom).localeCompare(ext(y.nom)) || x.nom.localeCompare(y.nom, undefined, { numeric: true }) : x.nom.localeCompare(y.nom, undefined, { numeric: true, sensitivity: 'base' })));
  }

  const MAX_FILES = 400;
  let limitLlista = MAX_FILES;
  function pintaLlista() {
    if (!est.arrel) return;
    const q = est.cerca.trim().toLowerCase();
    let items;
    if (q) items = tots(est.arrel).filter((n) => n.nom.toLowerCase().includes(q));
    else items = [...(node(est.cami) || est.arrel).fills.values()];
    ordena(items);
    // molla de pa
    const molla = $('#molla'); molla.replaceChildren();
    if (!q) {
      const parts = est.cami ? est.cami.split('/') : [];
      molla.append(el('button', { onclick: () => entra('') }, '⌂ ' + senseExt(est.nom)));
      parts.forEach((p, i) => { molla.append(el('span', {}, '›'), el('button', { onclick: () => entra(parts.slice(0, i + 1).join('/')) }, p)); });
    } else molla.append(el('span', {}, T_('{n} resultats', { n: items.length })));
    const ul = $('#llista'); ul.replaceChildren();
    if (est.cami && !q) {
      const amunt = est.cami.split('/').slice(0, -1).join('/');
      ul.append(el('li', {}, el('span', { class: 'ico carpeta', html: '<svg viewBox="0 0 24 24"><path d="M11 9 6 14h4v6h2v-6h4z" transform="rotate(0)"/><path d="M4 4h16v2H4z"/></svg>' }),
        el('button', { class: 'cos', onclick: () => entra(amunt) }, el('b', {}, '..'), el('small', {}, T_('Carpeta superior')))));
    }
    for (const n of items.slice(0, limitLlista)) {
      const chk = el('input', { type: 'checkbox', 'aria-label': n.nom });
      chk.checked = est.sel.has(n.cami);
      chk.onchange = () => { if (chk.checked) est.sel.add(n.cami); else est.sel.delete(n.cami); li.classList.toggle('marcat', chk.checked); pintaSel(); };
      const sub = n.dir ? T_('{n} fitxers · {mida}', { n: nf().format(n.n), mida: mida(n.mida) })
        : [mida(n.mida), dataTxt(n.data)].filter(Boolean).join(' · ');
      const li = el('li', { class: est.sel.has(n.cami) ? 'marcat' : '' },
        el('label', { class: 'check' }, chk),
        icona(n.nom, n.dir),
        el('button', { class: 'cos', onclick: () => (n.dir ? entra(n.cami) : accionsFitxer(n)) },
          el('b', { 'data-no-t': true }, n.nom), el('small', {}, (n.xifrat ? '🔒 ' : '') + (q ? n.cami + ' · ' : '') + sub)));
      ul.append(li);
    }
    if (items.length > limitLlista) {
      ul.append(el('li', {}, el('button', { class: 'cos centre', onclick: () => { limitLlista += MAX_FILES * 2; pintaLlista(); } }, el('b', {}, T_('Mostra’n més ({n} més)', { n: items.length - limitLlista })))));
    }
    $('#llista-buida').hidden = items.length > 0 || !!est.cami;
    pintaSel();
  }
  function entra(c) { est.cami = c; est.cerca = ''; $('#cerca').value = ''; limitLlista = MAX_FILES; pintaLlista(); }
  function pintaSel() {
    const n = est.sel.size;
    $('#sel-compte').textContent = n ? T_('{n} seleccionats', { n }) : '';
    $('#b-extreu').textContent = n ? T_('Extreu la selecció ({n})', { n }) : T_('Extreu-ho tot');
    const visibles = [...document.querySelectorAll('#llista input[type=checkbox]')];
    $('#sel-tot').checked = visibles.length > 0 && visibles.every((c) => c.checked);
  }
  $('#sel-tot').onchange = (e) => {
    document.querySelectorAll('#llista input[type=checkbox]').forEach((c) => { if (c.checked !== e.target.checked) { c.checked = e.target.checked; c.dispatchEvent(new Event('change')); } });
  };
  $('#cerca').oninput = (e) => { est.cerca = e.target.value; limitLlista = MAX_FILES; pintaLlista(); };
  $('#ordre').onchange = (e) => { est.ordre = e.target.value; pintaLlista(); };

  /** Extreu camins (null = tot). Retorna [{cami, blob}]. */
  async function extreuCamins(camins, titol) {
    const m = est.motor;
    const total = camins ? camins.reduce((a, c) => { const n = node(c); return a + (n ? (n.dir ? n.n + 1 : 1) : 1); }, 0) : est.arrel.n;
    progres(titol, () => tancaArxiu());
    const { fitxers } = await ambPw((pw) => m.fes('extreu', { camins, pw, planes: aj.planes, total }, onProgres), titol);
    amagaPr();
    return fitxers;
  }

  $('#b-extreu').onclick = async () => {
    const camins = est.sel.size ? [...est.sel] : null;
    try {
      const fs = await extreuCamins(camins, T_('Extraient…'));
      if (!fs.length) { avis(T_('No hi havia cap fitxer per extreure.')); return; }
      recent({ nom: est.nom, mida: fs.reduce((a, f) => a + f.blob.size, 0), accio: 'extret' });
      onDesar(fs, { carpeta: aj.carpeta && fs.length > 1 ? senseExt(est.nom) : '', titol: T_('Extret: {n} fitxers', { n: fs.length }) });
    } catch (e) { amagaPr(); mostraError(e); }
  };

  $('#b-prova').onclick = async () => {
    const titol = T_('Comprovant l’arxiu…');
    progres(titol, () => tancaArxiu());
    try {
      const { res } = await ambPw((pw) => est.motor.fes('prova', { pw, total: est.arrel.n }, onProgres), titol);
      amagaPr();
      if (res.ok) obreDlg(T_('Prova'), el('p', {}, '✅ ' + T_("L'arxiu està bé: {n} fitxers comprovats, sense errors.", { n: nf().format(est.arrel.n) })));
      else obreDlg(T_('Prova'), el('p', {}, '⚠️ ' + (MISSATGES[res.codi] || MISSATGES.altre)()), el('pre', { class: 'err', 'data-no-t': true }, res.errors || ''));
    } catch (e) { amagaPr(); mostraError(e); }
  };

  const PREVIA = {
    img: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif', 'ico'],
    video: ['mp4', 'webm', 'm4v', 'mov', 'ogv'],
    audio: ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus'],
    text: ['txt', 'md', 'log', 'ini', 'cfg', 'nfo', 'csv', 'tsv', 'json', 'xml', 'yml', 'yaml', 'js', 'mjs', 'ts', 'py', 'html', 'htm', 'css', 'java', 'c', 'cpp', 'h', 'cs', 'php', 'sh', 'bat', 'ps1', 'sql', 'kt', 'go', 'rs', 'srt', 'vtt', 'gitignore', 'toml', 'properties', 'gradle', 'svg'],
    pdf: ['pdf'],
  };
  const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml', avif: 'image/avif', ico: 'image/x-icon', mp4: 'video/mp4', webm: 'video/webm', m4v: 'video/mp4', mov: 'video/quicktime', ogv: 'video/ogg', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac', opus: 'audio/ogg', pdf: 'application/pdf', txt: 'text/plain', zip: 'application/zip' };
  const tipusPrevia = (e) => Object.keys(PREVIA).find((k) => PREVIA[k].includes(e));

  async function accionsFitxer(n) {
    try {
      const fs = await extreuCamins([n.cami], T_('Extraient {nom}…', { nom: n.nom }));
      const f = fs.find((x) => base(x.cami) === n.nom) || fs[0];
      if (!f) { avis(T_('No hi havia cap fitxer per extreure.')); return; }
      previa(n, f.blob);
    } catch (e) { amagaPr(); mostraError(e); }
  }

  let urlPrevia = null;
  function previa(n, blob) {
    const e = ext(n.nom), t = tipusPrevia(e);
    const d = $('#dlg-previa');
    $('#pv-nom').textContent = n.nom;
    const cos = $('#pv-cos'); cos.replaceChildren();
    if (urlPrevia) URL.revokeObjectURL(urlPrevia);
    const tipada = new Blob([blob], { type: MIME[e] || 'application/octet-stream' });
    urlPrevia = URL.createObjectURL(tipada);
    const info = el('p', { class: 'suau petit' }, [mida(n.mida), dataTxt(n.data), n.metode].filter(Boolean).join(' · '));
    if (t === 'img') cos.append(el('img', { src: urlPrevia, alt: n.nom }));
    else if (t === 'video') cos.append(el('video', { src: urlPrevia, controls: true, playsinline: true }));
    else if (t === 'audio') cos.append(el('audio', { src: urlPrevia, controls: true }));
    else if (t === 'pdf' && !mobil) cos.append(el('iframe', { src: urlPrevia, title: n.nom }));
    else if (t === 'text') {
      const pre = el('pre', { 'data-no-t': true }, T_('Carregant…'));
      cos.append(pre);
      blob.slice(0, 512 * 1024).text().then((s) => { pre.textContent = s + (blob.size > 512 * 1024 ? '\n\n… (' + T_('només es mostren els primers 512 KB') + ')' : ''); });
    } else cos.append(el('p', { class: 'suau' }, T_('No es pot mostrar aquest tipus de fitxer, però el pots desar o compartir.')));
    cos.append(info);
    const acc = $('#pv-accions'); acc.replaceChildren();
    const fitxer = [{ cami: n.nom, blob: tipada }];
    for (const b of botonsDesar(fitxer, { carpeta: '' })) acc.append(b);
    if (EXT_ARXIU.has(e)) acc.append(el('button', { onclick: () => { d.close(); obreFitxers([new File([blob], n.nom)]); } }, '📦 ' + T_('Obre aquest arxiu')));
    if (!d.open) d.showModal();
  }
  $('#pv-tanca').onclick = () => $('#dlg-previa').close();
  $('#dlg-previa').addEventListener('close', () => { $('#pv-cos').replaceChildren(); if (urlPrevia) { URL.revokeObjectURL(urlPrevia); urlPrevia = null; } });

  // ---------- Convertir ----------
  $('#b-converteix').onclick = () => {
    let fmt = aj.format === est.info.Type ? '7z' : aj.format;
    const xips = el('div', { class: 'xips' });
    const pinta = () => {
      xips.replaceChildren(...FORMATS.filter((f) => !f.un).map((f) => el('button', { type: 'button', class: 'xip' + (f.id === fmt ? ' activa' : ''), onclick: () => { fmt = f.id; pinta(); } }, f.nom)));
    };
    pinta();
    const pw = el('input', { type: 'password', autocomplete: 'new-password', placeholder: T_('Deixa-ho buit per no xifrar') });
    obreDlg(T_('Converteix a un altre format'),
      el('p', { class: 'suau' }, T_('Es crearà un arxiu nou amb el mateix contingut. L’original no es toca.')), xips,
      el('label', { class: 'camp' }, T_('Contrasenya nova (només 7Z i ZIP)'), pw),
      el('div', { class: 'accions-desa' }, el('button', { class: 'primari', onclick: async () => {
        tancaDlg();
        const F = FORMATS.find((f) => f.id === fmt);
        const nom = senseExt(est.nom) + F.ext;
        const titol = T_('Convertint a {f}…', { f: F.nom });
        progres(titol, () => tancaArxiu());
        try {
          const { res, fitxers } = await ambPw((pwo) => est.motor.fes('converteix', {
            format: fmt, nivell: aj.nivell, pw: F.pw ? pw.value : '', xifraNoms: true, metodeZip: 'aes', volum: 0, nom, pwOrigen: pwo, total: est.arrel.n,
          }, onProgres), titol);
          amagaPr();
          recent({ nom, mida: res.mida, accio: 'creat' });
          onDesar(fitxers, { carpeta: '', titol: T_('Convertit: {nom}', { nom }), resum: T_('{a} → {b}', { a: mida(est.fitxers.reduce((a, f) => a + f.size, 0)), b: mida(res.mida) }) });
        } catch (e) { amagaPr(); mostraError(e); }
      } }, T_('Converteix'))));
  };

  // ---------- Desar / compartir ----------
  const potCompartir = (files) => { try { return !!(navigator.canShare && navigator.canShare({ files })); } catch { return false; } };

  function botonsDesar(fs, { carpeta }) {
    const bs = [];
    const files = () => fs.map((f) => new File([f.blob], base(f.cami), { type: f.blob.type || MIME[ext(f.cami)] || 'application/octet-stream' }));
    if (natiu) {
      bs.push(el('button', { class: 'primari', onclick: () => desaNatiu(fs, carpeta) }, '💾 ' + T_('Desa a Documents')));
      bs.push(el('button', { onclick: () => comparteixNatiu(fs) }, '📤 ' + T_('Comparteix')));
      return bs;
    }
    if (window.showDirectoryPicker && (fs.length > 1 || !mobil)) bs.push(el('button', { class: 'primari', onclick: () => desaCarpeta(fs, carpeta) }, '📁 ' + T_('Desa a una carpeta…')));
    if (fs.length === 1) bs.push(el('button', { class: bs.length ? '' : 'primari', onclick: () => descarrega(fs[0].blob, base(fs[0].cami)) }, '⬇️ ' + T_('Descarrega')));
    else bs.push(el('button', { class: bs.length ? '' : 'primari', onclick: () => descarregaZip(fs, carpeta) }, '⬇️ ' + T_('Descarrega en un ZIP')));
    if (navigator.share && fs.length <= 200 && potCompartir(files().slice(0, 1))) {
      bs.push(el('button', { onclick: async () => {
        const f = files();
        if (!potCompartir(f)) { avis(T_('Aquests fitxers no es poden compartir des del navegador.')); return; }
        try { await navigator.share({ files: f }); } catch (e) { if (e.name !== 'AbortError') avis(T_('No s’ha pogut compartir.')); }
      } }, '📤 ' + (/iPhone|iPad|Mac/.test(navigator.userAgent) ? T_('Comparteix / Desa a Fitxers') : T_('Comparteix'))));
    }
    return bs;
  }

  function onDesar(fs, { carpeta, titol, resum }) {
    const total = fs.reduce((a, f) => a + f.blob.size, 0);
    const llista = el('ul', { class: 'mini' }, ...fs.slice(0, 8).map((f) => el('li', {}, el('span', { 'data-no-t': true }, f.cami), el('span', {}, mida(f.blob.size)))));
    if (fs.length > 8) llista.append(el('li', {}, el('span', { class: 'suau' }, T_('… i {n} més', { n: fs.length - 8 })), el('span', {}, '')));
    obreDlg(titol, llista, el('p', { class: 'suau' }, resum || T_('En total {mida}.', { mida: mida(total) })),
      el('div', { class: 'accions-desa' }, ...botonsDesar(fs, { carpeta })));
  }

  function descarrega(blob, nom) {
    const a = el('a', { href: URL.createObjectURL(blob), download: nom });
    document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 60000);
  }

  async function descarregaZip(fs, carpeta) {
    const m = new Motor();
    const nom = (carpeta || senseExt(est.nom || 'arxiu')) + '.zip';
    progres(T_('Preparant el ZIP…'), () => m.tanca());
    try {
      const { fitxers } = await m.fes('comprimeix', { fitxers: fs.map((f) => ({ cami: (carpeta ? carpeta + '/' : '') + f.cami, file: f.blob })), nom, format: 'zip', nivell: 1 }, onProgres);
      amagaPr();
      descarrega(fitxers[0].blob, nom);
    } catch (e) { amagaPr(); mostraError(e); } finally { m.w.terminate(); }
  }

  async function desaCarpeta(fs, carpeta) {
    let dir;
    try { dir = await window.showDirectoryPicker({ id: 'xoriguer-compactador', mode: 'readwrite' }); } catch { return; }
    progres(T_('Desant…'));
    try {
      const cache = new Map();
      const sub = async (cami) => {
        if (!cami) return dir;
        if (cache.has(cami)) return cache.get(cami);
        const i = cami.lastIndexOf('/');
        const pare = await sub(i < 0 ? '' : cami.slice(0, i));
        const d = await pare.getDirectoryHandle(cami.slice(i + 1), { create: true });
        cache.set(cami, d); return d;
      };
      let i = 0;
      for (const f of fs) {
        const cami = (carpeta ? carpeta + '/' : '') + f.cami;
        const j = cami.lastIndexOf('/');
        const d = await sub(j < 0 ? '' : cami.slice(0, j));
        const fh = await d.getFileHandle(cami.slice(j + 1), { create: true });
        const w = await fh.createWritable(); await w.write(f.blob); await w.close();
        avancaPr(++i, fs.length, cami);
      }
      amagaPr(); tancaDlg();
      avis(T_('Desat: {n} fitxers a «{dir}».', { n: fs.length, dir: dir.name + (carpeta ? '/' + carpeta : '') }));
    } catch (e) { amagaPr(); mostraError(Object.assign(e, { codi: 'altre', detall: e.message })); }
  }

  // --- APK (Capacitor): Filesystem + Share ---
  function b64(blob) {
    return new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = ko; r.readAsDataURL(blob); });
  }
  async function escriuNatiu(path, blob, directory) {
    const TROS = 3 * 1024 * 1024;
    if (blob.size <= TROS) { await FSN.writeFile({ path, data: await b64(blob), directory, recursive: true }); return; }
    for (let o = 0; o < blob.size; o += TROS) {
      const data = await b64(blob.slice(o, o + TROS));
      if (o === 0) await FSN.writeFile({ path, data, directory, recursive: true }); else await FSN.appendFile({ path, data, directory });
    }
  }
  async function desaNatiu(fs, carpeta) {
    try { await FSN.requestPermissions(); } catch { /* Android 11+ no en cal */ }
    progres(T_('Desant…'));
    const arrel = 'Xoriguer Compactador' + (carpeta ? '/' + carpeta : '');
    try {
      let i = 0;
      for (const f of fs) { await escriuNatiu(arrel + '/' + f.cami, f.blob, 'DOCUMENTS'); avancaPr(++i, fs.length, f.cami); }
      amagaPr(); tancaDlg();
      avis(T_('Desat a Documents/{dir}', { dir: arrel }));
    } catch (e) { amagaPr(); mostraError({ codi: 'altre', detall: e.message || String(e) }); }
  }
  async function comparteixNatiu(fs) {
    progres(T_('Preparant…'));
    try {
      const uris = [];
      for (const f of fs.slice(0, 100)) {
        const path = 'compartits/' + Date.now() + '/' + base(f.cami);
        await escriuNatiu(path, f.blob, 'CACHE');
        uris.push((await FSN.getUri({ path, directory: 'CACHE' })).uri);
      }
      amagaPr();
      await SHN.share({ files: uris });
    } catch (e) { amagaPr(); if (!/cancel/i.test(e.message || '')) avis(T_('No s’ha pogut compartir.')); }
  }

  // ---------- Recents ----------
  function recent(r) {
    if (!aj.recents) return;
    const ll = ls.get('recents', []).filter((x) => !(x.nom === r.nom && x.accio === r.accio));
    ll.unshift({ ...r, t: Date.now() });
    ls.set('recents', ll.slice(0, 12));
  }
  const ACCIONS = { obert: 'obert', extret: 'extret', creat: 'creat' };
  function pintaRecents() {
    const ll = aj.recents ? ls.get('recents', []) : [];
    $('#recents').hidden = !ll.length;
    $('#llista-recents').replaceChildren(...ll.map((r) => el('li', {}, el('span', {}, el('b', { 'data-no-t': true }, r.nom)),
      el('span', {}, T_(ACCIONS[r.accio] || r.accio) + ' · ' + mida(r.mida) + ' · ' + dataTxt(r.t)))));
  }
  $('#b-esborra-recents').onclick = () => { ls.set('recents', []); pintaRecents(); };

  // ---------- Entrada de fitxers ----------
  $('#f-obrir').onchange = (e) => { const f = [...e.target.files]; e.target.value = ''; obreFitxers(f); };
  const zona = $('#zona-obrir');
  zona.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#f-obrir').click(); } });

  // ================================================================
  //  COMPRIMIR
  // ================================================================
  const FORMATS = [
    { id: 'zip', nom: 'ZIP', ext: '.zip', pw: true, ajuda: 'El més compatible: s’obre a Windows, Mac, Android i iPhone sense res més.' },
    { id: '7z', nom: '7Z', ext: '.7z', pw: true, ajuda: 'El que comprimeix més. Contrasenya AES-256 i noms xifrats. Cal 7-Zip o una app com aquesta.' },
    { id: 'tar.gz', nom: 'TAR.GZ', ext: '.tar.gz', ajuda: 'L’estàndard de Linux i macOS. Sense contrasenya.' },
    { id: 'tar.xz', nom: 'TAR.XZ', ext: '.tar.xz', ajuda: 'Com TAR.GZ però comprimeix més (i és més lent).' },
    { id: 'tar.bz2', nom: 'TAR.BZ2', ext: '.tar.bz2', ajuda: 'Variant clàssica de Linux.' },
    { id: 'tar', nom: 'TAR', ext: '.tar', sensenivell: true, ajuda: 'Només ajunta els fitxers, sense comprimir.' },
    { id: 'wim', nom: 'WIM', ext: '.wim', ajuda: 'Format d’imatge de Windows.' },
    { id: 'gz', nom: 'GZ', ext: '.gz', un: true, ajuda: 'Comprimeix un sol fitxer.' },
    { id: 'bz2', nom: 'BZ2', ext: '.bz2', un: true, ajuda: 'Comprimeix un sol fitxer.' },
    { id: 'xz', nom: 'XZ', ext: '.xz', un: true, ajuda: 'Comprimeix un sol fitxer.' },
  ];
  const cmp = { fitxers: [], format: aj.format, nomTocat: false, resultat: null };
  const F_ = () => FORMATS.find((f) => f.id === cmp.format) || FORMATS[0];

  function afegeix(llista) {
    const nous = [];
    for (const it of llista) {
      const cami = (it.cami || it.file.webkitRelativePath || it.file.name).replace(/^\/+/, '');
      if (!cmp.fitxers.some((f) => f.cami === cami)) nous.push({ cami, file: it.file });
    }
    cmp.fitxers.push(...nous);
    $('#resultat').hidden = true;
    pintaCmp();
    if (nous.length) avis(T_('{n} fitxers afegits', { n: nous.length }));
  }
  function grups() {
    const g = new Map();
    for (const f of cmp.fitxers) {
      const p = f.cami.split('/');
      const k = p[0];
      const x = g.get(k) || { nom: k, dir: p.length > 1, n: 0, mida: 0 };
      x.n++; x.mida += f.file.size; g.set(k, x);
    }
    return [...g.values()];
  }
  function pintaCmp() {
    const gs = grups();
    const ul = $('#llista-afegits');
    ul.replaceChildren(...gs.map((g) => el('li', {}, icona(g.nom, g.dir),
      el('div', { class: 'cos' }, el('b', { 'data-no-t': true }, g.nom), el('small', {}, g.dir ? T_('{n} fitxers · {mida}', { n: g.n, mida: mida(g.mida) }) : mida(g.mida))),
      el('button', { class: 'discret mes', 'aria-label': T_('Treu'), onclick: () => { cmp.fitxers = cmp.fitxers.filter((f) => f.cami.split('/')[0] !== g.nom); pintaCmp(); } }, '✕'))));
    const total = cmp.fitxers.reduce((a, f) => a + f.file.size, 0);
    $('#afegits-peu').hidden = !gs.length;
    $('#afegits-resum').textContent = T_('{n} fitxers · {mida}', { n: cmp.fitxers.length, mida: mida(total) });
    if (!cmp.nomTocat) $('#c-nom').value = gs.length === 1 ? (F_().un ? gs[0].nom : senseExt(gs[0].nom)) : (gs.length ? T_('arxiu') : '');
    pintaOpcions();
  }
  function pintaOpcions() {
    const F = F_();
    $('#c-format').replaceChildren(...FORMATS.map((f) => el('button', { type: 'button', class: 'xip' + (f.id === F.id ? ' activa' : ''), onclick: () => { cmp.format = f.id; pintaCmp(); } }, f.nom)));
    $('#c-ext').textContent = F.ext;
    $('#c-format-ajuda').textContent = T_(F.ajuda);
    $('#c-bloc-pw').hidden = !F.pw;
    $('#c-l-noms').hidden = F.id !== '7z';
    $('#c-l-metode').hidden = F.id !== 'zip';
    $('#c-nivell').disabled = !!F.sensenivell;
    const n = cmp.fitxers.length;
    const unSolMal = F.un && (n !== 1);
    $('#b-comprimeix').disabled = !n || unSolMal;
    if (unSolMal && n) $('#c-format-ajuda').textContent = T_('Aquest format només admet un sol fitxer. Per a diversos, fes servir TAR.GZ, TAR.BZ2 o TAR.XZ.');
  }
  $('#c-nom').oninput = () => { cmp.nomTocat = true; };
  $('#b-buida').onclick = () => { cmp.fitxers = []; cmp.nomTocat = false; pintaCmp(); };
  $('#f-afegir').onchange = (e) => { afegeix([...e.target.files].map((file) => ({ file, cami: file.name }))); e.target.value = ''; };
  $('#f-carpeta').onchange = (e) => { afegeix([...e.target.files].map((file) => ({ file }))); e.target.value = ''; };
  if (mobil || natiu) $('#l-carpeta').hidden = true;
  if (window.showDirectoryPicker && !mobil) {
    $('#l-carpeta').hidden = true;
    const b = $('#b-carpeta-fsa'); b.hidden = false;
    b.onclick = async () => {
      let d; try { d = await window.showDirectoryPicker({ id: 'xoriguer-compactador-orig' }); } catch { return; }
      progres(T_('Llegint la carpeta…'));
      const out = [];
      const recorre = async (h, prefix) => { for await (const [nom, x] of h.entries()) { if (x.kind === 'file') out.push({ cami: prefix + nom, file: await x.getFile() }); else await recorre(x, prefix + nom + '/'); } };
      try { await recorre(d, d.name + '/'); } finally { amagaPr(); }
      afegeix(out);
    };
  }

  $('#b-comprimeix').onclick = async () => {
    const F = F_();
    let nom = ($('#c-nom').value.trim() || T_('arxiu')).replace(/[\\/:*?"<>|]/g, '_');
    if (!nom.toLowerCase().endsWith(F.ext)) nom += F.ext;
    const pw = F.pw ? $('#c-pw').value : '';
    const m = new Motor();
    progres(T_('Comprimint…'), () => m.tanca());
    const t0 = performance.now();
    try {
      const { res, fitxers } = await m.fes('comprimeix', {
        fitxers: cmp.fitxers, nom, format: F.id, nivell: +$('#c-nivell').value, pw,
        xifraNoms: $('#c-noms').checked, metodeZip: $('#c-metode').value, volum: +$('#c-volum').value,
      }, onProgres);
      amagaPr();
      const entrada = cmp.fitxers.reduce((a, f) => a + f.file.size, 0);
      const sortida = fitxers.reduce((a, f) => a + f.blob.size, 0);
      fitxers.sort((a, b) => a.cami.localeCompare(b.cami));
      cmp.resultat = fitxers;
      recent({ nom, mida: sortida, accio: 'creat' });
      $('#res-fitxers').replaceChildren(...fitxers.map((f) => el('li', {}, el('span', { 'data-no-t': true }, f.cami), el('span', {}, mida(f.blob.size)))));
      $('#res-resum').textContent = T_('{a} → {b} ({p} % de l’original) en {s} s', { a: mida(entrada), b: mida(sortida), p: !entrada ? 0 : sortida < entrada / 100 ? '< 1' : Math.round((100 * sortida) / entrada), s: nf().format((performance.now() - t0) / 1000) })
        + (pw ? ' · 🔒' : '');
      $('#res-accions').replaceChildren(...botonsDesar(fitxers, { carpeta: '' }));
      $('#resultat').hidden = false;
      $('#resultat').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) { amagaPr(); mostraError(e, T_("No s'ha pogut comprimir")); } finally { m.w.terminate(); }
  };

  // ---------- Arrossegar i deixar anar ----------
  async function llegeixEntrades(items) {
    const out = [];
    const llegeixDir = (dir) => new Promise((ok) => { const r = dir.createReader(); const tot = []; const seg = () => r.readEntries((es) => { if (!es.length) ok(tot); else { tot.push(...es); seg(); } }, () => ok(tot)); seg(); });
    const recorre = async (ent, prefix) => {
      if (ent.isFile) out.push(await new Promise((ok) => ent.file((file) => ok({ cami: prefix + ent.name, file }), () => ok(null))));
      else if (ent.isDirectory) for (const e of await llegeixDir(ent)) await recorre(e, prefix + ent.name + '/');
    };
    const ents = [...items].map((it) => it.webkitGetAsEntry && it.webkitGetAsEntry()).filter(Boolean);
    for (const e of ents) await recorre(e, '');
    return out.filter(Boolean);
  }
  let profund = 0;
  window.addEventListener('dragenter', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { profund++; document.body.classList.add('arrossega'); } });
  window.addEventListener('dragleave', () => { if (--profund <= 0) { profund = 0; document.body.classList.remove('arrossega'); } });
  window.addEventListener('dragover', (e) => { e.preventDefault(); });
  window.addEventListener('drop', async (e) => {
    e.preventDefault(); profund = 0; document.body.classList.remove('arrossega');
    const dt = e.dataTransfer; if (!dt) return;
    const aComprimir = $('#v-comprimir').classList.contains('activa');
    if (aComprimir) {
      const ents = dt.items && dt.items.length && dt.items[0].webkitGetAsEntry ? await llegeixEntrades(dt.items) : [...dt.files].map((file) => ({ file, cami: file.name }));
      afegeix(ents);
    } else obreFitxers([...dt.files]);
  });

  // ---------- Ajustos ----------
  const sIdi = $('#aj-idioma'); sIdi.value = aj.idioma;
  sIdi.onchange = () => { aj.idioma = sIdi.value; desaAj(); location.reload(); };
  const sFmt = $('#aj-format');
  sFmt.replaceChildren(...FORMATS.filter((f) => !f.un).map((f) => el('option', { value: f.id }, f.nom)));
  sFmt.value = aj.format;
  sFmt.onchange = () => { aj.format = sFmt.value; desaAj(); cmp.format = aj.format; pintaCmp(); };
  const sNiv = $('#aj-nivell'); sNiv.value = String(aj.nivell);
  sNiv.onchange = () => { aj.nivell = +sNiv.value; desaAj(); $('#c-nivell').value = sNiv.value; };
  $('#c-nivell').value = String(aj.nivell);
  for (const [id, k] of [['#aj-carpeta', 'carpeta'], ['#aj-planes', 'planes'], ['#aj-recents', 'recents']]) {
    const c = $(id); c.checked = !!aj[k];
    c.onchange = () => { aj[k] = c.checked; desaAj(); if (k === 'recents') { if (!c.checked) ls.set('recents', []); pintaRecents(); } };
  }
  document.querySelectorAll('[data-ull]').forEach((b) => { b.onclick = () => { const i = document.getElementById(b.dataset.ull); i.type = i.type === 'password' ? 'text' : 'password'; }; });
  $('#versio-txt').textContent = 'Xoriguer Compactador ' + VERSIO + (natiu ? ' (Android)' : window.xcEscriptori ? ' (Windows)' : '') + ' · 7-Zip 24.09';

  // ---------- Instal·lació (PWA) ----------
  let promptInstal = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); promptInstal = e; $('#b-instal').hidden = false; });
  $('#b-instal').onclick = async () => { if (!promptInstal) return; promptInstal.prompt(); await promptInstal.userChoice.catch(() => {}); promptInstal = null; $('#b-instal').hidden = true; };
  window.addEventListener('appinstalled', () => { $('#b-instal').hidden = true; });

  // Obrir amb doble clic (PWA instal·lada a l'ordinador: file_handlers)
  if ('launchQueue' in window) {
    window.launchQueue.setConsumer(async (p) => {
      if (!p.files || !p.files.length) return;
      const fs = await Promise.all(p.files.map((h) => h.getFile()));
      obreFitxers(fs);
    });
  }
  // Fitxers compartits des d'una altra app (share_target): el service worker els deixa a la memòria cau
  async function compartits() {
    if (!/[?&]compartit=1/.test(location.search) || !('caches' in window)) return;
    history.replaceState(null, '', location.pathname);
    try {
      const c = await caches.open('xc-compartits');
      const ks = await c.keys();
      const fs = [];
      for (const k of ks) {
        const r = await c.match(k);
        const nom = decodeURIComponent(r.headers.get('X-Nom') || 'arxiu');
        fs.push(new File([await r.blob()], nom));
        await c.delete(k);
      }
      if (!fs.length) return;
      if (fs.every((f) => EXT_ARXIU.has(ext(f.name)))) obreFitxers(fs);
      else { vista('comprimir'); afegeix(fs.map((file) => ({ file, cami: file.name }))); }
    } catch (e) { console.error(e); }
  }

  // APK: «Obre amb…» des del gestor de fitxers (intent VIEW amb un content://) i botó enrere
  if (natiu) {
    const APP = window.Capacitor.registerPlugin('App');
    const MIME_EXT = { 'application/zip': 'zip', 'application/x-zip-compressed': 'zip', 'application/vnd.rar': 'rar', 'application/x-rar-compressed': 'rar', 'application/x-rar': 'rar', 'application/x-7z-compressed': '7z', 'application/x-tar': 'tar', 'application/gzip': 'gz', 'application/x-gzip': 'gz', 'application/x-bzip2': 'bz2', 'application/x-xz': 'xz', 'application/x-iso9660-image': 'iso' };
    const obreUrl = async (url) => {
      if (!url || !/^(content|file):/.test(url)) return;
      progres(T_('Carregant…'));
      try {
        let nom = base(decodeURIComponent(url).replace(/[?#].*$/, '')).replace(/^.*:/, '') || 'arxiu';
        const st = await FSN.stat({ path: url }).catch(() => null);
        if (st && st.name) nom = st.name;
        const r = await FSN.readFile({ path: url });
        const bin = Uint8Array.from(atob(r.data), (c) => c.charCodeAt(0));
        if (!ext(nom) && st && MIME_EXT[st.type]) nom += '.' + MIME_EXT[st.type];
        amagaPr();
        obreFitxers([new File([bin], nom)]);
      } catch (e) { amagaPr(); mostraError({ codi: 'altre', detall: e.message || String(e) }, T_("No s'ha pogut obrir")); }
    };
    APP.addListener('appUrlOpen', (e) => obreUrl(e.url));
    APP.getLaunchUrl().then((r) => r && obreUrl(r.url)).catch(() => {});
    APP.addListener('backButton', () => {
      for (const d of [$('#dlg-previa'), dlg]) if (d.open) { d.close(); return; }
      if (dPr.open) return;
      const actiu = document.querySelector('.vista.activa').id;
      if (actiu !== 'v-obrir') { vista('obrir'); return; }
      if (est.arrel && est.cami) { entra(est.cami.split('/').slice(0, -1).join('/')); return; }
      if (est.arrel) { tancaArxiu(); return; }
      APP.exitApp();
    });
  }

  // Windows (Electron): arxius oberts amb doble clic o «Obre amb…»
  if (window.xcEscriptori) {
    window.xcEscriptori.onObre((fs) => obreFitxers(fs.map((f) => new File([f.dades], f.nom))));
    window.xcEscriptori.llest();
  }

  if (!natiu && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // ---------- Inici ----------
  I18N.tradueix(document.body);
  pintaCmp();
  pintaRecents();
  compartits();
  window.XC = { est, cmp, obreFitxers, afegeix, VERSIO };
})();
