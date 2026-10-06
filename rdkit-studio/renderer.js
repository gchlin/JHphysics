// Browser-side replacement for the local /api/render and /api/render-png endpoints.
const rdkitReady = typeof initRDKitModule === 'function'
  ? initRDKitModule()
  : Promise.reject(new Error('無法載入 RDKit.js，請檢查網路連線。'));

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
    width: Math.max(240, Math.min(1600, options.width || 640)),
    height: Math.max(180, Math.min(1200, options.height || 420)),
    bondLineWidth: options.bond_line_width || 1.4,
    addAtomIndices: !!options.add_atom_indices,
    explicitMethyl: !!(options.show_carbons || options.condensed_formula),
    clearBackground: !options.transparent_background
  };
  if (options.show_carbons || options.condensed_formula) {
    details.atomLabels = {};
    atoms.forEach((atom, index) => {
      if (atom.z === 6 || options.condensed_formula) {
        const symbol = elementSymbols[atom.z] || '*';
        const hydrogens = atom.impHs || 0;
        details.atomLabels[index] = symbol + (hydrogens ? 'H' + (hydrogens === 1 ? '' : hydrogens) : '');
      }
    });
  }
  if (!options.use_element_colors) {
    details.atomColourPalette = Object.fromEntries(atoms.map(atom => [atom.z, [0, 0, 0]]));
  }
  return details;
}

async function drawMolecule(smiles, options = {}) {
  const rdkit = await rdkitReady;
  const mol = rdkit.get_mol(smiles);
  if (!mol) throw new Error('SMILES 無法解析，請檢查括號、鍵結與元素符號。');
  try {
    const atoms = moleculeAtoms(mol);
    const formula = moleculeFormula(atoms);
    if (options.show_hydrogens) mol.add_hs_in_place();
    const svg = mol.get_svg_with_highlights(JSON.stringify(drawingOptions(atoms, options)));
    if (!svg || !svg.includes('<svg')) throw new Error('無法產生分子結構圖。');
    return {svg, formula, smiles, atom_count: mol.get_num_atoms(), options};
  } finally {
    mol.delete();
  }
}

async function svgToPng(svg) {
  const source = new Blob([svg], {type: 'image/svg+xml;charset=utf-8'});
  const url = URL.createObjectURL(source);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('無法產生 PNG。');
    context.drawImage(image, 0, 0);
    return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('無法產生 PNG。')), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}
