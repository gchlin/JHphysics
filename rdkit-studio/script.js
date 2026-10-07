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
let stereoAnnotations = false;
let explicitMethyl = false;
let gallery = [];
let selectedSubject = '\u5168\u90e8';
let selectedCategory = '\u5168\u90e8';

const snippets = {
  benzene: 'c1ccccc1',
  caffeine: 'Cn1c(=O)c2c(ncn2C)n(C)c1=O',
  aspirin: 'CC(=O)Oc1ccccc1C(=O)O',
  dna: 'Nc1ncnc2[nH]cnc12'
};

const formulaAliases = {
  'h2o':'O', '水':'O', 'co2':'O=C=O', '二氧化碳':'O=C=O',
  'h2so4':'OS(=O)(=O)O', '硫酸':'OS(=O)(=O)O', 'nh3':'N', '氨':'N',
  'nacl':'[Na+].[Cl-]', '氯化鈉':'[Na+].[Cl-]', 'ch4':'C', '甲烷':'C',
  'c2h6':'CC', '乙烷':'CC', 'c2h4':'C=C', '乙烯':'C=C',
  'c2h2':'C#C', '乙炔':'C#C', 'c2h6o':'CCO', '乙醇':'CCO', 'ethanol':'CCO',
  'c2h4o':'CC=O', '乙醛':'CC=O', 'c3h6o':'CC(C)=O', '丙酮':'CC(C)=O',
  'ch2o2':'C(=O)O', '甲酸':'C(=O)O', 'c2h4o2':'CC(=O)O', '乙酸':'CC(=O)O',
  'c3h8o3':'OCC(O)CO', '甘油':'OCC(O)CO', 'c4h8o2':'CCOC(C)=O', '乙酸乙酯':'CCOC(C)=O',
  'ch5n':'CN', '甲胺':'CN', 'c7h8':'Cc1ccccc1', '甲苯':'Cc1ccccc1',
  'c6h5cl':'Clc1ccccc1', '氯苯':'Clc1ccccc1', 'c6h6o':'Oc1ccccc1', '苯酚':'Oc1ccccc1',
  'ch4n2o':'NC(=O)N', '尿素':'NC(=O)N', 'c6h5no2':'[N+](=O)([O-])c1ccccc1', '硝基苯':'[N+](=O)([O-])c1ccccc1',
  'c6h6':'c1ccccc1', '苯':'c1ccccc1', 'benzene':'c1ccccc1'
};

function options() {
  const widthCm = Number(document.querySelector('#widthCm').value);
  const heightCm = Number(document.querySelector('#heightCm').value);
  if (![widthCm, heightCm].every(value => Number.isFinite(value) && value >= 1 && value <= 5)) {
    throw new Error('輸出寬高請設定為 1 至 5 cm。');
  }
  return {
    width: Math.round(widthCm * 118.11),
    height: Math.round(heightCm * 118.11),
    width_cm: widthCm,
    height_cm: heightCm,
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
    add_stereo_annotation: stereoAnnotations,
    condensed_formula: document.querySelector('#condensedInput').checked,
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
  renderButton.innerHTML = loading
    ? '<span aria-hidden="true">...</span> \u7de8\u8b6f\u4e2d\u2026'
    : '<span aria-hidden="true">&#9654;</span> \u7de8\u8b6f SVG';
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
function resolveStructure(value) {
  const input = String(value || '').trim();
  if (!input) return '';
  const key = input.toLowerCase().replace(/[₀₁₂₃₄₅₆₇₈₉]/g, digit => '₀₁₂₃₄₅₆₇₈₉'.indexOf(digit)).replace(/\s+/g, '');
  if (formulaAliases[key]) return formulaAliases[key];
  const item = gallery.find(entry =>
    [entry.name, entry.english, entry.smiles].some(label => String(label).toLowerCase() === key)
  );
  return item ? item.smiles : input;
}
async function render() {
  const sequence = ++renderSequence;
  setError('');
  setLoading(true);
  try {
    const structure = resolveStructure(structureInput.value);
    if (!structure) throw new Error('\u8acb\u5148\u8f38\u5165\u5316\u5b78\u5f0f\u6216\u4fd7\u540d');
    codeInput.value = itemCode({smiles: structure});
    const data = await drawMolecule(structure, options());
    if (sequence !== renderSequence) return false;
    baseSvg = data.svg;
    lastSvg = baseSvg;
    lastFormula = data.formula || data.smiles;
    lastSmiles = structure;
    lastRenderOptions = data.options;
    previewStage.innerHTML = lastSvg;
    document.querySelector('#flipHorizontal').setAttribute('aria-pressed', String(flipX));
    document.querySelector('#flipVertical').setAttribute('aria-pressed', String(flipY));
    document.querySelector('#metaFormula').textContent = data.formula;
    document.querySelector('#metaAtoms').textContent = '\u539f\u5b50\u6578 ' + data.atom_count;
    document.querySelector('#metaSize').textContent = `${data.options.width_cm.toFixed(2)} x ${data.options.height_cm.toFixed(2)} cm`;
    downloadButton.disabled = false;
    copyButton.disabled = false;
    return true;
  } catch (error) {
    if (sequence === renderSequence) setError(error.message);
    return false;
  } finally {
    if (sequence === renderSequence) setLoading(false);
  }
}
function loadCode(structure) { structureInput.value = structure; render(); }
function safeFilename(value, extension) {
  return String(value).replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '') + '.' + extension;
}
function svgForExport() {
  const doc = new DOMParser().parseFromString(lastSvg, 'image/svg+xml');
  const root = doc.documentElement;
  root.setAttribute('width', `${lastRenderOptions.width_cm}cm`);
  root.setAttribute('height', `${lastRenderOptions.height_cm}cm`);
  return new XMLSerializer().serializeToString(root);
}
let styleTimer = null;
function scheduleStyleRender() {
  clearTimeout(styleTimer);
  downloadButton.disabled = true;
  copyButton.disabled = true;
  styleTimer = setTimeout(render, 80);
}
function hydrateThumbnails(root) {
  root.querySelectorAll('[data-thumb-smiles]').forEach(async node => {
    try {
      const data = await drawMolecule(node.dataset.thumbSmiles, {width:220, height:150, transparent_background:true, use_element_colors:true});
      if (node.isConnected) node.innerHTML = data.svg;
    } catch { /* keep text fallback */ }
  });
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
    if (item) loadCode(item.smiles, item.name);
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
structureInput.addEventListener('input', () => {
  downloadButton.disabled = true;
  copyButton.disabled = true;
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
document.querySelectorAll('[data-stereo]').forEach(button => button.addEventListener('click', () => {
  stereoAnnotations = button.dataset.stereo === 'on';
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
let outputFormat = 'png';
function updateFormatLabels() {
  const png = outputFormat === 'png';
  copyButton.innerHTML = png ? '&#128203; 複製 PNG' : '&#128203; 複製 SVG';
  downloadButton.innerHTML = png ? '&#11015; 下載 PNG' : '&#11015; 下載 SVG';
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
  try { blob = await svgToPng(lastSvg, Number(document.querySelector('#dpiInput').value) / 300); }
  catch { toast('\u7121\u6cd5\u7522\u751f PNG'); return; }
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
      toast('SVG \u5df2\u8907\u88fd');
    } catch {
      toast('\u700f\u89bd\u5668\u4e0d\u652f\u63f4 SVG \u526a\u8cbc');
    }
    return;
  }
  try {
    const blob = await svgToPng(lastSvg, Number(document.querySelector('#dpiInput').value) / 300);
    await navigator.clipboard.write([new ClipboardItem({'image/png': blob})]);
    toast('PNG \u5df2\u8907\u88fd');
  } catch {
    toast('\u700f\u89bd\u5668\u4e0d\u652f\u63f4 PNG \u526a\u8cbc');
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
}
function openDrawer() {
  renderCategoryFilter();
  renderGallery();
  drawer.classList.add('open');
  backdrop.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
}
document.querySelector('#openGallery').addEventListener('click', openDrawer);
document.querySelector('#closeGallery').addEventListener('click', closeDrawer);
backdrop.addEventListener('click', closeDrawer);

structureInput.value = '';
document.querySelector('#dpiInput').value = '300';
updateFormatLabels();
checkHealth();
loadGallery();
