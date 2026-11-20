// Armazenamento local (IndexedDB). Tudo fica no dispositivo; nada é enviado a servidores.
const DB_NAME = 'studio-karina';
const DB_VERSION = 2;
export const STORES = ['projects', 'docs', 'posts', 'refs', 'texts', 'assets', 'phrases'];
let dbp;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((ok, no) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      for (const s of STORES) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, { keyPath: 'id' });
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  });
  return dbp;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((ok, no) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    Promise.resolve(fn(s)).then((v) => { out = v; });
    t.oncomplete = () => ok(out);
    t.onerror = () => no(t.error);
    t.onabort = () => no(t.error);
  });
}
const req = (r) => new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });

export const db = {
  async all(store) {
    const list = await tx(store, 'readonly', (s) => req(s.getAll()));
    return (list || []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  },
  get: (store, id) => tx(store, 'readonly', (s) => req(s.get(id))),
  async put(store, obj, { touch = true } = {}) {
    if (touch) obj.updatedAt = Date.now();
    if (!obj.createdAt) obj.createdAt = Date.now();
    await tx(store, 'readwrite', (s) => req(s.put(obj)));
    return obj;
  },
  del: (store, id) => tx(store, 'readwrite', (s) => req(s.delete(id))),
  clear: (store) => tx(store, 'readwrite', (s) => req(s.clear())),
};

// Preferências (pequenas) em localStorage
const PREF_KEY = 'studio-karina:prefs';
const DEFAULT_PREFS = { lang: 'pt', theme: 'auto', signature: 'Karina Ximenes | Psicóloga', aiEndpoint: '', aiCode: '', onboarded: false, name: 'Karina' };
export const prefs = {
  get() { try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') }; } catch { return { ...DEFAULT_PREFS }; } },
  set(patch) { const p = { ...prefs.get(), ...patch }; localStorage.setItem(PREF_KEY, JSON.stringify(p)); return p; },
  reset() { localStorage.removeItem(PREF_KEY); },
};

// Backup completo (exportação de dados — LGPD: portabilidade)
const blobToDataURL = (b) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); });
export async function exportAll() {
  const out = { app: 'studio-karina-ximenes', version: 2, exportedAt: new Date().toISOString(), prefs: { ...prefs.get(), aiCode: '' } };
  for (const s of STORES) {
    const list = await db.all(s);
    if (s === 'assets') out[s] = await Promise.all(list.map(async (a) => ({ ...a, blob: undefined, dataURL: a.blob ? await blobToDataURL(a.blob) : null })));
    else out[s] = list;
  }
  return out;
}
export async function importAll(data) {
  if (!data || data.app !== 'studio-karina-ximenes') throw new Error('Arquivo de backup inválido');
  for (const s of STORES) {
    for (const item of data[s] || []) {
      if (s === 'assets' && item.dataURL) { item.blob = await (await fetch(item.dataURL)).blob(); delete item.dataURL; }
      await db.put(s, item, { touch: false });
    }
  }
  if (data.prefs) prefs.set({ ...data.prefs, aiCode: prefs.get().aiCode });
}
export async function wipeAll() { for (const s of STORES) await db.clear(s); prefs.reset(); }
