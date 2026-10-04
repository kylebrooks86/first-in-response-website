(()=>{
  if(window.__fireV18LiveIndexParity)return;window.__fireV18LiveIndexParity=true;
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const products=[
    {icon:'🧪',name:'Sodium hypochlorite (SH)',sub:'Organic-growth oxidizer',rows:[
      ['best','Algae, mildew, mold and moss','Exterior siding, roofs, concrete and other compatible washable surfaces.'],
      ['good','Vinyl fences, trash bins and organic gutter growth','Use the surface-specific strength calculator and rinse thoroughly.'],
      ['good','Concrete pre/post-treatment','Best for organic staining—not oil, rust or mineral deposits.'],
      ['test','Wood, composite, stucco, EIFS, painted or oxidized aluminum','Start weak and test for lightening, oxidation or coating damage.'],
      ['avoid','Rust, battery acid, grease, oil, hard-water scale and efflorescence','Wrong chemistry for these stains.'],
      ['avoid','Vehicles, polished metal, glass spot-cleaning and AC coils','High damage or corrosion risk; use a purpose-made cleaner.'],
      ['avoid','Any acid, ammonia, F9 BARC or unknown product','Dangerous incompatibility—never mix.']
    ]},
    {icon:'🍋',name:'Elemonator',sub:'Bleach-stable SH surfactant',rows:[
      ['best','House-wash and roof-wash SH batches','Adds wetting and cling; use the current product rate.'],
      ['good','Vertical siding, fences and steep roof work','Helps solution stay on the surface longer.'],
      ['test','Lower-than-label dosage','Can reduce rinse time when less cling is needed.'],
      ['avoid','Using it as the main stain remover','It supports SH; it does not replace the chemistry needed for rust, oil or minerals.']
    ]},
    {icon:'🪟',name:'Ettore Squeegee-Off',sub:'Glass cleaner concentrate',rows:[
      ['best','Exterior window and glass cleaning','Designed for scrubber-and-squeegee work at 1–2 fl oz per gallon.'],
      ['good','Routine window maintenance','Useful when slip and clean squeegee pulls matter.'],
      ['test','Light frame and sill dirt','Test finishes and rinse residue; oxidation needs a separate process.'],
      ['avoid','Organic roof/siding treatment, rust or heavy grease','Not the right primary cleaner.'],
      ['avoid','Mixing into SH, acids or other chemical tanks','Use a clean window bucket.']
    ]},
    {icon:'💧',name:'Dawn dish soap',sub:'Grease-cutting surfactant',rows:[
      ['best','Light grease on compatible washable surfaces','P&G positions Dawn for grease removal.'],
      ['good','Windows, washable equipment, trash receptacles and tile walls','P&G Professional lists these as task areas; use sparingly and rinse well.'],
      ['test','Window bucket, frames, bins and greasy tools','Start with very little to avoid residue.'],
      ['test','Vehicle or RV spot cleaning','Only after checking the finish manufacturer; it may remove wax or protection.'],
      ['avoid','Bleach/SH surfactant or long-term tank mix','Use bleach-stable Elemonator instead.'],
      ['avoid','Unrinsed siding or glass','Excess suds can leave film.']
    ]},
    {icon:'🟢',name:'Simple Green Pro HD',sub:'Heavy-duty cleaner / degreaser',rows:[
      ['best','Oil, grease, grime and general soils','Concrete pre-cleaning, equipment, parts and other compatible hard surfaces.'],
      ['good','Trash bins, washable siding and non-organic concrete dirt','Use the label’s heavy, medium or light dilution and rinse.'],
      ['test','Paint, aluminum, sealed pavers, vehicle parts and delicate finishes','Spot-test for discoloration or coating reaction.'],
      ['avoid','SH, acids or other mixed-chemical batches','Use separately and follow the label.'],
      ['avoid','Rust, fertilizer stains, battery acid and living organic growth','A more specific chemistry is usually better.']
    ]},
    {icon:'🧽',name:'Krud Kutter Original',sub:'Cleaner / degreaser / stain remover',rows:[
      ['best','Heavy grease, oil, grime and stubborn washable-surface stains','Use label dilution or full strength only where the label allows.'],
      ['good','Siding, bins, tools, equipment and concrete spot cleaning','Rinse fully and protect finishes.'],
      ['test','Paint, aluminum, coatings, vehicle surfaces and window frames','Always test an inconspicuous spot first.'],
      ['avoid','Mixing with any other chemical','The manufacturer specifically says not to mix it with other chemicals.'],
      ['avoid','Using it as a roof/house SH substitute or rust remover','Choose chemistry matched to the stain.']
    ]},
    {icon:'✨',name:'LA’s Totally Awesome',sub:'All-purpose cleaner / degreaser',rows:[
      ['best','General dirt, grime, grease and spot cleaning','Use on compatible washable surfaces at the bottle’s task dilution.'],
      ['good','Trash bins, washable equipment, siding spot-cleaning and general cleanup','Start diluted and rinse well.'],
      ['test','Gutter tiger stripes and exterior oxidation','Field-use possibility only: brush a tiny test area and watch for paint removal or unevenness.'],
      ['test','Cars, trailers, RV surfaces and painted metal','The brand lists broad washable-surface uses, but finishes vary widely.'],
      ['avoid','Combining with SH in one sprayer','Keep it separate.'],
      ['avoid','Glass without a careful test and complete rinse','Residue or finish effects are possible.']
    ]},
    {icon:'🧱',name:'F9 BARC',sub:'Acidic rust / oxidation-restoration cleaner',rows:[
      ['best','Concrete rust, fertilizer stains and orange battery-acid staining','Use the F9 concrete process and correct porous-surface ratio.'],
      ['good','Rust on brick, pavers, tile, stone, vinyl and compatible nonporous surfaces','Select the substrate-specific dilution and follow dwell/rinse directions.'],
      ['test','Painted metal, aluminum, stainless, coatings, stucco and asphalt','F9 allows certain applications, but a compatibility test is mandatory.'],
      ['avoid','Glass','Manufacturer says do not use on glass.'],
      ['avoid','SH, bleach, ammonia or unknown products','Dedicated acid-rated sprayer; never mix.'],
      ['avoid','Grease, oil, algae, mildew or routine vehicle washing','Use the cleaner matched to those soils.']
    ]},
    {icon:'🏠',name:'Gutter Zap — Black Streak Gutter Cleaner',sub:'Caustic gutter stain / tiger-stripe remover',rows:[
      ['best','Black streaks and tiger striping on compatible exterior aluminum gutters','Use 3:1 water to product as a starting mix or 1:1 for heavy staining; brush lightly and rinse before it dries.'],
      ['good','Heavy grime on compatible gutter exteriors','Work in small, cool sections and rinse the gutter, glass, siding and plants completely.'],
      ['test','Painted gutters, oxidized coatings and aluminum siding','Test a hidden spot first; strong alkaline cleaner can change paint or create uneven finish.'],
      ['avoid','Glass, vehicle finishes, sensitive bare metal and direct plant contact','Caustic overspray can etch or damage surrounding materials.'],
      ['avoid','SH, acids or any other chemical in the same sprayer','Keep it completely separate and use label-required PPE.']
    ]},
    {icon:'💎',name:'Bio-Clean Hard Water Stain Remover',sub:'Ready-to-use mineral-deposit paste',rows:[
      ['best','Hard-water spots, calcium deposits and soap scum','Use directly on compatible glass, shower doors, windows, tile and porcelain.'],
      ['good','Stainless steel, fiberglass, Corian, hard vinyl, brass, aluminum and boats','The manufacturer lists these surfaces; remove grit and spot-test before broad use.'],
      ['test','Tinted or coated glass, polished stone, paint and soft finishes','The paste is mildly abrasive, so confirm finish compatibility in a hidden area.'],
      ['avoid','House-wash, roof-wash or batch-sprayer use','It is a ready-to-use paste, not a broadcast cleaner.'],
      ['avoid','Mixing with SH, acids or another chemical','Use separately, rinse residue fully and dry the surface.'],
      ['avoid','Rubbing over loose dirt or grit','Pre-clean first so trapped debris does not scratch.']
    ]},
    {icon:'🌬️',name:'OdoBan Disinfectant and Odor Eliminator',sub:'Concentrated odor eliminator / disinfectant',rows:[
      ['best','Smoke, musty and pet odors on label-compatible surfaces','Use the odor-specific label rate: 22 oz per gallon for strong deodorizing or 32 oz per gallon for pet odors.'],
      ['good','Pre-cleaned hard nonporous surface disinfection','Use the label rate and keep the surface visibly wet for the full required contact time.'],
      ['good','Odor control in cleaned trash bins and compatible washable areas','Remove soil first, test the surface and follow label ventilation and rinse directions.'],
      ['test','Fabric, upholstery, vehicle interiors and outdoor materials','Check the label and spot-test for colorfastness before broad application.'],
      ['avoid','SH, acids or any other mixed-chemical batch','Use alone; mixing cleaners can create hazardous reactions.'],
      ['avoid','Roof, siding or concrete stain removal','It is not a substitute for SH, degreaser, rust remover or mineral remover.'],
      ['avoid','Calling a deodorizer mix a disinfectant','Disinfection requires the correct surface, dilution, pre-cleaning and wet contact time.']
    ]}
  ];
  const label={best:'BEST USE',good:'GOOD OPTION',test:'TEST FIRST',avoid:'AVOID'};
  const build=()=>{
    const sec=$('#index');if(!sec||$('#fireIndexRoot'))return;
    [...sec.children].forEach(el=>el.classList.add('legacy-index-ui'));
    const root=document.createElement('div');root.id='fireIndexRoot';root.innerHTML=`<div class="card fire-index-shell"><div class="kicker">Product and stain finder</div><h2>Chemical Use Index</h2><div class="fire-index-note">Identify the stain before choosing the chemical. “Possible—test first” means a small inconspicuous test only, not a guaranteed or label-approved use. Never experiment by mixing products together.</div><div class="fire-index-controls"><input id="fireIndexSearch" placeholder="Search: gutters, grease, rust, vinyl…"><select id="fireIndexRank"><option value="all">All ranks</option><option value="best">Best uses</option><option value="good">Good options</option><option value="test">Test first</option><option value="avoid">Avoid</option></select></div><div id="fireIndexResults"></div></div>`;sec.appendChild(root);
    $('#fireIndexSearch')?.addEventListener('input',render);$('#fireIndexRank')?.addEventListener('change',render);render();
  };
  const render=()=>{
    const out=$('#fireIndexResults');if(!out)return;const q=($('#fireIndexSearch')?.value||'').trim().toLowerCase(),rank=$('#fireIndexRank')?.value||'all';
    out.innerHTML=products.map(p=>{const rows=p.rows.filter(r=>(rank==='all'||r[0]===rank)&&(!q||[p.name,p.sub,r[1],r[2],label[r[0]]].join(' ').toLowerCase().includes(q)));if(!rows.length)return'';return `<section class="fire-index-product"><header><span class="fire-index-icon">${p.icon}</span><span><strong>${p.name}</strong><small>${p.sub}</small></span></header><div>${rows.map(r=>`<article class="fire-index-row"><span class="fire-rank ${r[0]}">${label[r[0]]}</span><div><strong>${r[1]}</strong><p>${r[2]}</p></div></article>`).join('')}</div></section>`}).join('')||'<div class="fire-index-empty">No matching uses found.</div>';
  };
  const apply=()=>build();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,1050));else setTimeout(apply,1050);
  window.addEventListener('fire-v18-shared-core-ready',()=>setTimeout(apply,80));window.addEventListener('fire-v18-parity-loaded',()=>setTimeout(apply,80));
})();