// Explicit educational equations only: this module never predicts products.
(function (root) {
  'use strict';
  const items = [
    {id:'rxn-hydrogenation', name:'乙烯加氫', reaction_smiles:'C=C.[H][H]>>CC', category:'加成', description:'碳碳雙鍵加成氫，形成乙烷。', conditions:'H₂；Ni 催化並加熱。'},
    {id:'rxn-bromination', name:'乙烯與溴加成', reaction_smiles:'C=C.BrBr>>BrCCBr', category:'加成', description:'雙鍵加成 Br₂，形成 1,2-二溴乙烷。', conditions:'Br₂；避光、室溫，非自由基條件。'},
    {id:'rxn-hydration', name:'乙烯水合', reaction_smiles:'C=C.O>>CCO', category:'加成', description:'乙烯與水生成乙醇。', conditions:'磷酸催化；高溫、高壓水蒸氣。'},
    {id:'rxn-substitution', name:'溴乙烷的親核取代', reaction_smiles:'CCBr.[OH-]>>CCO.[Br-]', category:'取代', description:'OH⁻ 取代溴，形成乙醇；以淨離子式表示。', conditions:'稀 NaOH 水溶液，加熱；避免以醇作主要溶劑。'},
    {id:'rxn-esterification', name:'乙酸與乙醇酯化', reaction_smiles:'CC(=O)O.CCO>>CC(=O)OCC.O', category:'酯化', description:'形成乙酸乙酯與水；此反應可逆。', conditions:'少量濃硫酸催化、加熱；移除水有助提高酯產率。'},
    {id:'rxn-hydrolysis', name:'乙酸乙酯酸性水解', reaction_smiles:'CC(=O)OCC.O>>CC(=O)O.CCO', category:'水解', description:'酯與水生成乙酸、乙醇；此反應可逆。', conditions:'稀酸催化，加熱回流並使用過量水。'},
    {id:'rxn-oxidation', name:'乙醇氧化成乙酸', reaction_smiles:'CCO.O=O>>CC(=O)O.O', category:'氧化', description:'乙醇被氧化成乙酸，氧氣被還原成水。', conditions:'醋酸菌、有氧條件；示意整體反應，非單一步驟機構。'},
    {id:'rxn-reduction', name:'乙醛加氫還原', reaction_smiles:'CC=O.[H][H]>>CCO', category:'還原', description:'醛基還原為一級醇。', conditions:'H₂；Ni 催化，適當加熱與加壓。'},
    {id:'rxn-elimination', name:'乙醇脫水成乙烯', reaction_smiles:'CCO>>C=C.O', category:'消去', description:'乙醇脫去水，生成乙烯。', conditions:'濃硫酸，約 170 °C；較低溫可能偏向生成乙醚。'},
    {id:'rxn-neutralization', name:'乙酸與氫氧化鈉中和', reaction_smiles:'CC(=O)O.[Na+].[OH-]>>CC(=O)[O-].[Na+].O', category:'酸鹼', description:'乙酸失去質子形成乙酸根，同時生成水。', conditions:'NaOH 水溶液；Na⁺ 為旁觀離子。'}
  ].map(item => Object.freeze(item));
  const ReactionExamples = Object.freeze({items:Object.freeze(items)});

  async function drawReaction(reactionSmiles, options = {}, rdkitInstance) {
    if (typeof reactionSmiles !== 'string' || reactionSmiles.split('>').length !== 3 ||
        !reactionSmiles.split('>')[0].trim() || !reactionSmiles.split('>')[2].trim())
      throw new Error('請提供完整反應 SMILES，包含明確的反應物與產物。');
    const rdkit = rdkitInstance || (typeof rdkitReady !== 'undefined' ? await rdkitReady : null);
    if (!rdkit) throw new Error('RDKit 尚未就緒。');
    const dimension = (value, fallback, minimum) => {
      const number = Number(value ?? fallback);
      if (!Number.isFinite(number) || number < minimum || number > 6000)
        throw new Error(`反應圖尺寸須介於 ${minimum} 與 6000 像素。`);
      return Math.round(number);
    };
    const width = dimension(options.width, 1100, 180), height = dimension(options.height, 320, 180);
    const lineWidth = Number(options.bond_line_width ?? 1.4);
    if (!Number.isFinite(lineWidth) || lineWidth <= 0 || lineWidth > 10)
      throw new Error('鍵線寬度須大於 0 且不超過 10。');
    const drawOptions = {width, height, bondLineWidth:lineWidth,
      clearBackground:!options.transparent_background, highlightByReactant:false};
    if (!options.use_element_colors)
      drawOptions.atomColourPalette = Object.fromEntries(Array.from({length:119}, (_, z) => [z, [0, 0, 0]]));
    let reaction;
    try {
      reaction = rdkit.get_rxn(reactionSmiles, JSON.stringify({useSmiles:true}));
      if (!reaction) throw new Error('無法解析反應 SMILES。');
      const svg = reaction.get_svg_with_highlights(JSON.stringify(drawOptions));
      if (!svg || !svg.includes('<svg')) throw new Error('無法繪製反應式。');
      const fitted = options.size_mode && typeof fitSvgToArtwork === 'function'
        ? fitSvgToArtwork(svg, {mode:options.size_mode, heightCm:options.height_cm || 5,
            bondPx:0.508 * (300 / 2.54) * (options.scale_percent || 100) / 100})
        : {svg, widthPx:width, heightPx:height};
      return {svg:fitted.svg, reaction_smiles:reactionSmiles, is_reaction:true,
        options:{...options, width:fitted.widthPx, height:fitted.heightPx,
          width_cm:fitted.widthPx / (300 / 2.54), height_cm:fitted.heightPx / (300 / 2.54)}};
    } catch (error) {
      throw new Error(typeof error?.message === 'string' ? error.message : '無法解析或繪製反應 SMILES。');
    } finally { reaction?.delete(); }
  }

  root.ReactionExamples = ReactionExamples;
  root.drawReaction = drawReaction;
  if (typeof module !== 'undefined' && module.exports) module.exports = {ReactionExamples, drawReaction};
})(typeof window !== 'undefined' ? window : globalThis);
