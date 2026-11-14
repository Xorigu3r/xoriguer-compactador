/* Xoriguer Compactador — motor (Web Worker de mòdul) amb 7-Zip 24.09 compilat a WebAssembly (7z-wasm).
 * Un worker per sessió: l'app el crea en obrir un arxiu o en comprimir, i el tanca (terminate) en acabar o cancel·lar,
 * així la memòria del WASM es torna sencera.
 *
 * Missatges que rep {id, op, ...}:
 *   obre       {fitxers:[File], principal, pw}       → {entrades, info}            (o error 'pw' / 'noarxiu')
 *   extreu     {camins|null, pw, planes}            → 'fitxer' {cami, dades} … i al final {n}
 *   prova      {pw}                                  → {ok, errors}
 *   comprimeix {fitxers:[{cami, file}], nom, format, nivell, pw, xifraNoms, metodeZip, volum}
 *                                                     → 'fitxer' {cami, dades} … i al final {mida}
 *   converteix {format, nivell, pw, xifraNoms, metodeZip, volum, nom, pwOrigen}
 * Envia {id, tipus:'progres', fets, total, nom} mentre treballa.
 */
import SevenZip from './vendor/7zz.es6.js';

const PW_BUIT = 'Xoriguer-sense-contrasenya'; // evita que 7-Zip demani la contrasenya per stdin
let z = null;
let linies = [];
let progres = null;     // (línia) => void, mentre una ordre treballa
let arxiu = null;       // camí de l'arxiu obert dins de /a

async function motor() {
  if (z) return z;
  z = await SevenZip({
    print: (s) => { linies.push(s); if (progres) progres(s); },
    printErr: (s) => { linies.push('! ' + s); },
  });
  for (const d of ['/a', '/o', '/r', '/s', '/t']) z.FS.mkdir(d);
  return z;
}

/** Executa 7zz amb els arguments; retorna {codi, sortida}. */
function executa(args, onLinia) {
  linies = [];
  progres = onLinia || null;
  let codi;
  try { codi = z.callMain(args); } catch (e) { codi = typeof e?.status === 'number' ? e.status : 255; linies.push('! ' + (e?.message || e)); }
  progres = null;
  return { codi, sortida: linies.join('\n') };
}

function classificaError(sortida) {
  if (/Wrong password|Cannot open encrypted archive|encrypted file/i.test(sortida)) return 'pw';
  if (/Cannot open the file as archive|Can not open the file as archive|is not archive/i.test(sortida)) return 'noarxiu';
  if (/Unexpected end of archive|Missing volume|There are some data after the end/i.test(sortida)) return 'trencat';
  if (/CRC Failed|Data Error|Headers Error/i.test(sortida)) return 'dades';
  if (/out of memory|Cannot enlarge memory|Aborted\(OOM\)/i.test(sortida)) return 'memoria';
  return 'altre';
}
class ErrorMotor extends Error { constructor(codi, detall) { super(codi); this.codi = codi; this.detall = detall; } }
function falla(sortida) {
  const detall = sortida.split('\n').filter((l) => /^! ?\S|ERROR|Error/.test(l)).slice(0, 12).join('\n').replace(/^! /gm, '');
  throw new ErrorMotor(classificaError(sortida), detall);
}

function buida(dir) {
  for (const n of z.FS.readdir(dir)) {
    if (n === '.' || n === '..') continue;
    const p = dir + '/' + n;
    const st = z.FS.lstat(p);
    if (z.FS.isDir(st.mode)) { buida(p); z.FS.rmdir(p); } else z.FS.unlink(p);
  }
}
function desmunta(dir) { try { z.FS.unmount(dir); } catch { /* no hi era */ } }

/** Envia cada fitxer de `dir` (recursiu) i l'esborra després; retorna quants i quants bytes. */
function enviaArbre(id, dir, prefix = '') {
  let n = 0, mida = 0;
  for (const nom of z.FS.readdir(dir)) {
    if (nom === '.' || nom === '..') continue;
    const p = dir + '/' + nom;
    const st = z.FS.lstat(p);
    if (z.FS.isDir(st.mode)) {
      const r = enviaArbre(id, p, prefix + nom + '/');
      if (!r.n) postMessage({ id, tipus: 'carpeta', cami: prefix + nom });
      n += r.n; mida += r.mida;
      z.FS.rmdir(p);
    } else if (z.FS.isFile(st.mode)) {
      const dades = z.FS.readFile(p);
      z.FS.unlink(p);
      n++; mida += dades.length; // abans d'enviar: la transferència buida el buffer
      postMessage({ id, tipus: 'fitxer', cami: prefix + nom, dades, data: st.mtime?.getTime?.() || Date.now() }, [dades.buffer]);
    } else z.FS.unlink(p);
  }
  return { n, mida };
}

/** Interpreta la sortida de «7zz l -slt». */
function llegeixLlista(sortida) {
  const blocs = sortida.replace(/\r/g, '').split('\n');
  const info = {}, entrades = [];
  let actual = null, part = 0; // 0 abans, 1 capçalera de l'arxiu, 2 entrades
  const tanca = () => {
    if (actual && actual.Path != null) {
      const dir = /D/.test(actual.Attributes || '') || actual.Folder === '+';
      entrades.push({
        cami: actual.Path.replace(/\\/g, '/').replace(/^\/+/, ''),
        dir,
        mida: +actual.Size || 0,
        comp: actual['Packed Size'] === '' || actual['Packed Size'] == null ? null : +actual['Packed Size'],
        data: actual.Modified ? Date.parse(actual.Modified.replace(' ', 'T').replace(/(\.\d{3})\d*/, '$1')) || null : null,
        xifrat: actual.Encrypted === '+',
        metode: actual.Method || '',
      });
    }
    actual = null;
  };
  for (const l of blocs) {
    if (l === '--' && part === 0) { part = 1; continue; }
    if (l.startsWith('----------')) { part = 2; continue; }
    const m = /^([^=]+?) = (.*)$/.exec(l);
    if (part === 1) { if (m) info[m[1]] = m[2]; continue; }
    if (part === 2) {
      if (!l.trim()) { tanca(); continue; }
      if (m) { if (!actual) actual = {}; actual[m[1]] = m[2]; }
    }
  }
  tanca();
  return { entrades, info };
}

const pwArg = (pw) => '-p' + (pw || PW_BUIT);

async function obre({ fitxers, principal, pw }) {
  await motor();
  desmunta('/a');
  z.FS.mount(z.WORKERFS, { files: fitxers }, '/a');
  arxiu = '/a/' + principal;
  const { codi, sortida } = executa(['l', '-slt', '-sccUTF-8', pwArg(pw), arxiu]);
  if (codi !== 0 && codi !== 1) falla(sortida);
  const r = llegeixLlista(sortida);
  if (!r.info.Type && !r.entrades.length) falla(sortida || 'Cannot open the file as archive');
  return r;
}

function escriuLlista(camins) {
  z.FS.writeFile('/llista.txt', camins.join('\n') + '\n');
  return '@/llista.txt';
}

async function extreu(id, { camins, pw, planes, total }) {
  buida('/o');
  const args = [planes ? 'e' : 'x', '-y', '-bb1', '-bsp0', '-spd', '-scsUTF-8', '-sccUTF-8', '-o/o', pwArg(pw), arxiu];
  if (camins && camins.length) args.push(escriuLlista(camins));
  let fets = 0;
  const { codi, sortida } = executa(args, (l) => {
    if (l.startsWith('- ')) { fets++; if (fets % 5 === 0 || fets === total) postMessage({ id, tipus: 'progres', fets, total, nom: l.slice(2) }); }
  });
  if (codi !== 0) { buida('/o'); falla(sortida); }
  postMessage({ id, tipus: 'progres', fase: 'envia' });
  return enviaArbre(id, '/o');
}

async function prova(id, { pw, total }) {
  let fets = 0;
  const { codi, sortida } = executa(['t', '-bb1', '-bsp0', '-sccUTF-8', pwArg(pw), arxiu], (l) => {
    if (l.startsWith('T ') || l.startsWith('- ')) { fets++; if (fets % 5 === 0) postMessage({ id, tipus: 'progres', fets, total, nom: l.slice(2) }); }
  });
  if (codi === 0) return { ok: true, fets };
  const err = classificaError(sortida);
  if (err === 'pw') falla(sortida);
  return { ok: false, codi: err, errors: sortida.split('\n').filter((l) => /ERROR|Error|CRC|Failed/i.test(l)).slice(0, 20).join('\n').replace(/^! /gm, '') };
}

const TIPUS = { '7z': '7z', zip: 'zip', tar: 'tar', 'tar.gz': 'tar', 'tar.bz2': 'tar', 'tar.xz': 'tar', gz: 'gzip', bz2: 'bzip2', xz: 'xz', wim: 'wim' };
const SEGON = { 'tar.gz': 'gzip', 'tar.bz2': 'bzip2', 'tar.xz': 'xz' };

/** Comprimeix el contingut de `dir` (cwd) amb els elements `noms` de primer nivell. */
function crea(id, dir, noms, { nom, format, nivell, pw, xifraNoms, metodeZip, volum }, total) {
  buida('/r'); buida('/t');
  const tipus = TIPUS[format];
  if (!tipus) throw new ErrorMotor('format');
  const segon = SEGON[format];
  const unSol = ['gzip', 'bzip2', 'xz'].includes(tipus);
  const desti = '/r/' + nom;
  const opcions = ['-y', '-bb1', '-bsp0', '-spd', '-scsUTF-8', '-sccUTF-8'];
  if (tipus !== 'tar') opcions.push('-mx=' + (nivell ?? 5));
  if (pw && (tipus === '7z' || tipus === 'zip')) {
    opcions.push('-p' + pw);
    if (tipus === '7z' && xifraNoms) opcions.push('-mhe=on');
    if (tipus === 'zip') opcions.push('-mem=' + (metodeZip === 'zipcrypto' ? 'ZipCrypto' : 'AES256'));
  }
  if (tipus === 'zip') opcions.push('-mcu=on');
  if (volum && !segon) opcions.push('-v' + Math.max(65536, Math.floor(volum)) + 'b');
  z.FS.chdir(dir);
  let fets = 0;
  const vigila = (l) => { if (l.startsWith('+ ')) { fets++; if (fets % 5 === 0) postMessage({ id, tipus: 'progres', fets, total, nom: l.slice(2) }); } };
  if (unSol && noms.length !== 1) throw new ErrorMotor('unsol');
  let r;
  if (segon) {
    const tar = '/t/' + nom.replace(/\.(gz|bz2|xz)$/i, '');
    r = executa(['a', '-ttar', ...opcions.filter((o) => !o.startsWith('-mx')), tar, escriuLlista(noms)], vigila);
    if (r.codi !== 0) falla(r.sortida);
    postMessage({ id, tipus: 'progres', fase: 'comprimeix' });
    const op2 = ['-y', '-bsp0', '-mx=' + (nivell ?? 5)];
    if (volum) op2.push('-v' + Math.max(65536, Math.floor(volum)) + 'b');
    z.FS.chdir('/t');
    r = executa(['a', '-t' + segon, ...op2, desti, tar.slice(3)]);
    z.FS.unlink(tar);
  } else {
    r = executa(['a', '-t' + tipus, ...opcions, desti, escriuLlista(noms)], vigila);
  }
  z.FS.chdir('/');
  if (r.codi !== 0) { buida('/r'); falla(r.sortida); }
  postMessage({ id, tipus: 'progres', fase: 'envia' });
  return enviaArbre(id, '/r');
}

async function comprimeix(id, op) {
  await motor();
  desmunta('/s');
  // WORKERFS crea les carpetes a partir dels noms amb «/»
  z.FS.mount(z.WORKERFS, { blobs: op.fitxers.map((f) => ({ name: f.cami, data: f.file })) }, '/s');
  const noms = [...new Set(op.fitxers.map((f) => f.cami.split('/')[0]))];
  try { return crea(id, '/s', noms, op, op.fitxers.length); } finally { desmunta('/s'); }
}

async function converteix(id, op) {
  postMessage({ id, tipus: 'progres', fase: 'extreu' });
  buida('/o');
  let r = executa(['x', '-y', '-bsp0', '-sccUTF-8', '-scsUTF-8', '-o/o', pwArg(op.pwOrigen), arxiu]);
  if (r.codi !== 0) { buida('/o'); falla(r.sortida); }
  const noms = z.FS.readdir('/o').filter((n) => n !== '.' && n !== '..');
  if (!noms.length) throw new ErrorMotor('buit');
  postMessage({ id, tipus: 'progres', fase: 'comprimeix' });
  try { r = crea(id, '/o', noms, op, op.total); } finally { buida('/o'); }
  return r;
}

self.onmessage = async (e) => {
  const { id, op } = e.data;
  try {
    let res;
    if (op === 'obre') res = await obre(e.data);
    else if (op === 'extreu') res = await extreu(id, e.data);
    else if (op === 'prova') res = await prova(id, e.data);
    else if (op === 'comprimeix') res = await comprimeix(id, e.data);
    else if (op === 'converteix') res = await converteix(id, e.data);
    else throw new ErrorMotor('op');
    postMessage({ id, tipus: 'fet', res });
  } catch (err) {
    postMessage({ id, tipus: 'error', codi: err.codi || 'altre', detall: err.detall || String(err?.message || err) });
  }
};
postMessage({ tipus: 'llest' });
