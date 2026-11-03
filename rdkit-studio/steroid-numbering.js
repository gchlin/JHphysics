// Cholestane numbering from IUPAC-IUB steroid nomenclature (3S-1.1).
// The query follows the carbon order of the PubChem cholesterol SMILES.
// Generic bonds allow the usual sterol double-bond variants.
const STEROL_QUERY = '[#6]~[#6](~[#6]~[#6]~[#6]~[#6](~[#6])~[#6])~[#6]1~[#6]~[#6]~[#6]2~[#6]~1(~[#6]~[#6]~[#6]1~[#6]~2~[#6]~[#6]~[#6]2~[#6]~1(~[#6]~[#6]~[#6]~[#6]~2)~[#6])~[#6]';
const STEROL_LOCANTS = [21, 20, 22, 23, 24, 25, 26, 27, 17, 16, 15, 14, 13, 12, 11, 9, 8, 7, 6, 5, 10, 1, 2, 3, 4, 19, 18];

function sterolAtomLabels(rdkit, mol) {
  const data = JSON.parse(mol.get_json());
  const molecule = data.molecules?.[0];
  const atoms = (molecule?.atoms || []).map(atom => ({...data.defaults?.atom, ...atom}));
  const bonds = molecule?.bonds || [];
  if (atoms.filter(atom => atom.z === 8).length !== 1 ||
      atoms.some(atom => atom.z !== 6 && atom.z !== 8) ||
      atoms.filter(atom => atom.z === 6).length < 27 ||
      atoms.filter(atom => atom.z === 6).length > 29) return null;

  const neighbors = atoms.map(() => []);
  bonds.forEach(bond => {
    const [a, b] = bond.atoms;
    neighbors[a].push(b);
    neighbors[b].push(a);
  });
  const query = rdkit.get_qmol(STEROL_QUERY);
  if (!query) return null;
  try {
    const matches = JSON.parse(mol.get_substruct_matches(query));
    for (const {atoms: match} of matches) {
      if (match.length !== STEROL_LOCANTS.length) continue;
      const c3 = match[23];
      const oxygen = neighbors[c3].find(index => atoms[index].z === 8 && atoms[index].impHs === 1);
      if (oxygen === undefined) continue;

      const labels = Object.fromEntries(match.map((index, i) => [index, `C${STEROL_LOCANTS[i]}`]));
      const unmatched = atoms.map((atom, index) => atom.z === 6 && !labels[index] ? index : -1)
        .filter(index => index !== -1);
      const c24 = match[4];
      if (unmatched.length) {
        const c28 = unmatched.find(index => neighbors[index].includes(c24));
        if (c28 === undefined) continue;
        labels[c28] = 'C28';
        if (unmatched.length === 2) {
          const c29 = unmatched.find(index => index !== c28 && neighbors[index].includes(c28));
          if (c29 === undefined) continue;
          labels[c29] = 'C29';
        }
      }
      if (Object.keys(labels).length === atoms.length - 1) return labels;
    }
    return null;
  } finally {
    query.delete();
  }
}

// Keep the original RDKit molecule for drawing. Re-parsing annotated CXSMILES
// can make RDKit choose different wedge bonds despite identical stereochemistry.
function svgWithSterolNumbers(mol, labels, options) {
  const indexOptions = {...options, addAtomIndices:true};
  const base = mol.get_svg_with_highlights(JSON.stringify(indexOptions));
  const positions = mol.get_svg_with_highlights(JSON.stringify({
    ...indexOptions, addStereoAnnotation:false, noFreetype:true
  }));
  const noteTags = [...positions.matchAll(/<text\b[^>]*class='note'[^>]*>\d+<\/text>/g)];
  let cursor = 0;
  const locants = Array.from({length:mol.get_num_atoms()}, (_, index) => {
    const digits = String(index);
    const group = noteTags.slice(cursor, cursor + digits.length).map(([tag]) => tag);
    cursor += digits.length;
    if (group.map(tag => tag.match(/>(\d+)<\/text>$/)?.[1]).join('') !== digits)
      throw new Error(`Cannot locate steroid atom index ${index} in RDKit SVG.`);
    const label = labels[index];
    return label ? group[0].replace(/>\d+<\/text>$/, `>${label.slice(1)}</text>`) : '';
  }).join('');
  if (options.addStereoAnnotation) {
    const unindexed = mol.get_svg_with_highlights(JSON.stringify({...options, addAtomIndices:false}));
    return unindexed.replace('</svg>', `${locants}</svg>`);
  }
  return base.replace(/<path class='note'[^>]*\/>/g, '')
    .replace('</svg>', `${locants}</svg>`);
}

if (typeof module !== 'undefined' && module.exports)
  module.exports = {sterolAtomLabels, svgWithSterolNumbers};
