const codeInput = document.querySelector('#codeInput');
const structureInput = document.querySelector('#structureInput');
const previewStage = document.querySelector('#previewStage');
const errorBox = document.querySelector('#errorBox');
const renderButton = document.querySelector('#renderButton');
const downloadButton = document.querySelector('#downloadOutput');
const copyButton = document.querySelector('#copyOutput');
let lastSvg = '';
let baseSvg = '';
let lastFormula = '';
let lastSmiles = '';
let lastRenderOptions = null;
let renderSequence = 0;
let rotation = 0;
let flipX = false;
let flipY = false;
let hydrogenMode = 'hetero';
let stereoMode = 'wedge';
let explicitMethyl = false;
let sizeMode = 'height';
let gallery = [];
let selectedSubject = '\u5168\u90e8';
let selectedCategory = '\u5168\u90e8';
let selectedName = '';
let catalog = [];
let catalogConcepts = [];
let exactAliases = new Map();
let foldedFormulaAliases = new Map();
let nameAliases = new Map();
let selectedChoice = null;
const candidateList = document.querySelector('#candidateList');

const snippets = {
  benzene: 'c1ccccc1',
  caffeine: 'Cn1c(=O)c2c(ncn2C)n(C)c1=O',
  adenine: 'Nc1ncnc2[nH]cnc12'
};

function normalizeQuery(value) {
  return String(value || '').normalize('NFKC').trim().replace(/\s+/g, '').replace(/[−–]/g, '-');
}
function addAlias(index, key, compound) {
  if (!key) return;
  const entries = index.get(key) || [];
  if (!entries.some(entry => entry.id === compound.id)) entries.push(compound);
  index.set(key, entries);
}
async function loadCatalog() {
  try {
    const response = await fetch('compound-aliases.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.version !== 1 || !Array.isArray(data.compounds)) throw new Error('對照表格式不正確');
    catalog = data.compounds;
    catalogConcepts = Array.isArray(data.concepts) ? data.concepts : [];
    exactAliases = new Map();
    foldedFormulaAliases = new Map();
    nameAliases = new Map();
    for (const compound of catalog) {
      for (const alias of [compound.formula, ...(compound.condensed || [])]) {
        const key = normalizeQuery(alias);
        addAlias(exactAliases, key, compound);
        if (key.length > 2) addAlias(foldedFormulaAliases, key.toLowerCase(), compound);
      }
      for (const alias of [compound.name, compound.english, ...(compound.names || [])]) {
        addAlias(nameAliases, normalizeQuery(alias).toLowerCase(), compound);
      }
    }
  } catch (error) {
    console.error('本機化合物對照表載入失敗', error);
  }
}
const catalogReady = loadCatalog();

function options() {
  const heightCm = Number(document.querySelector('#heightCm').value);
  const scalePercent = Number(document.querySelector('#scalePercent').value);
  if (sizeMode === 'height' && (!Number.isFinite(heightCm) || heightCm < 1 || heightCm > 30))
    throw new Error('畫布高度請設定為 1 至 30 cm。');
  if (sizeMode === 'bond' && (!Number.isFinite(scalePercent) || scalePercent < 20 || scalePercent > 300))
    throw new Error('鍵長比例請設定為 20% 至 300%。');
  return {
    size_mode: sizeMode,
    height_cm: heightCm,
    scale_percent: scalePercent,
    bond_line_width: Number(document.querySelector('#bondInput').value),
    use_element_colors: document.querySelector('#colorInput').checked,
    transparent_background: document.querySelector('#transparentInput').checked,
    show_hydrogens: hydrogenMode === 'all',
    hydrogen_mode: hydrogenMode,
    use_coordgen: document.querySelector('#coordGenInput').checked,
    rotation,
    flip_x: flipX,
    flip_y: flipY,
    show_carbons: document.querySelector('#carbonInput').checked,
    explicit_methyl: explicitMethyl,
    add_stereo_annotation: stereoMode !== 'wedge',
    stereo_bond_mode: stereoMode,
    add_atom_indices: document.querySelector('#indexInput').checked
  };
}
async function refreshTransform() {
  document.querySelector('#flipHorizontal').setAttribute('aria-pressed', String(flipX));
  document.querySelector('#flipVertical').setAttribute('aria-pressed', String(flipY));
  return lastSvg ? render() : false;
}
function setError(message = '') { errorBox.textContent = message; }
function setStatus(online, text) {
  document.querySelector('#statusDot').className = 'status-dot ' + (online ? 'online' : 'offline');
  document.querySelector('#statusText').textContent = text;
}
function setLoading(loading) {
  renderButton.disabled = loading;
  renderButton.textContent = loading ? '繪製中…' : '繪製';
}
function clearPreview(message = '輸入結構或選擇範例後按下編譯。') {
  lastSvg = '';
  lastFormula = '';
  lastSmiles = '';
  lastRenderOptions = null;
  previewStage.innerHTML = `<div class="empty-state"><strong>等待選擇結構</strong><p>${escapeHTML(message)}</p></div>`;
  document.querySelector('#metaName').textContent = '—';
  document.querySelector('#metaStereo').textContent = '—';
  document.querySelector('#metaFormula').textContent = '—';
  document.querySelector('#metaWeight').textContent = 'MW: —';
  document.querySelector('#metaSize').textContent = '—';
  document.querySelector('#autoSizeHint').textContent = sizeMode === 'height' ? '自動寬度：—' : '畫布：—';
  downloadButton.disabled = true;
  copyButton.disabled = true;
  document.querySelector('#copyFormula').disabled = true;
  document.querySelector('#invertChirality').disabled = true;
}
function escapeHTML(value) {
  return String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
}
function itemCode(item) { return 'from rdkit import Chem\n\nmol = Chem.MolFromSmiles(' + JSON.stringify(item.smiles) + ')'; }
function toast(message) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 1800);
}
async function checkHealth() {
  try {
    const rdkit = await rdkitReady;
    setStatus(true, 'RDKit ' + rdkit.version() + ' ready');
  } catch {
    setStatus(false, 'RDKit 載入失敗');
  }
}
async function resolveCandidates(value) {
  await catalogReady;
  const input = String(value || '').trim();
  const key = normalizeQuery(input);
  if (!key) return [];
  const concept = catalogConcepts.find(item => [item.name, ...(item.aliases || [])]
    .some(alias => normalizeQuery(alias).toLowerCase() === key.toLowerCase()));
  if (concept) throw new Error(concept.message);
  if (selectedChoice?.key === key) return [selectedChoice.compound];
  const records = [
    ...(exactAliases.get(key) || []),
    ...(nameAliases.get(key.toLowerCase()) || [])
  ];
  if (key === key.toLowerCase() && key.length > 2) {
    records.push(...(foldedFormulaAliases.get(key) || []));
  }
  const candidates = [...new Map(records.map(item => [item.id, item])).values()];
  if (!candidates.length) {
    const item = gallery.find(entry =>
      [entry.name, entry.english, entry.smiles].some(label => normalizeQuery(label).toLowerCase() === key.toLowerCase())
    );
    if (item) candidates.push({id:`gallery:${item.smiles}`, name:item.name, smiles:item.smiles});
  }
  if (candidates.length && /^[\x00-\x7F]+$/.test(input)) {
    const rdkit = await rdkitReady;
    const parsed = rdkit.get_mol(input);
    if (parsed) {
      try {
        const parsedSmiles = parsed.get_smiles();
        const same = candidates.some(candidate => {
          const molecule = rdkit.get_mol(candidate.smiles);
          if (!molecule) return false;
          try { return molecule.get_smiles() === parsedSmiles; }
          finally { molecule.delete(); }
        });
        if (!same) candidates.push({id:`smiles:${input}`, name:`依 SMILES 解析：${input}`, smiles:input});
      } finally { parsed.delete(); }
    }
  }
  return candidates.length ? candidates : [{id:`raw:${input}`, name:'自訂分子', smiles:input}];
}
function needsFormulaConfirmation(value) {
  const key = normalizeQuery(value);
  if (selectedChoice?.key === key) return false;
  const exact = exactAliases.get(key) || [];
  if (exact.some(item => item.formula === key)) return true;
  return key === key.toLowerCase() && key.length > 2 &&
    (foldedFormulaAliases.get(key) || []).some(item => item.formula.toLowerCase() === key);
}
async function showCandidates(candidates, sequence) {
  const images = await Promise.all(candidates.map(async candidate => {
    try {
      return (await drawMolecule(candidate.smiles, {width:160, height:110, transparent_background:true, use_element_colors:true})).svg;
    } catch { return ''; }
  }));
  if (sequence !== renderSequence) return;
  candidateList.innerHTML = `<strong>${candidates.length > 1 ? '找到多個可能結構，請選擇一個' : '找到一筆已收錄結構，請確認'}</strong>` +
    '<p>以下列出本機已收錄或可由 SMILES 解析的候選；同分子式可能還有其他異構物。</p>' +
    candidates.map((candidate, index) =>
      `<button type="button" class="candidate-card" data-candidate="${index}">` +
      `<span class="candidate-image">${images[index]}</span>` +
      `<span><b>${escapeHTML(candidate.name)}</b><small>${escapeHTML(candidate.smiles)}</small></span></button>`
    ).join('');
  candidateList.hidden = false;
  candidateList._candidates = candidates;
}
function stereoLabel(tags) {
  const values = [...(tags.CIP_atoms || []), ...(tags.CIP_bonds || [])]
    .map(item => item.at(-1)).filter(value => typeof value === 'string')
    .map(value => value.replace(/^\((.*)\)$/, '$1'));
  return values.length ? [...new Set(values)].join(' · ') : '無指定';
}
function formulaMarkup(formula) {
  return escapeHTML(formula).replace(/(\d+)/g, '<sub>$1</sub>');
}
function formulaMathML(formula) {
  const source = String(formula || '');
  const parts = [];
  let index = 0;
  while (index < source.length) {
    const atom = /^([A-Z][a-z]?)(\d*)/.exec(source.slice(index));
    if (atom) {
      const symbol = `<mtext>${atom[1]}</mtext>`;
      parts.push(atom[2] ? `<msub>${symbol}<mn>${atom[2]}</mn></msub>` : symbol);
      index += atom[0].length;
      continue;
    }
    const character = source[index];
    if ((character === '+' || character === '-') && index === source.length - 1) {
      parts.push(`<msup><mrow></mrow><mo>${character}</mo></msup>`);
    } else {
      parts.push(`<mtext>${escapeHTML(character)}</mtext>`);
    }
    index += 1;
  }
  return `<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow>${parts.join('')}</mrow></math>`;
}
function invertedSmiles(smiles) {
  let count = 0;
  const inverted = smiles.replace(/\[([^\]]+)\]/g, (bracket, contents) => {
    if (!contents.includes('@')) return bracket;
    if (/@(?:TH|AL|SP|TB|OH)\d/i.test(contents)) throw new Error('目前只支援反轉一般四面體手性中心。');
    const changed = contents.replace(/@@?/g, mark => {
      count += 1;
      return mark === '@' ? '@@' : '@';
    });
    return `[${changed}]`;
  });
  if (!count) throw new Error('這個結構沒有可反轉的 R/S 手性中心。');
  return inverted;
}
function invertedName(name) {
  return name.replace(/^\((R|S)\)/, (_, sense) => sense === 'R' ? '(S)' : '(R)')
    .replace(/^([LD])-/, (_, sense) => sense === 'L' ? 'D-' : 'L-');
}
async function render() {
  const sequence = ++renderSequence;
  setError('');
  setLoading(true);
  try {
    if (!structureInput.value.trim()) throw new Error('\u8acb\u5148\u8f38\u5165\u5316\u5b78\u5f0f\u6216\u4fd7\u540d');
    const candidates = await resolveCandidates(structureInput.value);
    if (sequence !== renderSequence) return false;
    if (candidates.length > 1 || needsFormulaConfirmation(structureInput.value)) {
      clearPreview('請從左側候選結構選擇一個。');
      await showCandidates(candidates, sequence);
      return false;
    }
    candidateList.hidden = true;
    candidateList.innerHTML = '';
    const candidate = candidates[0];
    const structure = candidate.smiles;
    codeInput.value = itemCode({smiles: structure});
    let data;
    try { data = await drawMolecule(structure, options()); }
    catch (error) {
      if (candidate.id.startsWith('raw:') && /SMILES 無法解析/.test(error.message)) {
        throw new Error(`本機對照表未收錄「${structureInput.value.trim()}」，且無法當作 SMILES 解析；請選擇範例或輸入有效 SMILES。`);
      }
      throw error;
    }
    if (sequence !== renderSequence) return false;
    baseSvg = data.svg;
    lastSvg = baseSvg;
    lastFormula = data.formula || data.smiles;
    lastSmiles = structure;
    lastRenderOptions = data.options;
    previewStage.innerHTML = lastSvg;
    previewStage.classList.toggle('transparent', data.options.transparent_background);
    document.querySelector('#flipHorizontal').setAttribute('aria-pressed', String(flipX));
    document.querySelector('#flipVertical').setAttribute('aria-pressed', String(flipY));
    const galleryName = gallery.find(entry => entry.smiles === structure)?.name;
    document.querySelector('#metaName').textContent = selectedName || (candidate.id.startsWith('raw:') ? '' : candidate.name) || galleryName || '自訂分子';
    document.querySelector('#metaStereo').textContent = stereoLabel(data.stereo_tags);
    document.querySelector('#metaFormula').innerHTML = formulaMarkup(data.formula);
    document.querySelector('#metaWeight').textContent = Number.isFinite(data.molecular_weight)
      ? `MW: ${data.molecular_weight.toFixed(2)} g/mol` : 'MW: —';
    document.querySelector('#metaSize').textContent = `${data.options.width_cm.toFixed(2)} × ${data.options.height_cm.toFixed(2)} cm`;
    document.querySelector('#autoSizeHint').textContent = sizeMode === 'height'
      ? `自動寬度：約 ${data.options.width_cm.toFixed(2)} cm`
      : `畫布：約 ${data.options.width_cm.toFixed(2)} × ${data.options.height_cm.toFixed(2)} cm`;
    downloadButton.disabled = false;
    copyButton.disabled = false;
    document.querySelector('#copyFormula').disabled = false;
    document.querySelector('#invertChirality').disabled = !(data.stereo_tags.CIP_atoms?.length && /\[[^\]]*@@?[^\]]*\]/.test(structure));
    return true;
  } catch (error) {
    if (sequence === renderSequence) {
      clearPreview('請修正輸入後再編譯。');
      setError(error.message);
    }
    return false;
  } finally {
    if (sequence === renderSequence) setLoading(false);
  }
}
function loadCode(structure, name = '') { selectedChoice = null; selectedName = name; structureInput.value = structure; render(); }
function safeFilename(value, extension) {
  return String(value).replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '') + '.' + extension;
}
function svgForExport() {
  const doc = new DOMParser().parseFromString(lastSvg, 'image/svg+xml');
  const root = doc.documentElement;
  root.setAttribute('width', `${lastRenderOptions.width_cm.toFixed(2)}cm`);
  root.setAttribute('height', `${lastRenderOptions.height_cm.toFixed(2)}cm`);
  return new XMLSerializer().serializeToString(root);
}
async function pngClipboardItem(blob) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('無法準備圖片剪貼簿。'));
    reader.readAsDataURL(blob);
  });
  const widthCm = lastRenderOptions.width_cm.toFixed(2);
  const heightCm = lastRenderOptions.height_cm.toFixed(2);
  // Office may choose HTML when PNG clipboard metadata is removed by the browser.
  // Pixel attributes are a 96-DPI fallback if the destination ignores CSS cm units.
  const widthPx = Math.round(lastRenderOptions.width_cm / 2.54 * 96);
  const heightPx = Math.round(lastRenderOptions.height_cm / 2.54 * 96);
  const html = `<html><body><!--StartFragment--><img src="${dataUrl}" width="${widthPx}" height="${heightPx}" style="width:${widthCm}cm;height:${heightCm}cm" alt="化學結構圖"><!--EndFragment--></body></html>`;
  return new ClipboardItem({
    'text/html': new Blob([html], {type:'text/html'}),
    'image/png': blob
  });
}
let styleTimer = null;
function scheduleStyleRender() {
  clearTimeout(styleTimer);
  downloadButton.disabled = true;
  copyButton.disabled = true;
  styleTimer = setTimeout(render, 80);
}
const thumbnailCache = new Map();
let thumbnailObserver = null;
let thumbnailQueue = Promise.resolve();
function hydrateThumbnails(root) {
  if (thumbnailObserver) thumbnailObserver.disconnect();
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const node = entry.target;
      observer.unobserve(node);
      thumbnailQueue = thumbnailQueue.then(async () => {
        if (!node.isConnected) return;
        const smiles = node.dataset.thumbSmiles;
        try {
          if (!thumbnailCache.has(smiles)) {
            const data = await drawMolecule(smiles, {width:220, height:150, transparent_background:true, use_element_colors:true});
            thumbnailCache.set(smiles, data.svg);
          }
          if (node.isConnected) node.innerHTML = thumbnailCache.get(smiles);
        } catch { /* keep text fallback */ }
      });
    }
  }, {root:document.querySelector('#galleryView'), rootMargin:'80px'});
  thumbnailObserver = observer;
  root.querySelectorAll('[data-thumb-smiles]').forEach(node => thumbnailObserver.observe(node));
}
function renderGallery() {
  const visible = gallery.filter(item =>
    (selectedSubject === '\u5168\u90e8' || item.subject === selectedSubject) &&
    (selectedCategory === '\u5168\u90e8' || item.category === selectedCategory)
  );
  document.querySelector('#galleryGrid').innerHTML = visible.map(item => {
    const image = item.file
      ? '<img src="' + escapeHTML(item.file) + '" alt="' + escapeHTML(item.name) + '" loading="lazy">'
      : '<div class="generated-thumb" data-thumb-smiles="' + escapeHTML(item.smiles) + '"><span>' + escapeHTML(item.name) + '</span><small>圖形預覽</small></div>';
    return '<article class="gallery-card" data-smiles="' + escapeHTML(item.smiles) + '">' +
      '<div class="gallery-image">' + image + '</div>' +
      '<div class="card-topline"><div><div class="gallery-name">' + escapeHTML(item.name) + '</div><div class="gallery-en">' + escapeHTML(item.english) + '</div></div></div>' +
      '<div class="card-meta"><span>' + escapeHTML(item.subject) + '</span><span>' + escapeHTML(item.category) + '</span></div>' +
      '</article>';
  }).join('');
  hydrateThumbnails(document.querySelector('#galleryGrid'));
  document.querySelectorAll('.gallery-card').forEach(card => card.addEventListener('click', event => {
    const item = gallery.find(entry => entry.smiles === card.dataset.smiles);
    if (item) {
      closeDrawer();
      loadCode(item.smiles, item.name);
    }
  }));

}
function renderCategoryFilter() {
  const categories = ['\u5168\u90e8', ...new Set(
    gallery.filter(item => selectedSubject === '\u5168\u90e8' || item.subject === selectedSubject).map(item => item.category)
  )];
  if (!categories.includes(selectedCategory)) selectedCategory = '\u5168\u90e8';
  document.querySelector('#categoryFilter').innerHTML = categories.map(category =>
    '<button class="filter-button ' + (category === selectedCategory ? 'active' : '') + '" data-category="' + escapeHTML(category) + '">' +
    escapeHTML(category) + '</button>'
  ).join('');
  document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => {
    selectedCategory = button.dataset.category;
    renderCategoryFilter();
    renderGallery();
  }));
}

async function loadGallery() {
  try {
    const response = await fetch('gallery.json', {cache:'no-store'});
    if (!response.ok) throw new Error('gallery fetch failed');
    const data = await response.json();
    gallery = Array.isArray(data) ? data : [];
    renderCategoryFilter();
    renderGallery();
  } catch (error) {
    gallery = [];
    document.querySelector('#categoryFilter').innerHTML = '';
    document.querySelector('#galleryGrid').innerHTML = '<div class="empty-state gallery-empty"><strong>範例庫載入失敗</strong><p>請重新開啟範例庫。</p></div>';
    console.error(error);
  }
}

document.querySelector('#renderButton').addEventListener('click', render);
candidateList.addEventListener('click', event => {
  const button = event.target.closest('[data-candidate]');
  if (!button) return;
  const compound = candidateList._candidates?.[Number(button.dataset.candidate)];
  if (!compound) return;
  selectedChoice = {key:normalizeQuery(structureInput.value), compound};
  selectedName = compound.id.startsWith('smiles:') ? '' : compound.name;
  render();
});
structureInput.addEventListener('input', () => {
  selectedChoice = null;
  selectedName = '';
  candidateList.hidden = true;
  downloadButton.disabled = true;
  copyButton.disabled = true;
  document.querySelector('#copyFormula').disabled = true;
  document.querySelector('#invertChirality').disabled = true;
});
structureInput.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    render();
  }
});
document.querySelector('#bondInput').addEventListener('input', event => {
  document.querySelector('#bondOutput').textContent = Number(event.target.value).toFixed(1);
});
document.querySelectorAll('[data-bond]').forEach(button => button.addEventListener('click', () => {
  document.querySelector('#bondInput').value = button.dataset.bond;
  document.querySelectorAll('[data-bond]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  scheduleStyleRender();
}));
document.querySelectorAll('.style-strip input:not([type=hidden])').forEach(control => control.addEventListener('input', scheduleStyleRender));
document.querySelector('#transparentInput').addEventListener('input', scheduleStyleRender);
document.querySelectorAll('[data-background]').forEach(button => button.addEventListener('click', () => {
  document.querySelector('#transparentInput').checked = button.dataset.background === 'transparent';
  document.querySelectorAll('[data-background]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  scheduleStyleRender();
}));
document.querySelectorAll('[data-size-mode]').forEach(button => button.addEventListener('click', () => {
  sizeMode = button.dataset.sizeMode;
  document.querySelectorAll('[data-size-mode]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  document.querySelector('#heightControls').hidden = sizeMode !== 'height';
  document.querySelector('#bondControls').hidden = sizeMode !== 'bond';
  document.querySelector('#autoSizeHint').textContent = sizeMode === 'height' ? '自動寬度：—' : '畫布：—';
  if (lastSmiles) scheduleStyleRender();
}));
for (const [attribute, inputId] of [['height', 'heightCm'], ['scale', 'scalePercent']]) {
  const input = document.querySelector(`#${inputId}`);
  const buttons = document.querySelectorAll(`[data-${attribute}]`);
  input.addEventListener('input', () => {
    buttons.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset[attribute]) === Number(input.value))));
    if (lastSmiles) scheduleStyleRender();
  });
  buttons.forEach(button => button.addEventListener('click', () => {
    input.value = button.dataset[attribute];
    buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    if (lastSmiles) scheduleStyleRender();
  }));
}
document.querySelectorAll('.quick-row button[data-code]').forEach(button => button.addEventListener('click', () => loadCode(snippets[button.dataset.code])));
document.querySelectorAll('button[data-smiles]').forEach(button => button.addEventListener('click', () => loadCode(button.dataset.smiles, button.dataset.label)));
document.querySelectorAll('[data-color]').forEach(button => button.addEventListener('click', () => {
  const color = button.dataset.color === 'color';
  document.querySelector('#colorInput').checked = color;
  document.querySelectorAll('[data-color]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  scheduleStyleRender();
}));
document.querySelectorAll('[data-hydrogens]').forEach(button => button.addEventListener('click', () => {
  hydrogenMode = button.dataset.hydrogens;
  document.querySelectorAll('[data-hydrogens]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  scheduleStyleRender();
}));
document.querySelectorAll('[data-carbons]').forEach(button => button.addEventListener('click', () => {
  document.querySelector('#carbonInput').checked = button.dataset.carbons === 'show';
  document.querySelectorAll('[data-carbons]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  scheduleStyleRender();
}));
document.querySelectorAll('[data-stereo]').forEach(button => button.addEventListener('click', () => {
  stereoMode = button.dataset.stereo;
  document.querySelectorAll('[data-stereo]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  scheduleStyleRender();
}));
document.querySelectorAll('[data-methyl]').forEach(button => button.addEventListener('click', () => {
  explicitMethyl = button.dataset.methyl === 'explicit';
  document.querySelectorAll('[data-methyl]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  scheduleStyleRender();
}));
document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => {
  const preset = button.dataset.preset;
  document.querySelector('#bondInput').value = preset === 'standard' ? '1.4' : '2.0';
  document.querySelector('#bondOutput').textContent = Number(document.querySelector('#bondInput').value).toFixed(1);
  document.querySelectorAll('[data-bond]').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.bond === document.querySelector('#bondInput').value)));
  document.querySelector('#colorInput').checked = preset === 'standard';
  document.querySelector('#carbonInput').checked = preset === 'teaching';
  document.querySelectorAll('[data-carbons]').forEach(item => item.setAttribute('aria-pressed', String((item.dataset.carbons === 'show') === document.querySelector('#carbonInput').checked)));
  document.querySelectorAll('[data-color]').forEach(item => item.setAttribute('aria-pressed', String((item.dataset.color === 'color') === document.querySelector('#colorInput').checked)));
  document.querySelectorAll('[data-preset]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  scheduleStyleRender();
}));
document.querySelector('#rotateLeft').addEventListener('click', () => { rotation = (rotation + 270) % 360; refreshTransform(); });
document.querySelector('#rotateRight').addEventListener('click', () => { rotation = (rotation + 90) % 360; refreshTransform(); });
document.querySelector('#flipHorizontal').addEventListener('click', async () => {
  flipX = !flipX;
  if (await refreshTransform()) toast(flipX ? '已水平翻轉；已驗證分子組態不變。' : '已取消水平翻轉。');
});
document.querySelector('#flipVertical').addEventListener('click', async () => {
  flipY = !flipY;
  if (await refreshTransform()) toast(flipY ? '已垂直翻轉；已驗證分子組態不變。' : '已取消垂直翻轉。');
});
document.querySelector('#resetTransform').addEventListener('click', () => { rotation = 0; flipX = false; flipY = false; render(); });
document.querySelector('#invertChirality').addEventListener('click', async () => {
  try {
    const before = lastSmiles;
    const next = invertedSmiles(before);
    const rdkit = await rdkitReady;
    const original = rdkit.get_mol(before);
    const mol = rdkit.get_mol(next);
    if (!original || !mol) {
      original?.delete();
      mol?.delete();
      throw new Error('反轉後的結構無法解析。');
    }
    try {
      const originalTags = JSON.parse(original.get_stereo_tags());
      const tags = JSON.parse(mol.get_stereo_tags());
      const beforeAtoms = new Map((originalTags.CIP_atoms || []).map(([index, sense]) => [index, sense]));
      const afterAtoms = new Map((tags.CIP_atoms || []).map(([index, sense]) => [index, sense]));
      if (!beforeAtoms.size || beforeAtoms.size !== afterAtoms.size ||
          [...beforeAtoms].some(([index, sense]) => afterAtoms.get(index) !== (sense === '(R)' ? '(S)' : sense === '(S)' ? '(R)' : null)) ||
          JSON.stringify(originalTags.CIP_bonds || []) !== JSON.stringify(tags.CIP_bonds || [])) {
        throw new Error('無法確認所有 R/S 皆已反轉且 E/Z 保持不變，已停止操作。');
      }
    } finally { original.delete(); mol.delete(); }
    selectedName = invertedName(selectedName);
    structureInput.value = next;
    if (await render()) toast('已產生對映異構物；R/S 手性中心已反轉，E/Z 保持不變。');
  } catch (error) { setError(error.message); }
});
document.querySelector('#copyFormula').addEventListener('click', async () => {
  if (!lastFormula) return;
  const mathml = formulaMathML(lastFormula);
  try {
    const html = `<html><body><!--StartFragment-->${mathml}<!--EndFragment--></body></html>`;
    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([html], {type: 'text/html'}),
      'text/plain': new Blob([mathml], {type: 'text/plain'})
    })]);
    toast('Word 公式已複製，可直接貼上');
  } catch {
    try { await navigator.clipboard.writeText(mathml); toast('Word 公式已複製，可直接貼上'); }
    catch { toast('瀏覽器無法複製公式'); }
  }
});
let outputFormat = 'png';
function updateFormatLabels() {
  const png = outputFormat === 'png';
  copyButton.textContent = '⧉';
  copyButton.title = png ? '複製 PNG（包含文件尺寸）' : '複製 SVG 原始碼';
  copyButton.setAttribute('aria-label', copyButton.title);
  downloadButton.textContent = '↓ 下載';
  downloadButton.title = png ? '下載 PNG' : '下載 SVG';
  downloadButton.setAttribute('aria-label', downloadButton.title);
}
document.querySelectorAll('[data-format]').forEach(button => button.addEventListener('click', () => {
  outputFormat = button.dataset.format;
  document.querySelectorAll('[data-format]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  document.querySelectorAll('[data-dpi]').forEach(item => { item.disabled = outputFormat !== 'png'; });
  updateFormatLabels();
}));
document.querySelectorAll('[data-dpi]').forEach(button => button.addEventListener('click', () => {
  document.querySelector('#dpiInput').value = button.dataset.dpi;
  document.querySelectorAll('[data-dpi]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
}));
downloadButton.addEventListener('click', async () => {
  if (!lastSvg) return;
  const format = outputFormat;
  const smiles = lastFormula;
  if (format === 'svg') {
    const blob = new Blob([svgForExport()], {type:'image/svg+xml'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = safeFilename(lastFormula || smiles, 'svg');
    link.click();
    URL.revokeObjectURL(link.href);
    return;
  }
  let blob;
  try { blob = await svgToPng(svgForExport(), lastRenderOptions.width_cm, lastRenderOptions.height_cm, Number(document.querySelector('#dpiInput').value)); }
  catch (error) { toast(error.message || '無法產生 PNG'); return; }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = safeFilename(lastFormula || smiles, 'png');
  link.click();
  URL.revokeObjectURL(link.href);
});
copyButton.addEventListener('click', async () => {
  if (!lastSvg) return;
  const format = outputFormat;
  if (format === 'svg') {
    try {
      await navigator.clipboard.writeText(svgForExport());
      toast('SVG \u539f\u59cb\u78bc\u5df2\u8907\u88fd');
    } catch {
      toast('\u700f\u89bd\u5668\u4e0d\u652f\u63f4 SVG \u526a\u8cbc');
    }
    return;
  }
  try {
    const blob = await svgToPng(svgForExport(), lastRenderOptions.width_cm, lastRenderOptions.height_cm, Number(document.querySelector('#dpiInput').value));
    await navigator.clipboard.write([await pngClipboardItem(blob)]);
    toast(`已複製 ${lastRenderOptions.width_cm.toFixed(2)} × ${lastRenderOptions.height_cm.toFixed(2)} cm 圖片`);
  } catch (error) {
    toast(error.message || '瀏覽器不支援 PNG 剪貼');
  }
});
function changeSubject(event) {
  const button = event.target.closest('[data-subject]');
  if (!button) return;
  selectedSubject = button.dataset.subject;
  selectedCategory = '\u5168\u90e8';
  document.querySelectorAll('[data-subject]').forEach(item => item.classList.toggle('active', item.dataset.subject === selectedSubject));
  renderCategoryFilter();
  renderGallery();
}
document.querySelector('#drawerSubjectTabs').addEventListener('click', changeSubject);
const drawer = document.querySelector('#galleryDrawer');
const backdrop = document.querySelector('#drawerBackdrop');
const galleryView = document.querySelector('#galleryView');
const drawerTitle = document.querySelector('#drawerTitle');
function closeDrawer() {
  drawer.classList.remove('open');
  backdrop.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('drawer-open');
}
function openDrawer() {
  renderCategoryFilter();
  renderGallery();
  drawer.classList.add('open');
  backdrop.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('drawer-open');
}
document.querySelector('#openGallery').addEventListener('click', openDrawer);
document.querySelector('#closeGallery').addEventListener('click', closeDrawer);
backdrop.addEventListener('click', closeDrawer);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && drawer.classList.contains('open')) closeDrawer();
});
const smilesHelpButton = document.querySelector('#smilesHelpButton');
const smilesHelpPanel = document.querySelector('#smilesHelpPanel');
function closeSmilesHelp() {
  smilesHelpPanel.hidden = true;
  smilesHelpButton.setAttribute('aria-expanded', 'false');
}
smilesHelpButton.addEventListener('click', () => {
  smilesHelpPanel.hidden = !smilesHelpPanel.hidden;
  smilesHelpButton.setAttribute('aria-expanded', String(!smilesHelpPanel.hidden));
});
document.querySelector('#closeSmilesHelp').addEventListener('click', closeSmilesHelp);
document.querySelector('#copySmilesPrompt').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(document.querySelector('#smilesPromptText').value);
    toast('提示詞已複製');
    closeSmilesHelp();
  } catch { toast('無法複製，請選取提示詞後手動複製'); }
});
document.addEventListener('pointerdown', event => {
  if (!smilesHelpPanel.hidden && !smilesHelpPanel.contains(event.target) && event.target !== smilesHelpButton) closeSmilesHelp();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !smilesHelpPanel.hidden) closeSmilesHelp();
});

structureInput.value = '';
document.querySelector('#dpiInput').value = '300';
updateFormatLabels();
checkHealth();
loadGallery();
