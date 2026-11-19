// Pure RDKit-backed selection helpers. Matches are atom/bond indices in the
// caller's molecule; query molecules are always released after use.
(function (root) {
  const ELEMENTS = 'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' ');
  // Taiwan-standard element names (國立編譯館 / 教育部 usage). Unknown symbols fall back to the symbol alone.
  const ELEMENT_ZH = {H:'氫',He:'氦',Li:'鋰',Be:'鈹',B:'硼',C:'碳',N:'氮',O:'氧',F:'氟',Ne:'氖',Na:'鈉',Mg:'鎂',Al:'鋁',Si:'矽',P:'磷',S:'硫',Cl:'氯',Ar:'氬',K:'鉀',Ca:'鈣',Sc:'鈧',Ti:'鈦',V:'釩',Cr:'鉻',Mn:'錳',Fe:'鐵',Co:'鈷',Ni:'鎳',Cu:'銅',Zn:'鋅',Ga:'鎵',Ge:'鍺',As:'砷',Se:'硒',Br:'溴',Kr:'氪',Rb:'銣',Sr:'鍶',Y:'釔',Zr:'鋯',Nb:'鈮',Mo:'鉬',Tc:'鍀',Ru:'釕',Rh:'銠',Pd:'鈀',Ag:'銀',Cd:'鎘',In:'銦',Sn:'錫',Sb:'銻',Te:'碲',I:'碘',Xe:'氙',Cs:'銫',Ba:'鋇',La:'鑭',Ce:'鈰',Pr:'鐠',Nd:'釹',Pm:'鉕',Sm:'釤',Eu:'銪',Gd:'釓',Tb:'鋱',Dy:'鏑',Ho:'鈥',Er:'鉺',Tm:'銩',Yb:'鐿',Lu:'鎦',Hf:'鉿',Ta:'鉭',W:'鎢',Re:'錸',Os:'鋨',Ir:'銥',Pt:'鉑',Au:'金',Hg:'汞',Tl:'鉈',Pb:'鉛',Bi:'鉍',Po:'釙',At:'砈',Rn:'氡',Fr:'鈁',Ra:'鐳',Ac:'錒',Th:'釷',Pa:'鏷',U:'鈾',Np:'錼',Pu:'鈈',Am:'鋂',Cm:'鋦',Bk:'錇',Cf:'鉲',Es:'鑀',Fm:'鐨',Md:'鍆',No:'鍩',Lr:'鐒'};
  function elementName(symbol) { return ELEMENT_ZH[symbol] || ''; }
  const GROUPS = [
    {id:'alcohol', zh:'醇（羥基）', label:'Alcohol', smarts:'[OX2H][CX4]'},
    {id:'phenol', zh:'酚', label:'Phenol', smarts:'[OX2H][c]'},
    {id:'aldehyde', zh:'醛', label:'Aldehyde', smarts:'[CX3H1](=O)[#6]'},
    {id:'ketone', zh:'酮', label:'Ketone', smarts:'[#6][CX3](=O)[#6]'},
    {id:'carboxylic-acid', zh:'羧酸', label:'Carboxylic acid', smarts:'[CX3](=O)[OX2H1]'},
    {id:'ester', zh:'酯', label:'Ester', smarts:'[CX3](=O)[OX2][#6]'},
    {id:'amide', zh:'醯胺', label:'Amide', smarts:'[CX3](=O)[NX3]'},
    {id:'amine', zh:'胺', label:'Amine', smarts:'[NX3;!$(N-C=O)]'}
  ];

  function moleculeData(mol) {
    const parsed = JSON.parse(mol.get_json());
    const data = parsed.molecules && parsed.molecules[0];
    if (!data) throw new Error('RDKit returned no molecule data.');
    return {atoms:(data.atoms || []).map(atom => ({...parsed.defaults?.atom, ...atom})), bonds:data.bonds || []};
  }

  function getElementMatches(mol) {
    const {atoms} = moleculeData(mol);
    return ELEMENTS.flatMap((symbol, z) => {
      const indices = atoms.flatMap((atom, index) => atom.z === z + 1 ? [index] : []);
      return indices.length ? [{id:symbol, label:symbol, atoms:indices, bonds:[]}] : [];
    });
  }

  function getFunctionalGroupMatches(rdkit, mol) {
    const molecule = moleculeData(mol);
    return GROUPS.map(group => {
      const query = rdkit.get_qmol(group.smarts);
      if (!query) return {...group, matches:[]};
      try {
        const parsedMatches = JSON.parse(mol.get_substruct_matches(query));
        const rawMatches = Array.isArray(parsedMatches) ? parsedMatches : Object.values(parsedMatches || {});
        const seen = new Set();
        const matches = [];
        for (const match of rawMatches) {
          const atomIndices = [...new Set(match.atoms)].sort((a,b) => a-b);
          const key = atomIndices.join(',');
          if (seen.has(key)) continue;
          seen.add(key);
          const atomSet = new Set(atomIndices);
          const bonds = molecule.bonds.flatMap((bond, index) => bond.atoms.every(atom => atomSet.has(atom)) ? [index] : []);
          matches.push({atoms:atomIndices, bonds});
        }
        return {id:group.id, zh:group.zh, label:group.label, matches};
      } finally { query.delete(); }
    });
  }

  const api = {getElementMatches, getFunctionalGroupMatches, elementName};
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HighlightSelection = api;
})(typeof globalThis === 'object' ? globalThis : this);
