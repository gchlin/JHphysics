// RDKit runs in the browser. Keep the WASM local and show its download progress.
const WASM_SIZE_BYTES = 6913251;
const PIXELS_PER_CM = 300 / 2.54;
const STANDARD_BOND_CM = 0.508;
const loadingScreen = document.querySelector('#loadingScreen');
const loadingPhase = document.querySelector('#loadingPhase');
const loadingAmount = document.querySelector('#loadingAmount');
const wasmProgress = document.querySelector('#wasmProgress');

function showDownloadProgress(received) {
  const loaded = Math.min(received, WASM_SIZE_BYTES);
  wasmProgress.value = loaded;
  loadingAmount.textContent = `${(loaded / 1e6).toFixed(1)} / ${(WASM_SIZE_BYTES / 1e6).toFixed(1)} MB（${Math.round(loaded / WASM_SIZE_BYTES * 100)}%）`;
  if (loaded >= WASM_SIZE_BYTES) loadingPhase.textContent = '下載完成，正在初始化 RDKit…';
}

async function trackDownload(response) {
  const reader = response.body?.getReader();
  if (!reader) return showDownloadProgress((await response.arrayBuffer()).byteLength);
  let received = 0;
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    received += value.byteLength;
    showDownloadProgress(received);
  }
}

function loadRDKit() {
  if (typeof initRDKitModule !== 'function') return Promise.reject(new Error('無法載入 RDKit.js。'));
  let rejectLoad;
  const loadFailure = new Promise((_, reject) => { rejectLoad = reject; });
  const moduleReady = initRDKitModule({
    instantiateWasm(imports, receiveInstance) {
      (async () => {
        const response = await fetch('vendor/RDKit_minimal.wasm');
        if (!response.ok) throw new Error(`WASM 下載失敗（HTTP ${response.status}）`);
        const progressTask = trackDownload(response.clone());
        let result;
        try {
          result = typeof WebAssembly.instantiateStreaming === 'function'
            ? await WebAssembly.instantiateStreaming(response.clone(), imports)
            : await WebAssembly.instantiate(await response.clone().arrayBuffer(), imports);
        } catch {
          result = await WebAssembly.instantiate(await response.arrayBuffer(), imports);
        }
        await progressTask;
        receiveInstance(result.instance, result.module);
      })().catch(rejectLoad);
      return {};
    }
  });
  return Promise.race([moduleReady, loadFailure]);
}

const rdkitReady = loadRDKit();
rdkitReady.then(() => {
  loadingScreen.hidden = true;
  document.querySelector('#renderButton').disabled = false;
}, () => {
  loadingPhase.textContent = 'RDKit 載入失敗，請檢查網路後重試。';
  document.querySelector('#retryLoading').hidden = false;
});
document.querySelector('#retryLoading').addEventListener('click', () => location.reload());

const elementSymbols = [
  '', 'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne', 'Na', 'Mg',
  'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca', 'Sc', 'Ti', 'V', 'Cr', 'Mn',
  'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr', 'Rb',
  'Sr', 'Y', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In',
  'Sn', 'Sb', 'Te', 'I', 'Xe', 'Cs', 'Ba', 'La', 'Ce', 'Pr', 'Nd', 'Pm',
  'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu', 'Hf', 'Ta',
  'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg', 'Tl', 'Pb', 'Bi', 'Po', 'At',
  'Rn', 'Fr', 'Ra', 'Ac', 'Th', 'Pa', 'U', 'Np', 'Pu', 'Am', 'Cm', 'Bk',
  'Cf', 'Es', 'Fm', 'Md', 'No', 'Lr', 'Rf', 'Db', 'Sg', 'Bh', 'Hs', 'Mt',
  'Ds', 'Rg', 'Cn', 'Nh', 'Fl', 'Mc', 'Lv', 'Ts', 'Og'
];

function moleculeAtoms(mol) {
  const data = JSON.parse(mol.get_json());
  const defaults = data.defaults?.atom || {};
  return (data.molecules?.[0]?.atoms || []).map(atom => ({...defaults, ...atom}));
}

function moleculeFormula(atoms) {
  const counts = new Map();
  let charge = 0;
  for (const atom of atoms) {
    const symbol = elementSymbols[atom.z];
    if (!symbol) continue;
    counts.set(symbol, (counts.get(symbol) || 0) + 1);
    if (symbol !== 'H') counts.set('H', (counts.get('H') || 0) + (atom.impHs || 0));
    charge += atom.chg || 0;
  }
  const symbols = [...counts.keys()].filter(symbol => counts.get(symbol));
  symbols.sort((a, b) => {
    if (counts.has('C')) {
      if (a === 'C') return -1;
      if (b === 'C') return 1;
      if (a === 'H') return -1;
      if (b === 'H') return 1;
    }
    return a.localeCompare(b, 'en');
  });
  const formula = symbols.map(symbol => symbol + (counts.get(symbol) === 1 ? '' : counts.get(symbol))).join('');
  return formula + (charge ? (Math.abs(charge) === 1 ? '' : Math.abs(charge)) + (charge > 0 ? '+' : '-') : '');
}

function drawingOptions(atoms, options) {
  const details = {
    width: Math.max(240, Math.min(6000, options.width || 640)),
    height: Math.max(180, Math.min(6000, options.height || 420)),
    bondLineWidth: (options.bond_line_width || 1.4) * (options.size_mode === 'bond' ? options.scale_percent / 100 : 1),
    addAtomIndices: !!options.add_atom_indices,
    explicitMethyl: !options.show_hydrogens && !!(options.explicit_methyl || options.show_carbons),
    addStereoAnnotation: !!options.add_stereo_annotation,
    wedgeBonds: options.stereo_bond_mode !== 'labels',
    clearBackground: !options.transparent_background
  };
  if (options.size_mode === 'bond') {
    const scale = options.scale_percent / 100;
    details.fixedBondLength = STANDARD_BOND_CM * PIXELS_PER_CM * scale;
    details.minFontSize = Math.round(40 * scale);
    details.maxFontSize = Math.round(40 * scale);
  }
  const labels = {};
  atoms.forEach((atom, index) => {
    const isHetero = atom.z !== 6 && atom.z !== 1;
    const labelCarbon = atom.z === 6 && options.show_carbons;
    const hideHeteroHydrogen = options.hydrogen_mode === 'implicit' && isHetero && atom.impHs && !atom.chg;
    if (!(labelCarbon || hideHeteroHydrogen)) return;
    const symbol = elementSymbols[atom.z] || '*';
    const hydrogens = atom.impHs || 0;
    const showHydrogenLabel = !options.show_hydrogens && options.show_carbons;
    const charge = atom.chg || 0;
    const chargeLabel = charge ? `${Math.abs(charge) === 1 ? '' : Math.abs(charge)}${charge > 0 ? '+' : '-'}` : '';
    labels[index] = symbol + (showHydrogenLabel && hydrogens ? 'H' + (hydrogens === 1 ? '' : hydrogens) : '') + chargeLabel;
  });
  if (Object.keys(labels).length) details.atomLabels = labels;
  if (!options.use_element_colors) {
    details.atomColourPalette = Object.fromEntries(atoms.map(atom => [atom.z, [0, 0, 0]]));
  }
  return details;
}

// Transform molecule coordinates, then let RDKit redraw labels upright. A reflected
// 2D coordinate system needs the wedge bond sense inverted to keep the same CIP tags.
function transformedMolblock(molblock, options) {
  const rotation = ((options.rotation || 0) % 360 + 360) % 360;
  const mirrorX = !!options.flip_x;
  const mirrorY = !!options.flip_y;
  if (!rotation && !mirrorX && !mirrorY) return molblock;
  const lines = molblock.split('\n');
  const atomCount = Number(lines[3]?.slice(0, 3));
  const bondCount = Number(lines[3]?.slice(3, 6));
  if (!Number.isInteger(atomCount) || !Number.isInteger(bondCount)) throw new Error('無法處理此分子的座標格式。');
  const radians = rotation * Math.PI / 180;
  const cos = Math.round(Math.cos(radians));
  const sin = Math.round(Math.sin(radians));
  for (let index = 4; index < 4 + atomCount; index += 1) {
    const line = lines[index];
    const x = Number(line?.slice(0, 10));
    const y = Number(line?.slice(10, 20));
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('分子座標格式錯誤。');
    const rotatedX = cos * x - sin * y;
    const rotatedY = sin * x + cos * y;
    lines[index] = `${((mirrorX ? -1 : 1) * rotatedX).toFixed(4).padStart(10)}${((mirrorY ? -1 : 1) * rotatedY).toFixed(4).padStart(10)}${line.slice(20)}`;
  }
  if (mirrorX !== mirrorY) {
    for (let index = 4 + atomCount; index < 4 + atomCount + bondCount; index += 1) {
      const line = lines[index];
      const wedge = line?.slice(9, 12);
      const opposite = wedge === '  1' ? '  6' : wedge === '  6' ? '  1' : wedge;
      lines[index] = line.slice(0, 9) + opposite + line.slice(12);
    }
  }
  return lines.join('\n');
}

function sameStereo(before, after) {
  const normalized = value => JSON.stringify({
    atoms: (value.CIP_atoms || []).map(item => item.join(':')).sort(),
    bonds: (value.CIP_bonds || []).map(item => item.join(':')).sort()
  });
  return normalized(before) === normalized(after);
}

function moleculeBounds(molblock) {
  const lines = molblock.split('\n');
  const atomCount = Number(lines[3]?.slice(0, 3));
  const points = lines.slice(4, 4 + atomCount).map(line => [Number(line.slice(0, 10)), Number(line.slice(10, 20))]);
  if (!points.length || points.some(point => point.some(value => !Number.isFinite(value)))) return {width:0, height:0};
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  return {width:Math.max(...xs) - Math.min(...xs), height:Math.max(...ys) - Math.min(...ys)};
}

function fitSvgToArtwork(svg, sizing) {
  const root = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
  const originalStyle = root.getAttribute('style');
  root.setAttribute('style', 'position:absolute;left:-100000px;top:0;visibility:hidden;pointer-events:none');
  document.body.append(root);
  try {
    const boxes = [...root.querySelectorAll('path,polygon,ellipse,circle,line,text')]
      .filter(element => !element.closest('defs,clipPath'))
      .map(element => element.getBBox())
      .filter(box => [box.x, box.y, box.width, box.height].every(Number.isFinite));
    if (!boxes.length) throw new Error('無法計算分子圖的實際範圍。');
    const left = Math.min(...boxes.map(box => box.x));
    const top = Math.min(...boxes.map(box => box.y));
    const right = Math.max(...boxes.map(box => box.x + box.width));
    const bottom = Math.max(...boxes.map(box => box.y + box.height));
    const padding = sizing.mode === 'bond' ? Math.max(6, sizing.bondPx * 0.3)
      : Math.max(18, Math.min(right - left, bottom - top) * 0.06);
    const artWidth = right - left + padding * 2;
    const artHeight = bottom - top + padding * 2;
    const heightPx = sizing.mode === 'height' ? Math.round(sizing.heightCm * PIXELS_PER_CM) : Math.round(artHeight);
    const widthPx = sizing.mode === 'height' ? Math.round(heightPx * artWidth / artHeight) : Math.round(artWidth);
    root.setAttribute('viewBox', `${left - padding} ${top - padding} ${artWidth} ${artHeight}`);
    root.setAttribute('width', `${widthPx}px`);
    root.setAttribute('height', `${heightPx}px`);
    if (originalStyle === null) root.removeAttribute('style');
    else root.setAttribute('style', originalStyle);
    return {svg: new XMLSerializer().serializeToString(root), widthPx, heightPx};
  } finally {
    root.remove();
  }
}

async function drawMolecule(smiles, options = {}) {
  const rdkit = await rdkitReady;
  const mol = rdkit.get_mol(smiles);
  if (!mol) throw new Error('SMILES 無法解析，請檢查括號、鍵結與元素符號。');
  let transformed;
  try {
    const atoms = moleculeAtoms(mol);
    const formula = moleculeFormula(atoms);
    const descriptors = JSON.parse(mol.get_descriptors());
    const stereoTags = JSON.parse(mol.get_stereo_tags());
    if (options.show_hydrogens) mol.add_hs_in_place();
    mol.set_new_coords(!!options.use_coordgen);
    const molblock = transformedMolblock(mol.get_molblock(), options);
    const outputOptions = {...options};
    const bondPx = options.size_mode === 'bond' ? STANDARD_BOND_CM * PIXELS_PER_CM * options.scale_percent / 100 : 0;
    if (options.size_mode === 'bond') {
      const bounds = moleculeBounds(molblock);
      outputOptions.width = Math.ceil((bounds.width / 1.5 + 4) * bondPx);
      outputOptions.height = Math.ceil((bounds.height / 1.5 + 4) * bondPx);
      if (outputOptions.width > 6000 || outputOptions.height > 6000)
        throw new Error('此分子在所選鍵長下超過可繪製範圍，請降低比例。');
    } else if (options.size_mode === 'height') {
      outputOptions.width = 900;
      outputOptions.height = 900;
    }
    transformed = rdkit.get_mol(molblock);
    if (!transformed || !sameStereo(JSON.parse(mol.get_stereo_tags()), JSON.parse(transformed.get_stereo_tags()))) {
      throw new Error('旋轉或翻轉後立體組態無法驗證，已停止輸出。');
    }
    const rawSvg = transformed.get_svg_with_highlights(JSON.stringify(drawingOptions(atoms, outputOptions)));
    if (!rawSvg || !rawSvg.includes('<svg')) throw new Error('無法產生分子結構圖。');
    const fitted = options.size_mode ? fitSvgToArtwork(rawSvg, {
      mode: options.size_mode, heightCm: options.height_cm, bondPx
    }) : {svg:rawSvg};
    if (options.size_mode) {
      outputOptions.width = fitted.widthPx;
      outputOptions.height = fitted.heightPx;
      outputOptions.width_cm = Math.round(fitted.widthPx / PIXELS_PER_CM * 100) / 100;
      outputOptions.height_cm = options.size_mode === 'height' ? options.height_cm
        : Math.round(fitted.heightPx / PIXELS_PER_CM * 100) / 100;
    }
    return {svg: fitted.svg, formula, molecular_weight: descriptors.amw, stereo_tags: stereoTags, smiles, atom_count: mol.get_num_atoms(), options: outputOptions};
  } finally {
    if (transformed) transformed.delete();
    mol.delete();
  }
}

async function svgToPng(svg, widthCm, heightCm, dpi) {
  const source = new Blob([svg], {type: 'image/svg+xml;charset=utf-8'});
  const url = URL.createObjectURL(source);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    const pixelWidth = Math.round(widthCm / 2.54 * dpi);
    const pixelHeight = Math.round(heightCm / 2.54 * dpi);
    if (pixelWidth > 16000 || pixelHeight > 16000 || pixelWidth * pixelHeight > 80000000)
      throw new Error('PNG 尺寸過大，請縮小畫布或改用 300 DPI。');
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('無法產生 PNG。');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('無法產生 PNG。')), 'image/png'));
    return pngWithDpi(blob, dpi);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function pngWithDpi(blob, dpi) {
  const source = new Uint8Array(await blob.arrayBuffer());
  const pixelsPerMeter = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([112, 72, 89, 115], 4); // pHYs
  view.setUint32(8, pixelsPerMeter);
  view.setUint32(12, pixelsPerMeter);
  chunk[16] = 1;
  let crc = 0xffffffff;
  for (let index = 4; index < 17; index += 1) {
    crc ^= chunk[index];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  view.setUint32(17, (crc ^ 0xffffffff) >>> 0);
  const parts = [source.slice(0, 8)];
  const bytes = new DataView(source.buffer, source.byteOffset, source.byteLength);
  let offset = 8;
  let inserted = false;
  while (offset + 12 <= source.length) {
    const length = bytes.getUint32(offset);
    const next = offset + length + 12;
    if (next > source.length) throw new Error('PNG 資料不完整。');
    const type = String.fromCharCode(...source.slice(offset + 4, offset + 8));
    if (type !== 'pHYs') parts.push(source.slice(offset, next));
    if (type === 'IHDR') { parts.push(chunk); inserted = true; }
    offset = next;
  }
  if (!inserted) throw new Error('PNG 缺少 IHDR。');
  return new Blob(parts, {type:'image/png'});
}
