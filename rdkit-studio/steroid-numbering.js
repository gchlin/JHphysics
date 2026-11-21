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
function svgWithNumberLabels(mol, labels, options, size = 'small', keepPrefix = false) {
  // Ask RDKit for the preferred annotation direction, then place our actual
  // text against the final drawing (including its R/S and E/Z annotations).
  // This keeps the original molecule and its wedge-bond choices intact.
  const atomIds = Array.from({length:mol.get_num_atoms()}, (_, i)=>i);
  const geometryOptions = {...options, noFreetype:true, standardColoursForHighlightedAtoms:true, atoms:atomIds,
    highlightAtomColors:Object.fromEntries(atomIds.map(i=>[i,[0,0,0,0]]))};
  const positions = mol.get_svg_with_highlights(JSON.stringify({
    ...geometryOptions, addAtomIndices:true, addStereoAnnotation:false
  }));
  const base = mol.get_svg_with_highlights(JSON.stringify({...geometryOptions, addAtomIndices:false}));
  const centers = svg => new Map([...svg.matchAll(/<ellipse\b[^>]*>/g)].flatMap(([tag])=>{
    const id = tag.match(/class='[^']*\batom-(\d+)\b/)?.[1];
    const x = Number(tag.match(/\bcx='([\d.eE+-]+)'/)?.[1]);
    const y = Number(tag.match(/\bcy='([\d.eE+-]+)'/)?.[1]);
    return id !== undefined && Number.isFinite(x) && Number.isFinite(y) ? [[Number(id),{x,y}]] : [];
  }));
  const referenceCenters = centers(positions), finalCenters = centers(base);
  if (finalCenters.size !== atomIds.length || referenceCenters.size !== atomIds.length)
    throw new Error('Cannot locate atoms for numbering layout.');
  const graph = JSON.parse(mol.get_json()).molecules[0];
  const bondLength = points => {
    const lengths = graph.bonds.map(({atoms:[a,b]})=>Math.hypot(points.get(a).x-points.get(b).x,points.get(a).y-points.get(b).y)).sort((a,b)=>a-b);
    return lengths[Math.floor(lengths.length/2)] || 24;
  };
  const finalBond = bondLength(finalCenters), scale = finalBond / bondLength(referenceCenters);
  const noteTags = [...positions.matchAll(/<text\b[^>]*class='note'[^>]*>\d+<\/text>/g)];
  const noteFont = Number(noteTags[0]?.[0].match(/font-size:([\d.]+)px/)?.[1]);
  const elementFont = Math.max(0,...[...base.matchAll(/<text\b[^>]*class='atom-\d+'[^>]*font-size:([\d.]+)px/g)].map(m=>Number(m[1]))) || noteFont * scale * 2;
  if (!Number.isFinite(noteFont) || !Number.isFinite(elementFont))
    throw new Error('Cannot determine RDKit annotation font size.');
  // Teaching presets from the reference artwork: handout half-size, slides
  // full-size. These are visual proportions, not a nomenclature standard.
  const fontSize = Math.round(elementFont * ({small:0.5, medium:1, large:1.25}[size] || 0.5) * 10) / 10;
  const widthOf = (text,font) => [...text].reduce((sum,ch)=>sum+(/[il1.,'()]/.test(ch)?0.36:/[^\x00-\x7f]/.test(ch)?1:0.67)*font,0);
  const box = (x,y,width,font,pad=0) => ({left:x-pad,right:x+width+pad,top:y-font-pad,bottom:y+font*0.22+pad});
  const obstacles = [...base.matchAll(/<text\b[^>]*>[\s\S]*?<\/text>/g)].flatMap(([tag])=>{
    const x=Number(tag.match(/\bx='([\d.eE+-]+)'/)?.[1]), y=Number(tag.match(/\by='([\d.eE+-]+)'/)?.[1]);
    const font=Number(tag.match(/font-size:([\d.]+)px/)?.[1]);
    if (![x,y,font].every(Number.isFinite)) return [];
    const text=tag.replace(/<[^>]*>/g,'').replace(/&[^;]+;/g,'M');
    return [box(x,y,widthOf(text,font),font,fontSize*0.16)];
  });
  const segments = [...base.matchAll(/<path\b[^>]*>/g)].flatMap(([tag])=>{
    if (!/class='[^']*\bbond-\d+/.test(tag)) return [];
    const d=tag.match(/\bd='([^']+)'/)?.[1] || '';
    const lines=[]; let previous;
    for (const m of d.matchAll(/([ML])\s*([\d.eE+-]+)[,\s]+([\d.eE+-]+)/g)) {
      const point={x:Number(m[2]),y:Number(m[3])};
      if (m[1]==='L' && previous) lines.push([previous,point]);
      previous=point;
    }
    return lines;
  });
  const overlaps = (a,b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const crosses = (rect,[a,b]) => {
    let low=0,high=1;
    for (const [start,delta,min,max] of [[a.x,b.x-a.x,rect.left,rect.right],[a.y,b.y-a.y,rect.top,rect.bottom]]) {
      if (Math.abs(delta)<1e-8) {if (start<min || start>max) return false;}
      else {const t1=(min-start)/delta,t2=(max-start)/delta; low=Math.max(low,Math.min(t1,t2));high=Math.min(high,Math.max(t1,t2));if(low>high)return false;}
    }
    return true;
  };
  let cursor = 0;
  const locants = Array.from({length:mol.get_num_atoms()}, (_, index) => {
    const digits = String(index);
    const group = noteTags.slice(cursor, cursor + digits.length).map(([tag]) => tag);
    cursor += digits.length;
    if (group.map(tag => tag.match(/>(\d+)<\/text>$/)?.[1]).join('') !== digits)
      throw new Error(`Cannot locate steroid atom index ${index} in RDKit SVG.`);
    const value = labels ? (keepPrefix ? labels[index] : labels[index]?.slice(1)) : digits;
    if (!value) return '';
    const first = group[0];
    const oldX = Number(first.match(/\bx='([\d.-]+)'/)?.[1]);
    const oldY = Number(first.match(/\by='([\d.-]+)'/)?.[1]);
    if (!Number.isFinite(oldX) || !Number.isFinite(oldY))
      throw new Error(`Cannot locate steroid atom index ${index} in RDKit SVG.`);
    const reference = referenceCenters.get(index), center = finalCenters.get(index);
    const width = widthOf(value,fontSize);
    const nativeX = center.x+(oldX+digits.length*noteFont*0.29-reference.x)*scale;
    const nativeY = center.y+(oldY-noteFont*0.35-reference.y)*scale;
    const nativeAngle = Math.atan2(nativeY-center.y,nativeX-center.x);
    const nativeRadius = Math.hypot(nativeX-center.x,nativeY-center.y);
    const preferredRadius = Math.max(fontSize*0.7,Math.min(nativeRadius,finalBond*(size==='small'?0.24:0.36)));
    const gap = Math.max(fontSize*0.2,finalBond*0.035);
    let best;
    // Search nearby sectors first, with a radius tied to the text and bond size.
    // Penalize collisions before distance; no global displacement of the drawing.
    const offsets = [0,1,-1,2,-2,3,-3,4,-4,5,-5,6,-6,7,-7,8];
    const radii = [preferredRadius,Math.max(preferredRadius,fontSize*1.25),Math.max(preferredRadius,fontSize*1.7),Math.max(preferredRadius,fontSize*2.2,finalBond*0.65)];
    for (const radius of radii) for (const offset of offsets) {
      const angle=nativeAngle+offset*Math.PI/8;
      const x=center.x+Math.cos(angle)*radius-width/2, y=center.y+Math.sin(angle)*radius+fontSize*0.39;
      const bounds=box(x,y,width,fontSize,gap);
      const collisions=obstacles.filter(other=>overlaps(bounds,other)).length*4+segments.filter(line=>crosses(bounds,line)).length;
      const ownAtom=box(center.x-fontSize*0.15,center.y+fontSize*0.15,fontSize*0.3,fontSize*0.3);
      const score=(collisions+(overlaps(bounds,ownAtom)?4:0))*100000+radius+Math.abs(offset)*fontSize*0.08;
      if (!best || score<best.score) best={x,y,bounds,score};
    }
    const {x,y} = best;
    obstacles.push(best.bounds);
    const safeValue = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return first.replace('<text ', keepPrefix ? `<text data-numbering-atom='${index}' ` : '<text ')
      .replace(/\bx='[\d.-]+'/, `x='${x.toFixed(1)}'`)
      .replace(/\by='[\d.-]+'/, `y='${y.toFixed(1)}'`)
      .replace(/font-size:[\d.]+px/, `font-size:${fontSize}px`)
      .replace(/>\d+<\/text>$/, () => `>${safeValue}</text>`);
  }).join('');
  return base.replace('</svg>', `${locants}</svg>`);
}

function svgWithSterolNumbers(mol, labels, options, size = 'small') {
  return svgWithNumberLabels(mol, labels, options, size);
}

if (typeof module !== 'undefined' && module.exports)
  module.exports = {sterolAtomLabels, svgWithNumberLabels, svgWithSterolNumbers};
