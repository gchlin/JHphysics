(function (root) {
  const KEY = 'rdkit-studio-history-v1';
  function cleanRecord(value) {
    const text = (entry, limit) => typeof entry === 'string' && entry.length <= limit;
    if (!value || !text(value.name, 500) || !text(value.input, 2000) || !text(value.smiles, 12000) ||
        !value.smiles.trim() || !Number.isSafeInteger(value.time) || value.time < 0 || value.time > Date.now() + 86400000) return null;
    let source;
    if (value.source) {
      const {label, url} = value.source;
      if (!text(label, 100) || !text(url, 4000)) return null;
      // Stored source URLs are untrusted. Only allow exact service endpoints.
      if (!(label === 'OPSIN' && /^https:\/\/www\.ebi\.ac\.uk\/opsin\/ws\/[^/?#]+\.json$/.test(url)) &&
          !(/^PubChem CID \d+$/.test(label) && /^https:\/\/pubchem\.ncbi\.nlm\.nih\.gov\/compound\/[1-9]\d*$/.test(url) &&
            label === `PubChem CID ${url.split('/').at(-1)}`)) return null;
      source = {label, url};
    }
    return {name:value.name, input:value.input, smiles:value.smiles, time:value.time, ...(source ? {source} : {})};
  }
  function createStore({getStorage = () => localStorage, onStatus = () => {}} = {}) {
    let records = [];
    let storage;
    let message = '';
    function degraded(reason) { message = reason; onStatus(message); }
    try {
      storage = getStorage();
      const raw = storage.getItem(KEY);
      if (raw !== null) {
        if (raw.length > 500000) throw new Error('oversize');
        const data = JSON.parse(raw);
        if (data?.version !== 1 || !Array.isArray(data.records) || data.records.length > 30) throw new Error('schema');
        const seen = new Set();
        records = data.records.map(cleanRecord);
        if (records.some(record => !record)) throw new Error('record');
        records = records.sort((a,b) => b.time - a.time).filter(record => {
          if (seen.has(record.smiles)) return false;
          seen.add(record.smiles); return true;
        });
      }
    } catch {
      storage = null;
      records = [];
      degraded('歷史儲存不可用或資料損壞；目前僅保留本頁記憶體，關閉頁面後不會保留。');
    }
    function save() {
      if (!storage) return;
      try { storage.setItem(KEY, JSON.stringify({version:1, records})); }
      catch {
        storage = null;
        degraded('無法寫入瀏覽器歷史（權限或容量限制）；新變更僅保留本頁記憶體。');
      }
    }
    return {
      list: () => records.map(record => ({...record, ...(record.source ? {source:{...record.source}} : {})})),
      status: () => message,
      add(value) {
        const record = cleanRecord(value);
        if (!record) return false;
        records = [record, ...records.filter(item => item.smiles !== record.smiles)].slice(0,30);
        save(); return true;
      },
      clear() {
        records = [];
        if (storage) {
          try { storage.removeItem(KEY); }
          catch { storage = null; degraded('無法清除瀏覽器內已存歷史；本頁清單已清空，請由瀏覽器網站資料設定清除。'); }
        } else degraded('本頁歷史已清空；瀏覽器儲存不可用，既有磁碟資料可能仍需從網站資料設定清除。');
      }
    };
  }
  const api = {createStore, cleanRecord, KEY};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StructureHistory = api;
})(typeof globalThis === 'object' ? globalThis : this);
