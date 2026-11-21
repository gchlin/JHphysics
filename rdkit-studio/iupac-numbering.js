// API graph ids can differ from both input and processed-SMILES parse indices.
(function(root) {
  'use strict';
  function validate(rdkit, input, data) {
    const paragraph = (data.paragraphs || []).find(p => typeof p === 'string' && /^Processed SMILES:/m.test(p));
    const processed = paragraph?.match(/^Processed SMILES:\s*([^\r\n]+)/m)?.[1]?.trim();
    if (!processed) throw new Error('OpenClatura 未提供處理後 SMILES。');
    const components = data.substituent_tree;
    if (!Array.isArray(components) || components.length !== 1 || components[0]?.kind !== 'component')
      throw new Error('目前僅支援單一母體的 IUPAC 碳編號。');
    const parent = components[0].parent;
    let ids = parent?.atom_ids_by_locant;
    const symbols = parent?.atom_symbols_by_locant;
    if (!ids || !symbols || !Array.isArray(parent.atoms)) throw new Error('OpenClatura 缺少完整母體定位號。');
    let original, mol;
    try {
      original = rdkit.get_mol(input);
      mol = rdkit.get_mol(processed);
      if (!original || !mol || original.get_smiles() !== mol.get_smiles())
        throw new Error('API 回傳的結構或立體組態與輸入不同，已停止編號。');
      const json = JSON.parse(mol.get_json());
      const graph = json.molecules[0];
      const atoms = graph.atoms.map(a => ({...json.defaults?.atom, ...a}));
      // OpenClatura may retain internal graph ids while serializing a reordered
      // processed SMILES. Its explicit atom-id trace supplies the correspondence.
      // Accept it only when it annotates every atom exactly once and reproduces
      // the exact processed string; never infer an ordering from element symbols.
      const trace = paragraph.match(/^Atom ids in that SMILES:\s*([^\r\n]+)/m)?.[1]?.trim();
      let parentAtoms = parent.atoms;
      if (!trace) throw new Error('OpenClatura 未提供完整原子 ID 對照，無法安全編號。');
      {
        const map = new Map(); let position = 0;
        const stripped = trace.replace(/(\[[^\]]+\]|Br|Cl|[BCNOPSFIbcnops*])\{(\d+)\}/g, (_,atom,id) => {
          const key = Number(id);
          if (!Number.isSafeInteger(key) || map.has(key)) throw new Error('OpenClatura 原子 ID 對照重複或無效，已停止編號。');
          map.set(key, position++); return atom;
        });
        if (stripped !== processed || map.size !== atoms.length)
          throw new Error('OpenClatura 原子 ID 對照與處理後 SMILES 不完整或不一致，已停止編號。');
        const remap = id => {
          if (!Number.isInteger(id) || !map.has(id)) throw new Error('OpenClatura 母體包含無法對照的原子 ID，已停止編號。');
          return map.get(id);
        };
        ids = Object.fromEntries(Object.entries(ids).map(([locant,id])=>[locant,remap(id)]));
        parentAtoms = parent.atoms.map(remap);
      }
      const elements = ' X H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.trim().split(' ');
      const entries = Object.entries(ids);
      const used = new Set(), labels = {}, allLabels = {};
      if (!entries.length || entries.length !== parentAtoms.length)
        throw new Error('母體定位號數量不完整。');
      for (const [locant, id] of entries) {
        if (!/^\d+[a-z]?$/.test(locant) || !Number.isInteger(id) || !atoms[id] || used.has(id) || !parentAtoms.includes(id))
          throw new Error('母體定位號或原子索引無效。');
        used.add(id);
        if (symbols[locant] === 'C') {
          if (atoms[id].z !== 6) throw new Error('API 碳定位號指向非碳原子。');
          labels[id] = `C${locant}`;
        } else if (symbols[locant] !== elements[atoms[id].z]) {
          throw new Error(`OpenClatura 母體定位號 ${locant} 的元素 ${symbols[locant]} 與對應原子 ${elements[atoms[id].z]} 不一致，已停止編號。`);
        }
        allLabels[id] = `${symbols[locant]}${locant}`;
      }
      const visited = new Set(), queue = [entries[0][1]];
      while (queue.length) {
        const id = queue.pop();
        if (visited.has(id)) continue;
        visited.add(id);
        for (const bond of graph.bonds) {
          if (bond.atoms.includes(id)) {
            const other = bond.atoms.find(a => a !== id);
            if (used.has(other) && !visited.has(other)) queue.push(other);
          }
        }
      }
      if (visited.size !== used.size) throw new Error('API 母體原子並未形成連通結構。');
      return {smiles:processed, labels, allLabels, parentAtoms:[...used], name:typeof data.name === 'string' ? data.name : ''};
    } finally { original?.delete(); mol?.delete(); }
  }
  function createClient({fetchImpl = (...args) => fetch(...args), timeoutMs = 20000} = {}) {
    const cache = new Map();
    return async function resolve(rdkit, smiles, {signal} = {}) {
      if (signal?.aborted) throw new DOMException('已取消查詢', 'AbortError');
      let identityMol;
      let cacheKey;
      try {
        identityMol = rdkit.get_mol(smiles);
        if (!identityMol) throw new Error('SMILES 無法解析。');
        // Canonical isomeric identity includes charge, isotope and stereo. The
        // cached response retains its own validated processed-index mapping.
        cacheKey = identityMol.get_smiles();
      } finally {identityMol?.delete();}
      if (cache.has(cacheKey)) return cache.get(cacheKey);
      const controller = new AbortController();
      const cancel = () => controller.abort();
      signal?.addEventListener('abort', cancel, {once:true});
      const timer = setTimeout(cancel, timeoutMs);
      try {
        const url = new URL('https://openclatura.org/describe');
        url.searchParams.set('smiles', smiles);
        url.searchParams.set('format', 'json');
        url.searchParams.set('verify', '0');
        const response = await fetchImpl(url.toString(), {signal:controller.signal, mode:'cors', credentials:'omit', headers:{Accept:'application/json'}});
        if (!response.ok) throw new Error(`OpenClatura HTTP ${response.status}`);
        const data = await response.json();
        if (controller.signal.aborted) throw new DOMException('已取消查詢', 'AbortError');
        const result = validate(rdkit, smiles, data);
        if (cache.size >= 30) cache.delete(cache.keys().next().value);
        cache.set(cacheKey, result);
        return result;
      } catch (error) {
        if (signal?.aborted) throw new DOMException('已取消查詢', 'AbortError');
        if (controller.signal.aborted) throw new Error('OpenClatura 查詢逾時。');
        throw error;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', cancel);
      }
    };
  }
  // Match the complete validated molecule back to the drawing's atom order.
  // Never apply response indices directly to a different SMILES ordering.
  function parentInDrawing(rdkit, smiles, result) {
    let target, query;
    try {
      target = rdkit.get_mol(smiles); query = rdkit.get_mol(result.smiles);
      if (!target || !query || target.get_smiles() !== query.get_smiles()) throw new Error('目前結構與母體資料不同。');
      const a = JSON.parse(target.get_json()), b = JSON.parse(query.get_json());
      const tg = a.molecules[0], qg = b.molecules[0];
      const match = JSON.parse(target.get_substruct_match(query, JSON.stringify({useChirality:true})));
      const map = match.atoms;
      if (!Array.isArray(map) || map.length !== qg.atoms.length || map.length !== tg.atoms.length ||
          new Set(map).size !== map.length || qg.bonds.length !== tg.bonds.length)
        throw new Error('無法完整對應目前繪圖的原子順序。');
      qg.atoms.forEach((atom, i) => {
        if (!Number.isInteger(map[i]) || !tg.atoms[map[i]] ||
            (atom.z ?? b.defaults?.atom?.z) !== (tg.atoms[map[i]].z ?? a.defaults?.atom?.z))
          throw new Error('母體原子對應無效。');
        for (const key of ['chg', 'isotope']) {
          if ((atom[key] ?? b.defaults?.atom?.[key] ?? 0) !== (tg.atoms[map[i]][key] ?? a.defaults?.atom?.[key] ?? 0))
            throw new Error('母體原子電荷或同位素對應無效。');
        }
      });
      const bonds = new Map(tg.bonds.map((bond, i) => [bond.atoms.slice().sort((x,y)=>x-y).join(','), {bond,i}]));
      qg.bonds.forEach(bond => {
        const mapped = bonds.get(bond.atoms.map(i=>map[i]).sort((x,y)=>x-y).join(','));
        if (!mapped || (bond.bo ?? b.defaults?.bond?.bo) !== (mapped.bond.bo ?? a.defaults?.bond?.bo))
          throw new Error('母體鍵結對應無效。');
      });
      const atoms = new Set(result.parentAtoms.map(i=>map[i]));
      return {atoms:[...atoms], bonds:tg.bonds.flatMap((bond,i)=>bond.atoms.every(id=>atoms.has(id)) ? [i] : [])};
    } finally {target?.delete(); query?.delete();}
  }
  const api = {validate, createClient, parentInDrawing};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IupacNumbering = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
