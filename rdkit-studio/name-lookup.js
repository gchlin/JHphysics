// Public name services only; no keys, proxy, or executable response content.
(function (root) {
  const elements = new Set(('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og').split(' '));
  function isFormula(value) {
    const input = value.normalize('NFKC').trim();
    if (!/\d/.test(input)) return false;
    const tokens = input.match(/[A-Z][a-z]?\d*/g);
    return !!tokens && tokens.join('') === input && tokens.every(token => {
      const [, symbol, count] = /^([A-Z][a-z]?)(\d*)$/.exec(token);
      return elements.has(symbol) && (!count || /^[1-9]\d*$/.test(count));
    });
  }
  function failure(code, service, message) {
    const error = new Error(`${service}：${message}`);
    error.code = code;
    error.service = service;
    error.needsNameHelp = true;
    return error;
  }
  function abortError() { const error = new Error('查詢已取消'); error.name = 'AbortError'; return error; }
  function createResolver({fetchImpl = (...args) => fetch(...args), validateSmiles,
    timeoutMs = 8000, maxCache = 50, maxCandidates = 8, pubchemGapMs = 250} = {}) {
    const cache = new Map();
    let lastPubchemStart = 0;
    async function request(url, service, signal) {
      if (signal?.aborted) throw abortError();
      // Do not retry; space submissions as well as normal sequential fallback.
      if (service === 'PubChem') {
        const delay = Math.max(0, lastPubchemStart + pubchemGapMs - Date.now());
        if (delay) await new Promise((resolve, reject) => {
          const cancel = () => { clearTimeout(timer); reject(abortError()); };
          const timer = setTimeout(() => { signal?.removeEventListener('abort', cancel); resolve(); }, delay);
          signal?.addEventListener('abort', cancel, {once: true});
        });
        if (signal?.aborted) throw abortError();
        lastPubchemStart = Date.now();
      }
      const controller = new AbortController();
      const cancel = () => controller.abort();
      signal?.addEventListener('abort', cancel, {once: true});
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
      try {
        const response = await fetchImpl(url, {signal: controller.signal, mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer'});
        if (response.status === 404) throw failure('not-found', service, '未找到可用結構');
        if (response.status === 429 || response.status === 503)
          throw failure('busy', service, `服務忙碌或限流（HTTP ${response.status}），請稍後再試`);
        if (!response.ok) throw failure('http', service, `服務暫時無法查詢（HTTP ${response.status}）`);
        try { return await response.json(); }
        catch (error) {
          if (controller.signal.aborted) throw error;
          throw failure('invalid-payload', service, '回傳內容不是有效 JSON');
        }
      } catch (error) {
        if (signal?.aborted) throw abortError();
        if (timedOut) throw failure('timeout', service, '查詢逾時，請稍後再試');
        if (error.code) throw error;
        throw failure('network', service, '網路或跨來源連線失敗，請稍後再試');
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', cancel);
      }
    }
    function candidate(smiles, fields) {
      let valid = false;
      try { valid = typeof smiles === 'string' && !!smiles.trim() && smiles.length <= 12000 && validateSmiles(smiles); }
      catch { /* Treat parser exceptions as unusable remote data. */ }
      if (!valid)
        throw failure('invalid-payload', fields.source.label, '回傳的 SMILES 無法由本機 RDKit 解析，已停止使用');
      return {...fields, smiles};
    }
    async function lookup(name, {signal, onProgress = () => {}, onResolved = () => {}} = {}) {
      const query = name.trim(); // Preserve internal spaces and case sent to services.
      if (signal?.aborted) throw abortError();
      if (cache.has(query)) {
        const result = cache.get(query);
        cache.delete(query); cache.set(query, result);
        onResolved({cached:true});
        return result;
      }
      const errors = [];
      let result;
      onProgress('正在查詢 OPSIN…');
      try {
        const url = `https://www.ebi.ac.uk/opsin/ws/${encodeURIComponent(query)}.json`;
        const data = await request(url, 'OPSIN', signal);
        if (data?.status === 'FAILURE') throw failure('not-found', 'OPSIN', '未找到可用結構');
        if (!['SUCCESS', 'WARNING'].includes(data?.status)) throw failure('invalid-payload', 'OPSIN', '回傳狀態不正確');
        const item = candidate(data.smiles, {id:`opsin:${query}`, name:query,
          source:{label:'OPSIN', url}, requiresConfirmation:data.status === 'WARNING',
          warning:data.status === 'WARNING' ? String(data.message || '服務回報警告，請先核對結構') : ''});
        result = [item];
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        errors.push(error);
      }
      if (!result) {
        onProgress('正在查詢 PubChem…');
        try {
          const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(query)}/property/SMILES,IUPACName,MolecularFormula/JSON`;
          const data = await request(url, 'PubChem', signal);
          const rows = data?.PropertyTable?.Properties;
          if (!Array.isArray(rows) || !rows.length) throw failure('invalid-payload', 'PubChem', '未回傳結構資料');
          result = rows.slice(0, maxCandidates).map(row => {
            if (!Number.isSafeInteger(row.CID) || row.CID <= 0 || typeof row.IUPACName !== 'string' || typeof row.MolecularFormula !== 'string')
              throw failure('invalid-payload', 'PubChem', '回傳欄位不完整');
            // SMILES includes stereochemistry. Never fall back to ConnectivitySMILES.
            return candidate(row.SMILES, {id:`pubchem:${row.CID}`, name:row.IUPACName,
              formula:row.MolecularFormula, source:{label:`PubChem CID ${row.CID}`, url:`https://pubchem.ncbi.nlm.nih.gov/compound/${row.CID}`},
              requiresConfirmation:true, warning:rows.length > maxCandidates ? `僅列出前 ${maxCandidates} 筆結果；請核對具體名稱` : ''});
          });
        } catch (error) {
          if (error.name === 'AbortError') throw error;
          errors.push(error);
        }
      }
      if (signal?.aborted) throw abortError();
      if (!result) {
        const error = failure(errors.every(item => item.code === 'not-found') ? 'not-found' : 'lookup-failed',
          '名稱查詢', errors.map(item => item.message).join('；'));
        error.causes = errors;
        throw error;
      }
      cache.set(query, result);
      while (cache.size > maxCache) cache.delete(cache.keys().next().value);
      onResolved({cached:false});
      return result;
    }
    return {lookup};
  }
  const api = {createResolver, isFormula};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NameLookup = api;
})(typeof globalThis === 'object' ? globalThis : this);
