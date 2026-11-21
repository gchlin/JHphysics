// Ring labels are teaching annotations, not IUPAC atom locants.
(function(root) {
  const ns = 'http://www.w3.org/2000/svg';
  function geometry(svg, rings) {
    const centers = new Map([...svg.querySelectorAll('ellipse')].flatMap(node => {
      const id=(node.getAttribute('class')||'').match(/\batom-(\d+)\b/);
      return id ? [[Number(id[1]),{x:Number(node.getAttribute('cx')),y:Number(node.getAttribute('cy'))}]] : [];
    }));
    return rings.flatMap(atoms => {
      const points=atoms.map(id=>centers.get(id));
      if(points.some(p=>!p)) return [];
      const x=points.reduce((n,p)=>n+p.x,0)/points.length;
      const y=points.reduce((n,p)=>n+p.y,0)/points.length;
      const radius=Math.min(...points.map(p=>Math.hypot(p.x-x,p.y-y)));
      return [{id:atoms.slice().sort((a,b)=>a-b).join('-'),x,y,radius}];
    });
  }
  function addLabels(svg, rings, labels, size = 'small') {
    for(const ring of geometry(svg,rings)) {
      if(!labels[ring.id]) continue;
      const text=document.createElementNS(ns,'text');
      text.setAttribute('x',ring.x);text.setAttribute('y',ring.y);
      text.setAttribute('text-anchor','middle');text.setAttribute('dominant-baseline','central');
      text.setAttribute('data-ring-label',ring.id);
      const scale = {small:1, medium:2, large:2.5}[size] || 1;
      text.setAttribute('style',`font:600 ${Math.max(8,ring.radius*.3)*scale}px sans-serif;fill:#172b3a;stroke:white;stroke-width:2;paint-order:stroke`);
      text.textContent=labels[ring.id];svg.append(text);
    }
  }
  function addTargets(svg,rings) {
    const group=document.createElementNS(ns,'g');group.setAttribute('data-ring-overlay','true');
    for(const ring of geometry(svg,rings)) {
      const target=document.createElementNS(ns,'circle');
      for(const [key,value] of Object.entries({cx:ring.x,cy:ring.y,r:Math.max(10,ring.radius*.38),'data-ring-target':ring.id,tabindex:0,role:'button','aria-label':'設定此環的標記'})) target.setAttribute(key,value);
      target.setAttribute('style','fill:#e9f4f088;stroke:#277361;stroke-width:1.5;stroke-dasharray:3 2;cursor:pointer');
      group.append(target);
    }
    svg.append(group);
  }
  root.RingAnnotations={geometry,addLabels,addTargets};
})(globalThis);
