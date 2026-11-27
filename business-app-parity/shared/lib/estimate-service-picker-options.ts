/** Visual grouping for the EXISTING owner service catalog. No new service IDs or rates.
 * Custom stays first. Unknown future catalog services fall into Other & Specialty.
 */
export const ESTIMATE_SERVICE_VISUAL_GROUPS = [
  {
    "key": "custom",
    "label": "Custom Service",
    "tone": "custom",
    "ids": [
      "custom"
    ]
  },
  {
    "key": "exterior",
    "label": "House & Roof",
    "tone": "exterior",
    "ids": [
      "roof-wash",
      "roof-debris-small",
      "roof-debris-medium",
      "roof-debris-heavy",
      "roof-organic",
      "roof-access",
      "roof-complex",
      "house-wash",
      "trim-addon-1f",
      "trim-addon-2f",
      "trim-1f",
      "trim-2f",
      "cobweb-add-on"
    ]
  },
  {
    "key": "drainage",
    "label": "Gutters & Drainage",
    "tone": "drainage",
    "ids": [
      "gutters",
      "gutter-guards",
      "gutter-brightening",
      "downspout-clog",
      "underground-first",
      "french-drain",
      "underground-additional"
    ]
  },
  {
    "key": "glass",
    "label": "Windows & Glass",
    "tone": "glass",
    "ids": [
      "windows",
      "windows-2f",
      "french-windows-1f",
      "french-windows-2f",
      "screens-1f",
      "screens-2f",
      "window-deep-1f",
      "window-deep-2f",
      "window-oxidation-1f",
      "window-oxidation-2f",
      "window-oxidation",
      "hard-water"
    ]
  },
  {
    "key": "outdoor",
    "label": "Concrete & Outdoor",
    "tone": "outdoor",
    "ids": [
      "fence",
      "premium-fence",
      "concrete",
      "paver",
      "deck",
      "patio-furniture",
      "rust",
      "trash-bins",
      "ac-rinse"
    ]
  },
  {
    "key": "vents",
    "label": "Dryer Vents",
    "tone": "vents",
    "ids": [
      "dryer",
      "dryer-exterior"
    ]
  },
  {
    "key": "vehicles",
    "label": "Vehicles & Trailers",
    "tone": "vehicles",
    "ids": [
      "car",
      "truck-suv",
      "large-truck",
      "commercial-truck",
      "trailer",
      "boat",
      "rv",
      "utv",
      "vehicle-wash"
    ]
  },
  {
    "key": "special",
    "label": "Add-ons & Specialty",
    "tone": "special",
    "ids": [
      "plant-protection",
      "access-surcharge",
      "holiday",
      "commercial",
      "specialty"
    ]
  }
] as const;

export function estimateServicePickerOptions<T extends {id:string}>(catalog:readonly T[]):T[]{
  const custom=catalog.filter(service=>service.id==="custom");
  const standard=catalog.filter(service=>service.id!=="custom");
  return [...custom,...standard];
}

export function estimateServicePickerGroups<T extends {id:string}>(catalog:readonly T[]){
  const ordered=estimateServicePickerOptions(catalog);
  const known=new Set<string>(ESTIMATE_SERVICE_VISUAL_GROUPS.flatMap(group=>[...group.ids]));
  const groups:Array<{key:string;label:string;tone:string;items:T[]}>=ESTIMATE_SERVICE_VISUAL_GROUPS.map(group=>({
    key:group.key,label:group.label,tone:group.tone,
    items:ordered.filter(service=>(group.ids as readonly string[]).includes(service.id)),
  })).filter(group=>group.items.length>0);
  const uncategorized=ordered.filter(service=>!known.has(service.id));
  if(uncategorized.length)groups.push({key:"other",label:"Other & Specialty",tone:"special",items:uncategorized});
  return groups;
}
