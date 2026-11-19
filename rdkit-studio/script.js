const codeInput = document.querySelector('#codeInput');
const structureInput = document.querySelector('#structureInput');
const previewStage = document.querySelector('#previewStage');
const errorBox = document.querySelector('#errorBox');
const unknownNamePromptButton = document.querySelector('#copyUnknownNamePrompt');
const structureNotice = document.querySelector('#structureNotice');
const lookupStatus = document.querySelector('#lookupStatus');
const lookupSource = document.querySelector('#lookupSource');
const smilesRow = document.querySelector('#smilesRow');
const renderedSmiles = document.querySelector('#renderedSmiles');
const smilesPreview = document.querySelector('#smilesPreview');
const copySmilesButton = document.querySelector('#copySmiles');
const historyButton = document.querySelector('#historyButton');
const historyPanel = document.querySelector('#historyPanel');
const historyList = document.querySelector('#historyList');
const historyStorageStatus = document.querySelector('#historyStorageStatus');
const historyStore = StructureHistory.createStore({onStatus(message) {
  historyStorageStatus.textContent = message;
  historyStorageStatus.hidden = false;
}});
let historyChoice = null;
function updateHistoryList() {
  historyList.textContent = '';
  const records = historyStore.list();
  document.querySelector('#clearHistory').disabled = !records.length;
  if (!records.length) {
    const empty = document.createElement('p');
    empty.textContent = '尚無成功繪製的歷史。';
    historyList.append(empty);
    return;
  }
  records.forEach((record, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('data-history-index', String(index));
    const name = document.createElement('strong');
    name.textContent = record.name || record.input || '自訂分子';
    const smiles = document.createElement('span');
    smiles.textContent = record.smiles;
    const time = document.createElement('small');
    time.textContent = new Date(record.time).toLocaleString('zh-TW');
    button.append(name, smiles, time);
    historyList.append(button);
  });
}
function closeHistory() {
  historyPanel.hidden = true;
  historyButton.setAttribute('aria-expanded', 'false');
}
function clearRenderedSmiles() {
  smilesRow.hidden = true;
  renderedSmiles.value = '';
  smilesPreview.textContent = '';
  copySmilesButton.disabled = true;
}
let lookupController = null;
let lookupState = {kind:'idle', message:'等待輸入或選擇範例。'};
function setLookupStatus(kind, message) {
  lookupState = {kind, message};
  lookupStatus.textContent = message;
  lookupStatus.setAttribute('data-kind', kind);
  lookupStatus.hidden = false;
}
function candidateLookupStatus(candidate, cached = false) {
  if (candidate.history) return {kind:'history', message:'已從歷史載入保存的 SMILES，於本機重新繪製。'};
  if (candidate.source) return {kind:'remote-found', message:`已從 ${candidate.source.label} 找到結構${cached ? '（使用本次頁面的成功查詢快取）' : ''}。`};
  if (/^(raw|smiles):/.test(candidate.id)) return {kind:'smiles', message:'已直接解析 SMILES。'};
  return {kind:'local-found', message:'已在本機資料找到結構。'};
}
function setLookupErrorStatus(error, stage) {
  if (stage === 'settings') return setLookupStatus('settings-error', '繪圖設定有誤，請檢查下方說明。');
  if (error.code === 'not-found') return setLookupStatus('not-found', 'OPSIN／PubChem 均未找到對應結構。');
  if (error.code === 'lookup-failed') {
    const codes = error.causes?.map(cause => cause.code) || [];
    if (codes.includes('timeout')) return setLookupStatus('timeout', '名稱查詢逾時，未能完成查詢。');
    if (codes.includes('network')) return setLookupStatus('connection-error', '名稱服務連線失敗，未能完成查詢。');
    if (codes.includes('busy')) return setLookupStatus('service-error', '名稱服務忙碌或限流，未能完成查詢。');
    return setLookupStatus('invalid-response', '名稱服務回傳資料無法使用，未能取得可繪製結構。');
  }
  if (error.code === 'formula') return setLookupStatus('needs-structure', '分子式可能有多種結構，請先指定目標。');
  if (error.code === 'concept') return setLookupStatus('needs-structure', '請指定具體分子、單體或片段。');
  return setLookupStatus(stage === 'drawing' ? 'drawing-error' : 'idle', stage === 'drawing' ? '繪圖未完成，請檢查下方說明。' : '請輸入結構後按「繪製」。');
}
const renderButton = document.querySelector('#renderButton');
const downloadButton = document.querySelector('#downloadOutput');
const copyButton = document.querySelector('#copyOutput');
let lastSvg = '';
let baseSvg = '';
const highlightToggle = document.querySelector('#highlightToggle');
const highlightTools = document.querySelector('#highlightTools');
const highlightHint = document.querySelector('#highlightHint');
const highlightStatus = document.querySelector('#highlightStatus');
const highlightTarget = document.querySelector('#highlightTarget');
const highlightOccurrence = document.querySelector('#highlightOccurrence');
const highlightTargetLabel = document.querySelector('#highlightTargetLabel');
const highlightTargetKind = document.querySelector('#highlightTargetKind');
const highlightOccurrenceLabel = document.querySelector('#highlightOccurrenceLabel');
const eraseHighlightButton = document.querySelector('#eraseHighlight');
const clearHighlightsButton = document.querySelector('#clearHighlights');
const highlightModeButtons = document.querySelectorAll('[data-highlight-mode]');
let highlightActive = false;
let highlightModeValue = 'direct';
let highlightCandidates = {elements:[], groups:[]};
let highlightIdentity = '';
let highlightHydrogens = '';
let highlightColor = '#f5b942';
// Committed marks are what the export uses. The selection is the set of marks
// produced by the current element/group target; it is replaced when the target changes.
let highlightedAtoms = new Map();
let highlightedBonds = new Map();
let selectedAtoms = new Set();
let selectedBonds = new Set();
function resetHighlights() {
  highlightedAtoms.clear(); highlightedBonds.clear(); selectedAtoms.clear(); selectedBonds.clear();
}
function reconcileHighlights(identity, hydrogens) {
  const changedHydrogens = highlightIdentity === identity && highlightHydrogens !== hydrogens;
  if (highlightIdentity !== identity || changedHydrogens) {
    resetHighlights(); highlightModeValue = 'direct';
  }
  highlightIdentity = identity; highlightHydrogens = hydrogens;
  return changedHydrogens;
}
function highlightTargetItems() {
  const list = highlightModeValue === 'element' ? highlightCandidates.elements
    : highlightModeValue === 'group' ? highlightCandidates.groups : [];
  return list.filter(item => (item.matches || item.atoms).length);
}
function highlightItemLabel(item) {
  if (highlightModeValue === 'element') {
    const name = HighlightSelection.elementName(item.id);
    return `${name ? `${name} ` : ''}${item.id} ×${item.atoms.length}`;
  }
  return `${item.zh ? `${item.zh}　` : ''}${item.label} ×${item.matches.length}`;
}
function syncHighlightModeUI() {
  highlightModeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.highlightMode === highlightModeValue)));
  highlightTargetKind.textContent = highlightModeValue === 'element' ? '元素' : '官能基';
  highlightTargetLabel.hidden = highlightModeValue === 'direct';
}
function updateHighlightOccurrences() {
  const previous = highlightOccurrence.value;
  const item = highlightTargetItems().find(entry => entry.id === highlightTarget.value);
  const multiple = highlightModeValue === 'group' && (item?.matches.length || 0) > 1;
  const options = multiple
    ? [new Option(`全部 ×${item.matches.length}`, 'all'), ...item.matches.map((_, index) => new Option(`第 ${index + 1} 個`, String(index)))]
    : [new Option('全部', 'all')];
  highlightOccurrence.replaceChildren(...options);
  highlightOccurrence.value = options.some(option => option.value === previous) ? previous : 'all';
  highlightOccurrenceLabel.hidden = !multiple;
}
function updateHighlightTargets() {
  const groupButton = document.querySelector('[data-highlight-mode="group"]');
  const hasGroups = highlightCandidates.groups.some(group => group.matches.length);
  groupButton.disabled = !hasGroups;
  groupButton.title = hasGroups ? '依官能基標色' : '此分子沒有可辨識的官能基';
  if (!hasGroups && highlightModeValue === 'group') {
    forgetSelection(); highlightModeValue = 'direct';
  }
  const previous = highlightTarget.value;
  const items = highlightTargetItems();
  const placeholder = highlightModeValue === 'element' ? '選擇元素…' : '選擇官能基…';
  highlightTarget.replaceChildren(new Option(placeholder, ''), ...items.map(item => new Option(highlightItemLabel(item), item.id)));
  highlightTarget.value = items.some(item => item.id === previous) ? previous : '';
  syncHighlightModeUI();
  updateHighlightOccurrences();
}
function forgetSelection() {
  selectedAtoms.clear(); selectedBonds.clear();
}
function removeSelection() {
  selectedAtoms.forEach(index => highlightedAtoms.delete(index));
  selectedBonds.forEach(index => highlightedBonds.delete(index));
  forgetSelection();
}
function recolorSelection() {
  selectedAtoms.forEach(index => highlightedAtoms.set(index, highlightColor));
  selectedBonds.forEach(index => highlightedBonds.set(index, highlightColor));
}
function applyTargetSelection() {
  removeSelection();
  const item = highlightTargetItems().find(entry => entry.id === highlightTarget.value);
  if (item) {
    const matches = highlightModeValue === 'element' ? [item]
      : highlightOccurrence.value === 'all' ? item.matches
      : [item.matches[Number(highlightOccurrence.value)]].filter(Boolean);
    matches.forEach(match => {
      match.atoms.forEach(index => selectedAtoms.add(index));
      match.bonds.forEach(index => selectedBonds.add(index));
    });
    recolorSelection();
  }
  paintHighlights();
}
function setHighlightMode(mode) {
  forgetSelection();
  highlightModeValue = mode;
  highlightTarget.value = '';
  updateHighlightTargets();
  paintHighlights();
}
function setHighlightActive(active) {
  highlightActive = active && !!baseSvg;
  if (highlightActive) paintHighlights();
  else setHighlightMode('direct');
}
function paintHighlights() {
  if (!baseSvg) highlightActive = false;
  const selectedCount = selectedAtoms.size + selectedBonds.size;
  const markCount = highlightedAtoms.size + highlightedBonds.size;
  highlightToggle.disabled = !baseSvg;
  highlightToggle.setAttribute('aria-pressed', String(highlightActive));
  highlightTools.hidden = !highlightActive;
  highlightHint.hidden = !highlightActive;
  previewStage.classList.toggle('highlight-active', highlightActive);
  eraseHighlightButton.disabled = !highlightActive || highlightModeValue === 'direct' || !selectedCount;
  clearHighlightsButton.disabled = !markCount;
  highlightStatus.textContent = !baseSvg ? '請先繪製分子。'
    : markCount ? `已標色 ${highlightedAtoms.size} 原子、${highlightedBonds.size} 鍵`
    : highlightModeValue === 'direct' ? '點選原子或鍵開始標色'
    : !highlightTarget.value ? '請選擇目標'
    : '此目標沒有可標色的項目';
  if (!baseSvg) return;
  const root = new DOMParser().parseFromString(baseSvg, 'image/svg+xml').documentElement;
  const atomShapes = [...root.querySelectorAll('ellipse')].filter(node => /\batom-\d+\b/.test(node.getAttribute('class') || ''));
  const bondShapes = [...root.querySelectorAll('path')].filter(node => /\bbond-\d+\b/.test(node.getAttribute('class') || ''));
  const indexOf = (node, kind) => Number(node.getAttribute('class').match(new RegExp(`\\b${kind}-(\\d+)\\b`))[1]);
  atomShapes.forEach(node => {
    const color = highlightedAtoms.get(indexOf(node, 'atom'));
    if (color) node.setAttribute('style', `fill:${color};fill-opacity:0.48;stroke:none`);
  });
  const ns = 'http://www.w3.org/2000/svg';
  const colors = document.createElementNS(ns, 'g');
  colors.setAttribute('data-applied-highlights', 'bonds');
  bondShapes.forEach(node => {
    const color = highlightedBonds.get(indexOf(node, 'bond'));
    if (!color) return;
    const clone = node.cloneNode(true);
    clone.setAttribute('style', `fill:none;stroke:${color};stroke-opacity:0.55;stroke-width:12;stroke-linecap:round;stroke-linejoin:round`);
    colors.append(clone);
  });
  if (bondShapes[0]) root.insertBefore(colors, bondShapes[0]);
  // Freeze the export before adding selection previews and input targets.
  lastSvg = new XMLSerializer().serializeToString(root);
  if (highlightActive) {
    const overlay = document.createElementNS(ns, 'g');
    overlay.setAttribute('data-highlight-overlay', 'true');
    const addTarget = (node, kind, index) => {
      const marked = (kind === 'atom' ? highlightedAtoms : highlightedBonds).has(index);
      const clone = node.cloneNode(true);
      clone.setAttribute('class', 'highlight-hit');
      clone.setAttribute('style', kind === 'atom'
        ? `fill:${marked ? '#5168b333' : 'transparent'};stroke:${marked ? '#3658a4' : 'transparent'};stroke-width:2;stroke-dasharray:4 3;pointer-events:all`
        : `fill:none;stroke:${marked ? '#3658a4' : 'transparent'};stroke-width:16;stroke-opacity:${marked ? '0.35' : '1'};pointer-events:stroke`);
      clone.setAttribute('data-highlight-kind', kind); clone.setAttribute('data-highlight-index', String(index));
      clone.setAttribute('tabindex', '0'); clone.setAttribute('role', 'button');
      clone.setAttribute('aria-label', `${kind === 'atom' ? '原子' : '鍵'} ${index}`);
      clone.setAttribute('aria-pressed', String(marked));
      overlay.append(clone);
    };
    bondShapes.forEach(node => addTarget(node, 'bond', indexOf(node, 'bond')));
    atomShapes.forEach(node => addTarget(node, 'atom', indexOf(node, 'atom')));
    root.append(overlay);
  }
  previewStage.replaceChildren(root);
}
highlightModeButtons.forEach(button => button.addEventListener('click', () => {
  if (button.dataset.highlightMode !== highlightModeValue) setHighlightMode(button.dataset.highlightMode);
}));
highlightTarget.addEventListener('change', () => {
  highlightOccurrence.value = 'all';
  updateHighlightOccurrences();
  applyTargetSelection();
});
highlightOccurrence.addEventListener('change', applyTargetSelection);
document.querySelectorAll('[data-highlight-color]').forEach(button => button.addEventListener('click', () => {
  highlightColor = button.dataset.highlightColor;
  document.querySelectorAll('[data-highlight-color]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  recolorSelection();
  paintHighlights();
}));
eraseHighlightButton.addEventListener('click', () => {removeSelection(); setHighlightMode('direct');});
clearHighlightsButton.addEventListener('click', () => {resetHighlights(); setHighlightMode('direct');});
highlightToggle.addEventListener('click', () => setHighlightActive(!highlightActive));
document.querySelector('#finishHighlight').addEventListener('click', () => setHighlightActive(false));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && highlightActive && !drawer.classList.contains('open')) setHighlightActive(false);
});
function toggleHighlightTarget(event) {
  const target = event.target.closest('[data-highlight-kind]');
  if (!target || !highlightActive) return;
  if (event.type === 'keydown' && ![' ', 'Enter'].includes(event.key)) return;
  event.preventDefault();
  const kind = target.dataset.highlightKind;
  const index = Number(target.dataset.highlightIndex);
  if (highlightModeValue !== 'direct') setHighlightMode('direct');
  const marks = kind === 'atom' ? highlightedAtoms : highlightedBonds;
  const selection = kind === 'atom' ? selectedAtoms : selectedBonds;
  if (marks.has(index)) marks.delete(index); else marks.set(index, highlightColor);
  selection.delete(index);
  paintHighlights();
  if (event.type === 'keydown') previewStage.querySelector(`[data-highlight-kind="${kind}"][data-highlight-index="${index}"]`)?.focus();
}
previewStage.addEventListener('click', toggleHighlightTarget);
previewStage.addEventListener('keydown', toggleHighlightTarget);
let lastFormula = '';
let lastSmiles = '';
let lastRenderOptions = null;
let renderSequence = 0;
let rotation = 0;
let flipX = false;
let flipY = false;
let hydrogenMode = 'hetero';
let stereoMode = 'wedge';
let numberingMode = 'none';
let numberingSize = 'small';
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
const nameResolver = NameLookup.createResolver({fetchImpl: (...args) => fetch(...args), validateSmiles: smiles => {
  // Resolver runs only after resolveCandidates has awaited rdkitReady.
  const molecule = lookupRdkit.get_mol(smiles);
  if (!molecule) return false;
  try { return molecule.get_num_atoms() > 0; }
  finally { molecule.delete(); }
}});
let lookupRdkit;

function options() {
  const heightCm = Number(document.querySelector('#heightCm').value);
  const scalePercent = Number(document.querySelector('#scalePercent').value);
  if (sizeMode === 'height' && (!Number.isFinite(heightCm) || heightCm < 1 || heightCm > 30))
    throw new Error('畫布高度請設定為 1 至 30 cm。');
  if (sizeMode === 'bond' && (!Number.isFinite(scalePercent) || scalePercent < 20 || scalePercent > 300))
    throw new Error('鍵長比例請設定為 20% 至 300%。');
  return {
    interactive_highlights: true,
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
    add_stereo_annotation: stereoMode === 'both' || stereoMode === 'labels',
    stereo_bond_mode: stereoMode,
    add_atom_indices: numberingMode === 'index',
    steroid_numbering: numberingMode === 'steroid',
    numbering_size: numberingSize
  };
}
async function refreshTransform() {
  document.querySelector('#flipHorizontal').setAttribute('aria-pressed', String(flipX));
  document.querySelector('#flipVertical').setAttribute('aria-pressed', String(flipY));
  return lastSvg ? render() : false;
}
function setError(message = '') {
  errorBox.textContent = message;
  unknownNamePromptButton.hidden = true;
  unknownNamePromptButton.textContent = '複製這個名稱的 Gemini 查詢提示詞';
}
function lookupFailureMessage(error, input) {
  if (error.code === 'not-found') {
    return `你輸入的「${input.trim()}」可能是 IUPAC 或俗名；繪圖需要 SMILES。已向 OPSIN／PubChem 查找，但未找到對應結構。可請 Gemini 協助產生 SMILES，確認後貼回繪製。`;
  }
  if (error.code === 'lookup-failed') {
    const problems = (error.causes || []).filter(cause => cause.code !== 'not-found').map(cause => cause.message).join('；');
    return `未能完成「${input.trim()}」的 OPSIN／PubChem 查詢，尚不能判定是否有對應結構。${problems ? `${problems}。` : ''}可稍後重試，或請 Gemini 協助取得 SMILES，確認目標後貼回繪製。`;
  }
  return error.message;
}
function setStatus(online, text) {
  document.querySelector('#statusDot').className = 'status-dot ' + (online ? 'online' : 'offline');
  document.querySelector('#statusText').textContent = text;
}
function setLoading(loading) {
  renderButton.disabled = loading;
  renderButton.textContent = loading ? '繪製中…' : '繪製';
}
function clearPreview(message = '輸入結構或選擇範例後按下編譯。') {
  clearRenderedSmiles();
  lookupSource.hidden = true;
  lookupSource.removeAttribute('href');
  lookupSource.textContent = '來源';
  structureNotice.hidden = true;
  structureNotice.textContent = '';
  lastSvg = '';
  baseSvg = ''; highlightIdentity = ''; resetHighlights(); paintHighlights();
  lastFormula = '';
  lastSmiles = '';
  lastRenderOptions = null;
  previewStage.innerHTML = `<div class="empty-state"><strong>等待選擇結構</strong><p>${escapeHTML(message)}</p></div>`;
  document.querySelector('#metaName').textContent = '—';
  setStereoBadge('');
  document.querySelector('#metaFormula').textContent = '—';
  document.querySelector('#metaWeight').textContent = 'MW: —';
  document.querySelector('#metaSize').textContent = '—';
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
function tryParseSmiles(rdkit, value) {
  try { return rdkit.get_mol(value); }
  catch { return null; }
}
async function resolveCandidates(value, lookupOptions = {}) {
  await catalogReady;
  const input = String(value || '').trim();
  const key = normalizeQuery(input);
  if (!key) return [];
  if (historyChoice?.smiles === input) return [historyChoice];
  const concept = catalogConcepts.find(item => [item.name, ...(item.aliases || [])]
    .some(alias => normalizeQuery(alias).toLowerCase() === key.toLowerCase()));
  if (concept) {
    const error = new Error(concept.message);
    error.code = 'concept';
    throw error;
  }
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
    const parsed = tryParseSmiles(rdkit, input);
    if (parsed) {
      try {
        const parsedSmiles = parsed.get_smiles();
        const same = candidates.some(candidate => {
          const molecule = tryParseSmiles(rdkit, candidate.smiles);
          if (!molecule) return false;
          try { return molecule.get_smiles() === parsedSmiles; }
          finally { molecule.delete(); }
        });
        if (!same) candidates.push({id:`smiles:${input}`, name:`依 SMILES 解析：${input}`, smiles:input});
      } finally { parsed.delete(); }
    }
  }
  if (candidates.length) return candidates;
  const rdkit = await rdkitReady;
  lookupRdkit = rdkit;
  if (lookupOptions.signal?.aborted) throw new DOMException('查詢已取消', 'AbortError');
  const molecule = tryParseSmiles(rdkit, input);
  if (molecule) {
    try {
      if (molecule.get_num_atoms() > 0) return [{id:`raw:${input}`, name:'自訂分子', smiles:input}];
    } finally { molecule.delete(); }
  }
  if (NameLookup.isFormula(input)) {
    const error = new Error(`「${input}」看起來是分子式，可能對應多種結構，不能單憑分子式指定唯一化合物。請輸入具體名稱或 SMILES；也可複製下方提示詞請 Gemini 列出候選，確認目標後再貼回 SMILES。此次未將分子式送至名稱查詢服務。`);
    error.needsNameHelp = true;
    error.code = 'formula';
    throw error;
  }
  return nameResolver.lookup(input, lookupOptions);
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
  const online = candidates.some(candidate => candidate.source);
  candidateList.innerHTML = `<strong>${candidates.length > 1 ? '找到多個可能結構，請選擇一個' : online ? '找到一筆線上查詢結果，請確認' : '找到一筆已收錄結構，請確認'}</strong>` +
    (online ? '<p>以下為線上名稱查詢結果，請核對名稱、分子式、電荷與立體化學後選擇；結果不代表全部異構物。</p>' :
      '<p>以下列出本機已收錄或可由 SMILES 解析的候選；同分子式可能還有其他異構物。</p>') +
    candidates.map((candidate, index) =>
      `<button type="button" class="candidate-card" data-candidate="${index}">` +
      `<span class="candidate-image">${images[index]}</span>` +
      `<span><b>${escapeHTML(candidate.name)}</b><small>${escapeHTML(candidate.smiles)}</small>` +
      (candidate.source ? `<small>${escapeHTML(candidate.source.label)}${candidate.formula ? ` · ${escapeHTML(candidate.formula)}` : ''}</small>` : '') +
      (candidate.warning ? `<small>${escapeHTML(candidate.warning)}</small>` : '') + '</span></button>'
    ).join('');
  candidateList.hidden = false;
  candidateList._candidates = candidates;
}
// Stereo badge stays hidden when the structure has no assigned stereo information.
function setStereoBadge(label) {
  const badge = document.querySelector('#metaStereo');
  badge.textContent = label;
  badge.hidden = !label;
}
function stereoLabel(tags) {
  const values = [...(tags.CIP_atoms || []), ...(tags.CIP_bonds || [])]
    .map(item => item.at(-1)).filter(value => typeof value === 'string')
    .map(value => value.replace(/^\((.*)\)$/, '$1'));
  return values.length ? [...new Set(values)].join(' · ') : '';
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
  lookupController?.abort();
  lookupController = new AbortController();
  const controller = lookupController;
  const sequence = ++renderSequence;
  clearRenderedSmiles();
  let stage = 'input';
  let cachedLookup = false;
  setError('');
  updateSmilesPrompt();
  structureNotice.hidden = true;
  structureNotice.textContent = '';
  lookupSource.hidden = true;
  candidateList.hidden = true;
  candidateList.innerHTML = '';
  setLoading(true);
  try {
    if (!structureInput.value.trim()) throw new Error('\u8acb\u5148\u8f38\u5165\u5316\u5b78\u5f0f\u6216\u4fd7\u540d');
    stage = 'settings';
    options(); // Reject invalid drawing settings before sending a name query.
    stage = 'resolving';
    setLookupStatus('resolving', '正在確認輸入…');
    const candidates = await resolveCandidates(structureInput.value, {
      signal: controller.signal,
      onProgress(message) {
        if (sequence !== renderSequence) return;
        setLookupStatus(message.includes('OPSIN') ? 'querying-opsin' : 'querying-pubchem', message);
      },
      onResolved({cached}) { cachedLookup = cached; }
    });
    if (sequence !== renderSequence) return false;
    if (candidates.length > 1 || needsFormulaConfirmation(structureInput.value) ||
        (candidates[0]?.requiresConfirmation && selectedChoice?.compound !== candidates[0])) {
      clearPreview('請從左側候選結構選擇一個。');
      await showCandidates(candidates, sequence);
      if (sequence === renderSequence) {
        const source = candidates[0]?.source?.label || '本機資料／SMILES';
        setLookupStatus('candidates', `待選候選：${source}${cachedLookup ? '（成功查詢快取）' : ''}，請確認後選擇結構。`);
      }
      return false;
    }
    candidateList.hidden = true;
    candidateList.innerHTML = '';
    const candidate = candidates[0];
    const foundStatus = candidateLookupStatus(candidate, cachedLookup);
    setLookupStatus(foundStatus.kind, foundStatus.message);
    stage = 'drawing';
    const structure = candidate.smiles;
    codeInput.value = itemCode({smiles: structure});
    const data = await drawMolecule(structure, options());
    if (sequence !== renderSequence) return false;
    baseSvg = data.svg;
    const identityMol = (await rdkitReady).get_mol(structure);
    let identity;
    // Canonical SMILES alone is insufficient: equivalent input SMILES can have
    // different atom ordering. Keep the source too unless an explicit mapping exists.
    try { identity = `${identityMol.get_smiles()}\n${structure}`; } finally { identityMol.delete(); }
    const changedStructure = highlightIdentity && highlightIdentity !== identity &&
      (highlightedAtoms.size || highlightedBonds.size || selectedAtoms.size || selectedBonds.size);
    const changedHydrogens = reconcileHighlights(identity, hydrogenMode);
    highlightCandidates = data.highlightCandidates;
    updateHighlightTargets();
    if (changedHydrogens) toast('氫顯示方式已變更，為避免索引錯置，已清除標色。');
    else if (changedStructure) toast('結構或原子排列已變更，已清除標色。');
    lastFormula = data.formula || data.smiles;
    lastSmiles = structure;
    renderedSmiles.value = lastSmiles;
    smilesPreview.textContent = lastSmiles.length > 25 ? `${lastSmiles.slice(0, 24)}…` : lastSmiles;
    smilesRow.hidden = false;
    copySmilesButton.disabled = false;
    lastRenderOptions = data.options;
    paintHighlights();
    previewStage.classList.toggle('transparent', data.options.transparent_background);
    document.querySelector('#flipHorizontal').setAttribute('aria-pressed', String(flipX));
    document.querySelector('#flipVertical').setAttribute('aria-pressed', String(flipY));
    const galleryName = gallery.find(entry => entry.smiles === structure)?.name;
    document.querySelector('#metaName').textContent = selectedName || (candidate.id.startsWith('raw:') ? '' : candidate.name) || galleryName || '自訂分子';
    setStereoBadge(stereoLabel(data.stereo_tags));
    document.querySelector('#metaFormula').innerHTML = formulaMarkup(data.formula);
    document.querySelector('#metaWeight').textContent = Number.isFinite(data.molecular_weight)
      ? `MW: ${data.molecular_weight.toFixed(2)} g/mol` : 'MW: —';
    document.querySelector('#metaSize').textContent = `輸出 ${data.options.width_cm.toFixed(2)} × ${data.options.height_cm.toFixed(2)} cm`;
    downloadButton.disabled = false;
    copyButton.disabled = false;
    document.querySelector('#copyFormula').disabled = false;
    document.querySelector('#invertChirality').disabled = !(data.stereo_tags.CIP_atoms?.length && /\[[^\]]*@@?[^\]]*\]/.test(structure));
    unknownNamePromptButton.hidden = true;
    structureNotice.textContent = '';
    structureNotice.hidden = true;
    if (candidate.source) {
      lookupSource.href = candidate.source.url;
      lookupSource.textContent = candidate.source.label;
      lookupSource.hidden = false;
    }
    const historySource = candidate.history ? candidate.originalSource : candidate.source;
    historyStore.add({name:document.querySelector('#metaName').textContent,
      input:candidate.history ? candidate.originalInput : structureInput.value.trim(), smiles:structure,
      time:Date.now(), ...(historySource ? {source:historySource} : {})});
    updateHistoryList();
    return true;
  } catch (error) {
    if (sequence === renderSequence && error.name !== 'AbortError') {
      clearPreview('請修正輸入後再編譯。');
      setError(lookupFailureMessage(error, structureInput.value));
      if (error.code === 'formula') unknownNamePromptButton.textContent = '複製分子式的 Gemini 查詢提示詞';
      unknownNamePromptButton.hidden = !error.needsNameHelp;
      setLookupErrorStatus(error, stage);
    }
    return false;
  } finally {
    if (sequence === renderSequence) {
      setLoading(false);
    }
  }
}
function loadCode(structure, name = '') { historyChoice = null; selectedChoice = null; selectedName = name; structureInput.value = structure; return render(); }
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
  return render();
});
structureInput.addEventListener('input', () => {
  historyChoice = null;
  clearRenderedSmiles();
  // Invalidate pending lookups/draws before they can publish an older input.
  ++renderSequence;
  lookupController?.abort();
  setLookupStatus('idle', structureInput.value.trim() ? '尚未繪製，按「繪製」解析目前輸入。' : '等待輸入或選擇範例。');
  lookupSource.hidden = true;
  setLoading(false);
  setError('');
  updateSmilesPrompt();
  structureNotice.hidden = true;
  structureNotice.textContent = '';
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
document.querySelectorAll('[data-layout]').forEach(button => button.addEventListener('click', () => {
  const useCoordGen = button.dataset.layout === 'coordgen';
  document.querySelector('#coordGenInput').checked = useCoordGen;
  document.querySelectorAll('[data-layout]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  scheduleStyleRender();
}));
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
document.querySelectorAll('[data-name-example]').forEach(button => button.addEventListener('click', () => loadCode(button.dataset.nameExample)));
// Only the initial state follows the viewport. Resizing must not discard the
// user's choice to open a panel or their place in its controls.
if (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 900px)').matches) {
  document.querySelectorAll('#styleOptions, #exportOptions').forEach(panel => { panel.open = false; });
  document.querySelectorAll('.studio-style-section').forEach((panel, index) => { panel.open = index === 0; });
}
// Phone hints: title attributes are invisible on touch screens, so each group
// with an explanation gets a "？" button. Tapping it opens ONE shared popover
// built from the same title attributes at tap time, so the titles stay the only
// copy of the text. The buttons are hidden on mouse desktops by CSS. This block
// must stay above the "Phone layout" block: its Escape listener has to run first.
(() => {
  if (typeof window === 'undefined' || !document.body) return;
  const popover = document.createElement('div');
  popover.id = 'hintPopover';
  popover.className = 'hint-popover';
  popover.setAttribute('role', 'dialog');
  popover.hidden = true;
  document.body.append(popover);
  let owner = null;
  const close = () => {
    if (!owner) return;
    owner.setAttribute('aria-expanded', 'false');
    owner = null;
    popover.hidden = true;
  };
  const place = button => {
    const gap = 8, edge = 8;
    const anchor = button.getBoundingClientRect();
    const width = popover.offsetWidth, height = popover.offsetHeight;
    let top = anchor.top - gap - height;
    if (top < edge) top = anchor.bottom + gap; // no room above: flip below
    top = Math.max(edge, Math.min(top, window.innerHeight - height - edge));
    const center = anchor.left + anchor.width / 2 - width / 2;
    const left = Math.max(edge, Math.min(center, window.innerWidth - width - edge));
    popover.style.top = `${Math.round(top)}px`;
    popover.style.left = `${Math.round(left)}px`;
  };
  const open = (button, lines) => {
    close();
    popover.replaceChildren(...lines.map(text => {
      const p = document.createElement('p');
      p.textContent = text;
      return p;
    }));
    popover.setAttribute('aria-label', button.getAttribute('aria-label'));
    popover.hidden = false;
    owner = button;
    button.setAttribute('aria-expanded', 'true');
    place(button);
  };
  // Lines: the root's own title (groups only), then "按鈕文字：說明" for each titled button.
  const linesOf = root => () => {
    const lines = root.getAttribute('title') ? [root.getAttribute('title')] : [];
    root.querySelectorAll('button[title]').forEach(button => {
      lines.push(`${button.textContent.trim()}：${button.getAttribute('title')}`);
    });
    return lines;
  };
  const addHint = (label, linesFor, insert) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hint-button';
    button.textContent = '？';
    button.setAttribute('aria-label', `說明：${label}`);
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'hintPopover');
    insert(button);
    button.addEventListener('click', () => {
      if (owner === button) return close();
      const lines = linesFor();
      if (lines.length) open(button, lines);
    });
  };
  // Groups: "？" right after the group label. Stand-alone segmented controls: just before them.
  document.querySelectorAll('#styleOptions .style-group, #exportOptions .style-group').forEach(group => {
    const linesFor = linesOf(group);
    if (!linesFor().length) return;
    const label = group.querySelector(':scope > strong');
    addHint(label ? label.textContent : '選項', linesFor, button => (label ? label.after(button) : group.prepend(button)));
  });
  document.querySelectorAll('#styleOptions .segmented, #exportOptions .segmented').forEach(segmented => {
    if (segmented.closest('.style-group')) return; // the group above carries its own "？"
    const linesFor = linesOf(segmented);
    if (!linesFor().length) return;
    addHint(segmented.getAttribute('aria-label') || '選項', linesFor, button => segmented.before(button));
  });
  const mode = document.querySelector('#highlightMode');
  if (mode) addHint('標色', () => ['標色會一併輸出到 PNG／SVG。點選原子或鍵標色，再點一次取消。'], button => mode.after(button));
  // Tapping elsewhere, scrolling, opening or closing a sheet or the gallery, or resizing dismisses it.
  document.addEventListener('pointerdown', event => {
    if (owner && !popover.contains(event.target) && !event.target.closest?.('.hint-button')) close();
  }, true);
  document.addEventListener('scroll', event => {
    if (owner && !popover.contains(event.target)) close();
  }, true);
  window.addEventListener('resize', () => (owner && owner.getClientRects().length ? place(owner) : close()));
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(() => close()).observe(document.body, {attributes: true, attributeFilter: ['data-sheet', 'class']});
  }
  // Escape closes only the popover; stopImmediatePropagation keeps the sheet and 標色 handlers from running.
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !owner) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    close();
  }, true);
})();
// Phone layout: 樣式 / 尺寸與格式 / 標色 options are bottom sheets above the
// action bar, so the canvas stays on screen and the page itself never scrolls.
// body[data-sheet] names the open sheet; --sheet-h tells the CSS how much
// canvas to give up while one is open.
if (typeof window !== 'undefined' && window.matchMedia) {
  const phone = window.matchMedia('(max-width: 900px)');
  const styleTab = document.querySelector('#styleTab');
  const styleOptions = document.querySelector('#styleOptions');
  const exportOptions = document.querySelector('#exportOptions');
  const highlightTools = document.querySelector('#highlightTools');
  const actionBar = document.querySelector('.studio-output');
  const sheetEls = () => [
    document.querySelector('#styleOptions'),
    document.querySelector('#exportOptions > .output-control-row'),
    document.querySelector('#highlightTools')
  ].filter(Boolean);
  const measureSheet = () => {
    const root = document.documentElement;
    if (!phone.matches) { root.style.removeProperty('--sheet-h'); root.style.removeProperty('--bar-h'); return; }
    // Distance from the action bar's top edge to the screen bottom, so sheets
    // sit exactly on the bar whatever spacing sits below it.
    const barTop = actionBar ? actionBar.getBoundingClientRect().top : 0;
    root.style.setProperty('--bar-h', `${barTop > 0 ? Math.round(window.innerHeight - barTop) : 57}px`);
    const open = sheetEls().find(el => el.getClientRects().length > 0 && getComputedStyle(el).position === 'fixed');
    root.style.setProperty('--sheet-h', open ? `${open.offsetHeight}px` : '0px');
  };
  const currentSheet = () => document.body.dataset.sheet || '';
  const applySheet = name => {
    if (name) document.body.dataset.sheet = name; else delete document.body.dataset.sheet;
    styleTab?.setAttribute('aria-expanded', String(name === 'style'));
    if (phone.matches) {
      if (styleOptions) styleOptions.open = name === 'style';
      if (exportOptions) exportOptions.open = name === 'export';
    }
    measureSheet();
    requestAnimationFrame(measureSheet);
  };
  styleTab?.addEventListener('click', () => applySheet(currentSheet() === 'style' ? '' : 'style'));
  exportOptions?.addEventListener('toggle', () => {
    if (!phone.matches) return;
    const next = exportOptions.open ? 'export' : (currentSheet() === 'export' ? '' : currentSheet());
    if (next !== currentSheet()) applySheet(next);
  });
  document.addEventListener('keydown', event => {
    // The gallery drawer sits above every sheet: let it handle Esc first.
    if (document.body.classList.contains('drawer-open')) return;
    if (event.key === 'Escape' && phone.matches && currentSheet()) { event.stopImmediatePropagation(); applySheet(''); }
  }, true);
  // Opening the gallery covers the screen, so close any bottom sheet with it.
  new MutationObserver(() => {
    if (document.body.classList.contains('drawer-open') && currentSheet()) applySheet('');
  }).observe(document.body, {attributes: true, attributeFilter: ['class']});
  phone.addEventListener?.('change', () => {
    if (phone.matches) { applySheet(''); }
    else { delete document.body.dataset.sheet; if (styleOptions) styleOptions.open = true; if (exportOptions) exportOptions.open = true; measureSheet(); }
  });
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(measureSheet);
    sheetEls().forEach(el => observer.observe(el));
    if (actionBar) observer.observe(actionBar);
  }
  if (highlightTools && typeof MutationObserver !== 'undefined') {
    new MutationObserver(() => { measureSheet(); requestAnimationFrame(measureSheet); }).observe(highlightTools, {attributes: true, attributeFilter: ['hidden']});
  }
  measureSheet();
}
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
function updateNumberingControls() {
  const disabled = numberingMode === 'none';
  document.querySelectorAll('[data-numbering-size]').forEach(button => { button.disabled = disabled; });
  document.querySelector('#numberingSizeControls').setAttribute('aria-disabled', String(disabled));
}
updateNumberingControls();
document.querySelectorAll('[data-numbering]').forEach(button => button.addEventListener('click', () => {
  numberingMode = button.dataset.numbering;
  document.querySelectorAll('[data-numbering]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  updateNumberingControls();
  scheduleStyleRender();
}));
document.querySelectorAll('[data-numbering-size]').forEach(button => button.addEventListener('click', () => {
  if (button.disabled || numberingMode === 'none') return;
  numberingSize = button.dataset.numberingSize;
  document.querySelectorAll('[data-numbering-size]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
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
  hydrogenMode = 'hetero';
  explicitMethyl = preset === 'teaching';
  document.querySelectorAll('[data-hydrogens]').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.hydrogens === hydrogenMode)));
  document.querySelectorAll('[data-methyl]').forEach(item => item.setAttribute('aria-pressed', String((item.dataset.methyl === 'explicit') === explicitMethyl)));
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
    const reversedName = invertedName(selectedName);
    selectedName = reversedName && reversedName !== selectedName ? reversedName : '反轉手性結構';
    historyChoice = null;
    structureInput.value = next;
    if (await render()) toast('已產生對映異構物；R/S 手性中心已反轉，E/Z 保持不變。');
  } catch (error) { setError(error.message); }
});
copySmilesButton.addEventListener('click', async () => {
  if (copySmilesButton.disabled || !lastSvg || !renderedSmiles.value) return;
  const smiles = renderedSmiles.value;
  const sequence = renderSequence;
  try {
    await navigator.clipboard.writeText(smiles);
    if (sequence === renderSequence) toast('SMILES 已複製');
  } catch {
    if (sequence !== renderSequence || renderedSmiles.value !== smiles) return;
    renderedSmiles.focus();
    renderedSmiles.select();
    toast('無法自動複製，已選取 SMILES，請手動複製');
  }
});
historyButton.addEventListener('click', () => {
  if (!historyPanel.hidden) return closeHistory();
  updateHistoryList();
  historyPanel.hidden = false;
  historyButton.setAttribute('aria-expanded', 'true');
});
document.querySelector('#closeHistory').addEventListener('click', () => {closeHistory(); historyButton.focus();});
document.querySelector('#clearHistory').addEventListener('click', () => {historyStore.clear(); updateHistoryList();});
historyList.addEventListener('click', event => {
  const button = event.target.closest('[data-history-index]');
  if (!button) return;
  const record = historyStore.list()[Number(button.getAttribute('data-history-index'))];
  if (!record) return;
  // Only use saved SMILES as input. Never replay the original name via APIs.
  historyChoice = {id:`history:${record.smiles}`, name:record.name, smiles:record.smiles, history:true,
    originalInput:record.input, originalSource:record.source};
  selectedChoice = null;
  selectedName = record.name;
  structureInput.value = record.smiles;
  closeHistory();
  return render();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !historyPanel.hidden) {closeHistory(); historyButton.focus();}
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
  document.querySelector('#dpiButtons').hidden = !png;
  document.querySelector('#dpiDivider').hidden = !png;
  document.querySelectorAll('[data-dpi]').forEach(button => {button.disabled = !png;});
  copyButton.textContent = '複製圖片';
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
  if (button.disabled || outputFormat !== 'png') return;
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
const smilesPromptText = document.querySelector('#smilesPromptText');
function updateSmilesPrompt() {
  const query = structureInput.value.trim() || '［請填入要查詢的化合物名稱、分子式、示性式或 SMILES］';
  smilesPromptText.value = `請協助取得化合物 SMILES，供 RDKit 繪圖。
使用者輸入：「${query}」
請先辨認輸入是名稱、分子式、示性式或 SMILES；不要以分子式指定唯一結構，也不要根據用途猜測。
若位置異構、R/S、E/Z、酸鹽／質子化狀態等歧義會影響目標，請簡短提問並列出候選名稱及差異；先不要替我選擇或給出最終 SMILES。未指定立體化學時不要自行補上；混合物或組成不固定的材料請先詢問具體成分。
優先使用 PubChem 等可查證資料；能連網時請提供實際來源，不能查證時請明說，不要編造來源或聲稱已驗證。
確認目標後，請輸出名稱、分子式、立體化學是否指定、來源或未查證說明。最後用獨立 code block 只放一筆 SMILES，不含名稱、引號、變數或 Python 程式，並保留已指定的立體化學。`;
}
function openSmilesHelp() {
  updateSmilesPrompt();
  smilesHelpPanel.hidden = false;
  smilesHelpButton.setAttribute('aria-expanded', 'true');
}
function closeSmilesHelp() {
  smilesHelpPanel.hidden = true;
  smilesHelpButton.setAttribute('aria-expanded', 'false');
}
smilesHelpButton.addEventListener('click', () => {
  if (smilesHelpPanel.hidden) openSmilesHelp();
  else closeSmilesHelp();
});
document.querySelector('#closeSmilesHelp').addEventListener('click', closeSmilesHelp);
async function copySmilesPrompt() {
  openSmilesHelp();
  try {
    await navigator.clipboard.writeText(smilesPromptText.value);
    toast('提示詞已複製，請開啟 Gemini 並貼上');
  } catch {
    smilesPromptText.focus();
    smilesPromptText.select();
    toast('無法複製，已選取提示詞，請手動複製');
  }
}
document.querySelector('#copySmilesPrompt').addEventListener('click', copySmilesPrompt);
unknownNamePromptButton.addEventListener('click', copySmilesPrompt);
document.addEventListener('pointerdown', event => {
  if (!smilesHelpPanel.hidden && !smilesHelpPanel.contains(event.target) && !smilesHelpButton.contains(event.target) && !unknownNamePromptButton.contains(event.target)) closeSmilesHelp();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !smilesHelpPanel.hidden) closeSmilesHelp();
});

structureInput.value = '';
updateSmilesPrompt();
document.querySelector('#dpiInput').value = '300';
updateFormatLabels();
checkHealth();
loadGallery();
