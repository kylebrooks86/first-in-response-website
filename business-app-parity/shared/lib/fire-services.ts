export type FireService = {
  id: string;
  name: string;
  unit: string;
  rate: number;
  description: string;
  quoteIqNumber?: number;
  category?: 'base' | 'supplemental' | 'other';
  provisionalName?: boolean;
  active?: boolean;
};

// Owner-confirmed QuoteIQ reference. Rates are integer cents; no entry is auto-added.
// Existing IDs and unrelated services are retained for historical references.
export const FIRE_SERVICES: FireService[] = [
  {
    "id": "roof-wash",
    "name": "Soft-Wash Roof Cleaning",
    "unit": "sq ft",
    "rate": 35,
    "description": "Soft-wash treatment of safely accessible, compatible roof surfaces to address black streaks, algae, moss, and other organic growth. Heavy growth may continue lightening after service and may require time or an additional treatment. Permanent staining, oxidation, granule loss, leaks, repairs, and pre-existing roof damage are not included. Areas that cannot be reached safely with FIRE's current equipment, including certain upper-story or steep sections, may be excluded or require a revised quote.",
    "quoteIqNumber": 1,
    "category": "base"
  },
  {
    "id": "roof-debris-small",
    "name": "Roof Debris Removal (Small)",
    "description": "Removal of a small amount of loose leaves, twigs and debris from the roof areas listed in this estimate, using methods appropriate for the roof condition and safe access. Roof washing, gutter cleaning, packed debris, moss removal, repairs and disposal beyond the agreed scope are not included. Unsafe or fragile sections will be excluded and discussed before work.",
    "rate": 5000,
    "unit": "quantity",
    "quoteIqNumber": 2,
    "category": "base"
  },
  {
    "id": "roof-debris-medium",
    "name": "Roof Debris Removal (Medium)",
    "description": "Removal of a moderate accumulation of loose leaves, twigs and debris from the accessible roof sections listed in this estimate. Debris is collected or cleared from the agreed work area. Roof washing, gutter cleanout, embedded growth, repairs and unsafe roof access are not included unless separately quoted.",
    "rate": 7500,
    "unit": "quantity",
    "quoteIqNumber": 3,
    "category": "base"
  },
  {
    "id": "roof-debris-heavy",
    "name": "Roof Debris Removal (Heavy)",
    "description": "Removal of heavy loose roof debris from the sections specifically identified in this estimate, subject to safe access and roof condition. Packed material, rooted growth or debris that cannot be removed without damaging the roof requires separate review. Roof washing, gutter cleaning, repairs and additional disposal are not included unless listed.",
    "rate": 10000,
    "unit": "quantity",
    "quoteIqNumber": 4,
    "category": "base"
  },
  {
    "id": "roof-organic",
    "name": "Heavy Organic Growth Treatment",
    "description": "Additional treatment of the heavy algae, moss or other organic growth identified on the quoted surface. Treatment method and dwell time depend on the material and condition; growth may release or lighten gradually rather than disappear immediately. Permanent stains, repairs and a guaranteed like-new finish are not included. Applied only when selected on the estimate.",
    "rate": 7500,
    "unit": "each",
    "quoteIqNumber": 5,
    "category": "supplemental"
  },
  {
    "id": "roof-access",
    "name": "Steep Roof/Difficult Access",
    "description": "Additional setup and handling for the steep roof sections or difficult access specifically identified in this estimate. This charge does not authorize unsafe roof access or work beyond FIRE's equipment capabilities. Lift rental, repairs and additional inaccessible areas require a separate agreement. Applied only when selected.",
    "rate": 5000,
    "unit": "each",
    "quoteIqNumber": 6,
    "category": "supplemental"
  },
  {
    "id": "roof-complex",
    "name": "Complex Roof Design",
    "description": "Additional labor and setup for the roof valleys, multiple sections, transitions or other complex roof features identified in this estimate. Covers the agreed cleaning access and detail work only. Repairs, lift rental and areas outside the written scope are excluded. Applied only when selected.",
    "rate": 5000,
    "unit": "each",
    "quoteIqNumber": 7,
    "category": "supplemental"
  },
  {
    "id": "plant-protection",
    "name": "Extensive Plant Protection",
    "description": "Additional preparation, covering, controlled rinsing and monitoring for the sensitive or extensive landscaping identified around the quoted work area. Customer should disclose delicate plants and move portable planters where possible. This service reduces exposure but does not guarantee that stressed or sensitive plants will be unaffected. Applied only when selected.",
    "rate": 5000,
    "unit": "each",
    "quoteIqNumber": 8,
    "category": "supplemental"
  },
  {
    "id": "house-wash",
    "name": "House Wash",
    "unit": "sq ft",
    "rate": 22,
    "description": "Low-pressure cleaning of accessible siding, soffits, fascia, exterior trim, and other compatible surfaces to remove organic growth, dirt, cobwebs, and general buildup. Oxidation, rust, artillery fungus, paint failure, permanent staining, and restoration work are not included unless separately listed. Customer must close doors and windows, provide working water access, and move fragile items away from the work area. Some discoloration may remain when further cleaning could damage the surface.",
    "quoteIqNumber": 9,
    "category": "base"
  },
  {
    "id": "trim-addon-1f",
    "name": "1 Story Premium Trim Wash (Add On)",
    "description": "Cleaning of safely accessible first-story soffits, fascia and exterior trim as an optional addition to the other services on this estimate. Includes removal of ordinary dirt, cobwebs and organic buildup from compatible surfaces. Full siding cleaning, oxidation restoration, failed paint and repairs are excluded unless listed.",
    "rate": 10000,
    "unit": "quantity",
    "quoteIqNumber": 10,
    "category": "supplemental"
  },
  {
    "id": "trim-addon-2f",
    "name": "2 Story Premium Trim Wash (Add-On)",
    "description": "Cleaning of safely accessible second-story soffits, fascia and exterior trim as an optional addition to the other services on this estimate. Methods and reach depend on the building and available equipment. Full siding cleaning, oxidation restoration, repairs and lift rental are excluded unless listed.",
    "rate": 20000,
    "unit": "quantity",
    "quoteIqNumber": 11,
    "category": "supplemental"
  },
  {
    "id": "trim-1f",
    "name": "Premium Exterior Trim Wash 1-Story",
    "description": "Standalone cleaning of safely accessible first-story soffits, fascia and exterior trim using methods suited to the material and finish. Includes ordinary dirt, cobwebs and organic buildup on the agreed trim areas. Full siding washing, oxidation restoration, paint correction and repairs are not included.",
    "rate": 17500,
    "unit": "quantity",
    "quoteIqNumber": 12,
    "category": "base"
  },
  {
    "id": "trim-2f",
    "name": "Premium Exterior Trim Wash 2-Story",
    "description": "Standalone cleaning of safely accessible second-story soffits, fascia and exterior trim on the agreed building sections. Access and methods are reviewed before work; areas outside safe equipment reach may require a revised scope. Full siding washing, oxidation restoration, paint correction, lift rental and repairs are not included.",
    "rate": 25000,
    "unit": "quantity",
    "quoteIqNumber": 13,
    "category": "base"
  },
  {
    "id": "access-surcharge",
    "name": "Access Difficulty Surcharge",
    "description": "Additional setup or labor for the access limitations specifically described in this estimate, such as restricted equipment access or obstacles around the work area. Covers only the agreed access difficulty. Permits, lift rental, repairs and unrelated additional work are excluded unless separately listed. Never added automatically.",
    "rate": 5000,
    "unit": "each",
    "quoteIqNumber": 14,
    "category": "supplemental"
  },
  {
    "id": "gutters",
    "name": "Gutter Cleaning + Flush",
    "unit": "linear ft",
    "rate": 150,
    "description": "Removal of loose debris from safely accessible gutters with a basic flush of accessible downspouts to confirm normal flow. Gutter guard removal and reinstall, underground drain clearing, packed or hardened blockages, repairs, resealing, and replacement parts are not included unless separately listed. Customer should identify known leaks, loose gutters, buried drain connections, and areas of concern before work begins.",
    "quoteIqNumber": 15,
    "category": "base"
  },
  {
    "id": "gutter-guards",
    "name": "Remove & Reinstall Existing Gutter Guards",
    "unit": "linear ft",
    "rate": 50,
    "description": "Temporary removal and reinstallation of the customer's existing gutter guards where needed to clean the gutter channel. New guards, replacement parts, repairs, and any guards that cannot be safely removed are not included. This is an add-on to gutter cleaning, charged only for the length requiring removal.",
    "quoteIqNumber": 16,
    "category": "supplemental"
  },
  {
    "id": "gutter-brightening",
    "name": "Gutter Brightening",
    "unit": "linear ft",
    "rate": 200,
    "description": "Detail cleaning of accessible exterior gutter faces to improve dark streaking and surface buildup. Results depend on gutter age, coating condition, oxidation, sun exposure, and prior staining; complete restoration to a like-new finish is not guaranteed. Interior gutter cleaning, repairs, paint correction, and replacement are not included unless separately listed.",
    "quoteIqNumber": 17,
    "category": "base"
  },
  {
    "id": "downspout-clog",
    "name": "Clogged Downspout Flush",
    "description": "Targeted flushing of an accessible clogged above-ground downspout to improve drainage. Includes the specific downspout listed, subject to pipe condition and reachable blockage. Underground drains, gutter cleanout, disassembly, replacement parts, repairs and guaranteed removal of structural or deeply packed obstructions are excluded unless quoted.",
    "rate": 2500,
    "unit": "quantity",
    "quoteIqNumber": 18,
    "category": "supplemental"
  },
  {
    "id": "fence",
    "name": "Fence Cleaning",
    "unit": "sq ft",
    "rate": 40,
    "description": "Cleaning of accessible fence surfaces to remove dirt, organic growth, and general buildup using methods appropriate for the material. Weathering, gray wood, oxidation, tannin stains, paint or stain failure, and permanent discoloration may remain after cleaning. Heavy restoration, stripping, sanding, staining, sealing, and repairs are not included unless separately listed.",
    "quoteIqNumber": 19,
    "category": "base"
  },
  {
    "id": "premium-fence",
    "name": "Premium Fence Restoration",
    "unit": "sq ft",
    "rate": 60,
    "description": "Enhanced cleaning/restoration treatment for compatible fence surfaces where standard cleaning is not sufficient. Final scope, chemicals, and expected results depend on material and condition. Repairs, board replacement, sanding, staining, and sealing are not included unless separately listed.",
    "quoteIqNumber": 20,
    "category": "supplemental"
  },
  {
    "id": "concrete",
    "name": "Driveway / Concrete Cleaning",
    "unit": "sq ft",
    "rate": 20,
    "description": "Cleaning of stable, accessible concrete surfaces to remove dirt, organic growth, and general surface buildup. Oil, rust, paint, fertilizer stains, tire marks, efflorescence, and other specialty stains may require separate treatment and may not be fully removable. Loose, cracked, spalled, recently poured, painted, or previously damaged concrete will be cleaned only when it can be serviced safely.",
    "quoteIqNumber": 21,
    "category": "base"
  },
  {
    "id": "paver",
    "name": "Paver Cleaning",
    "description": "Cleaning of the accessible paver area measured in this estimate using pressure and products suited to the paver condition. Loose joints, uneven pavers and existing damage are reviewed before work. Re-sanding, sealing, leveling, weed prevention, repairs and specialty stain removal are not included unless listed; some joint sand may loosen during cleaning.",
    "rate": 35,
    "unit": "sq ft",
    "quoteIqNumber": 22,
    "category": "base"
  },
  {
    "id": "deck",
    "name": "Deck / Patio Cleaning",
    "unit": "sq ft",
    "rate": 40,
    "description": "Cleaning of safely accessible, compatible deck or patio surfaces using pressure and chemicals appropriate for the material and condition. Customer must remove furniture, rugs, planters, and fragile items before service. Existing paint or stain failure, oxidation, wood damage, loose boards, permanent discoloration, stripping, sanding, staining, sealing, and repairs are not included unless separately listed.",
    "quoteIqNumber": 23,
    "category": "base"
  },
  {
    "id": "patio-furniture",
    "name": "Patio Furniture Cleaning",
    "description": "Cleaning of the compatible patio furniture pieces identified in this estimate to remove ordinary dirt and organic buildup. One quantity represents one agreed piece unless the estimate states otherwise. Upholstery extraction, delicate fabrics, oxidation restoration, refinishing, repairs and permanent stain removal are excluded.",
    "rate": 2000,
    "unit": "quantity",
    "quoteIqNumber": 24,
    "category": "base"
  },
  {
    "id": "ac-rinse",
    "name": "AC Condenser Rinse Add-On",
    "unit": "quantity",
    "rate": 2500,
    "description": "Gentle exterior rinse of an accessible outdoor condenser coil and cabinet as an add-on service. Electrical work, disassembly beyond normal access, chemical coil restoration, repairs, refrigerant service, and HVAC diagnosis are not included.",
    "quoteIqNumber": 25,
    "category": "base"
  },
  {
    "id": "windows",
    "name": "1st Floor Exterior Windows",
    "unit": "quantity",
    "rate": 700,
    "description": "Exterior cleaning of safely accessible first-floor window glass. Customer must close and secure windows and remove fragile items from nearby areas. Interior glass, screens, tracks, deep frame and sill cleaning, hard-water deposits, paint, adhesive, oxidation, damaged seals, and restoration work are not included unless separately listed.",
    "quoteIqNumber": 26,
    "category": "base"
  },
  {
    "id": "windows-2f",
    "name": "2nd Floor Exterior Windows",
    "unit": "quantity",
    "rate": 1100,
    "description": "Exterior cleaning of safely accessible second-floor standard window glass. Service is limited by safe access and current equipment. Screens, tracks, deep frame and sill cleaning, hard-water restoration, paint, adhesive, oxidation, damaged seals, and interior glass are not included unless separately listed.",
    "quoteIqNumber": 27,
    "category": "base"
  },
  {
    "id": "french-windows-1f",
    "name": "1st Floor Exterior French-Pane Windows",
    "unit": "each",
    "rate": 1200,
    "description": "Exterior cleaning of safely accessible first-floor French-pane window glass, including the additional detail work required by divided panes. Screens, tracks, deep frame and sill cleaning, hard-water restoration, paint, adhesive, oxidation, damaged seals, and interior glass are not included unless separately listed.",
    "quoteIqNumber": 28,
    "category": "base"
  },
  {
    "id": "french-windows-2f",
    "name": "2nd Floor Exterior French-Pane Windows",
    "unit": "each",
    "rate": 1800,
    "description": "Exterior cleaning of safely accessible second-floor French-pane window glass, including the additional detail work required by divided panes. Service is limited by safe access and current equipment. Screens, tracks, deep frame and sill cleaning, hard-water restoration, paint, adhesive, oxidation, damaged seals, and interior glass are not included unless separately listed.",
    "quoteIqNumber": 29,
    "category": "base"
  },
  {
    "id": "screens-1f",
    "name": "1st Floor Window Screen Cleaning",
    "unit": "each",
    "rate": 300,
    "description": "Cleaning of removable, safely accessible first-floor window screens. Bent frames, torn mesh, brittle clips, stuck screens, repairs, and replacement are not included.",
    "quoteIqNumber": 30,
    "category": "supplemental"
  },
  {
    "id": "screens-2f",
    "name": "2nd Floor Window Screen Cleaning",
    "unit": "each",
    "rate": 600,
    "description": "Cleaning of removable, safely accessible second-floor window screens. Service is limited by safe access and current equipment. Bent frames, torn mesh, brittle clips, stuck screens, repairs, and replacement are not included.",
    "quoteIqNumber": 31,
    "category": "supplemental"
  },
  {
    "id": "window-deep-1f",
    "name": "1st Floor Deep Exterior Window Frame & Sill Cleaning",
    "unit": "quantity",
    "rate": 500,
    "description": "Deep exterior cleaning of safely accessible first-floor window frames and sills. Heavy oxidation, failed coatings, hard-water restoration, paint, adhesive, damaged seals, repairs, and interior detailing are not included unless separately listed.",
    "quoteIqNumber": 32,
    "category": "supplemental"
  },
  {
    "id": "window-deep-2f",
    "name": "2nd Floor Deep Exterior Window Frame & Sill Cleaning",
    "unit": "quantity",
    "rate": 800,
    "description": "Deep exterior cleaning of safely accessible second-floor window frames and sills. Service is limited by safe access and current equipment. Heavy oxidation, failed coatings, hard-water restoration, paint, adhesive, damaged seals, repairs, and interior detailing are not included unless separately listed.",
    "quoteIqNumber": 33,
    "category": "supplemental"
  },
  {
    "id": "window-oxidation-1f",
    "name": "1st Floor Window Frame Oxidation Removal",
    "description": "Specialty treatment of oxidation on the safely accessible first-floor exterior window frames identified in this estimate. A suitable test area may be used before wider treatment; results depend on coating condition and prior damage. Repainting, failed finishes, glass restoration, damaged seals and repairs are excluded. Full restoration is not guaranteed.",
    "rate": 2500,
    "unit": "quantity",
    "quoteIqNumber": 34,
    "category": "supplemental"
  },
  {
    "id": "window-oxidation-2f",
    "name": "2nd Floor Window Frame Oxidation Removal",
    "description": "Specialty treatment of oxidation on the safely accessible second-floor exterior window frames identified in this estimate. Work is limited by safe access and current equipment, with a suitable test area where needed. Repainting, failed finishes, glass restoration, lift rental and repairs are excluded. Full restoration is not guaranteed.",
    "rate": 4000,
    "unit": "quantity",
    "quoteIqNumber": 35,
    "category": "supplemental"
  },
  {
    "id": "hard-water",
    "name": "Hard Water Stain Removal",
    "description": "Targeted treatment of mineral and hard-water deposits on the compatible glass or surface areas identified in this estimate. One quantity covers the agreed affected item or area described. Existing etching, scratched glass, failed coatings, repairs and replacement are excluded; permanent damage may remain after deposits are reduced.",
    "rate": 2000,
    "unit": "each",
    "quoteIqNumber": 36,
    "category": "base"
  },
  {
    "id": "rust",
    "name": "Rust Stain Removal",
    "description": "Targeted treatment of the rust-stained items or areas identified in this estimate using a product suitable for the surface. Results depend on the stain source, material and exposure history. Repairs, paint correction, stopping the underlying rust source and guaranteed complete stain removal are excluded unless listed.",
    "rate": 5000,
    "unit": "each",
    "quoteIqNumber": 37,
    "category": "base"
  },
  {
    "id": "trash-bins",
    "name": "Trash Bin Cleaning",
    "unit": "quantity",
    "rate": 2500,
    "description": "Cleaning and deodorizing of customer-owned trash or recycling bins. Bins must be empty and accessible. Paint, tar, construction material, hazardous waste, embedded staining, damage, and pest remediation are not included.",
    "quoteIqNumber": 38,
    "category": "base"
  },
  {
    "id": "dryer",
    "name": "Dryer Vent Cleaning",
    "unit": "quantity",
    "rate": 15000,
    "description": "Cleaning of an accessible dryer vent line up to approximately 40 feet using FIRE's current equipment, with before-and-after airflow readings when conditions allow. Customer must provide safe access to the dryer and exterior termination and disclose known damage or disconnections. Appliance repair, wall or roof repair, inaccessible or unsafe terminations, pest removal, damaged ducts, and blockages that cannot be cleared with standard equipment are not included and may require a specialist.",
    "quoteIqNumber": 39,
    "category": "base"
  },
  {
    "id": "dryer-exterior",
    "name": "Exterior-Access Dryer Vent Cleaning",
    "description": "Cleaning of the reachable dryer vent duct from a safe exterior access point, limited to the accessible path and FIRE's equipment reach of approximately 40 feet. Does not include moving or disconnecting the dryer, accessing interior connections or unsafe roof terminations. Crushed or disconnected ducts, repairs, pest removal and obstructions beyond reach require separate service. Airflow readings are recorded when conditions allow.",
    "rate": 10000,
    "unit": "quantity",
    "quoteIqNumber": 40,
    "category": "base"
  },
  {
    "id": "underground-first",
    "name": "Underground Downspout Flush — First Line",
    "unit": "quantity",
    "rate": 22500,
    "description": "Flushing of one accessible underground downspout line using FIRE's current jetting equipment. Service is intended to improve normal flow through accessible piping; collapsed pipe, roots, broken fittings, excavation, repairs, and blockages beyond equipment reach are not included.",
    "quoteIqNumber": 41,
    "category": "base"
  },
  {
    "id": "french-drain",
    "name": "French Drain Flush",
    "unit": "each",
    "rate": 27500,
    "description": "Flushing of an accessible French drain line using FIRE's current equipment. Results depend on pipe condition, access, sediment load, roots, and structural integrity. Excavation, repairs, replacement, and inaccessible or collapsed sections are not included.",
    "quoteIqNumber": 42,
    "category": "base"
  },
  {
    "id": "car",
    "name": "Basic Car Wash",
    "description": "Basic exterior wash of the passenger car identified in this estimate to remove ordinary road dirt from compatible, accessible surfaces. Interior cleaning, engine-bay cleaning, polishing, waxing, paint correction, oxidation restoration and specialty stain removal are excluded. Customer should disclose loose trim, damaged paint and leaks before washing.",
    "rate": 5000,
    "unit": "quantity",
    "quoteIqNumber": 43,
    "category": "base"
  },
  {
    "id": "truck-suv",
    "name": "Basic Truck/SUV Wash",
    "description": "Basic exterior wash of the truck or SUV identified in this estimate, covering compatible and safely accessible exterior surfaces. Interior detailing, engine-bay or undercarriage cleaning, polishing, waxing, oxidation restoration and specialty contamination removal are excluded unless listed. Loose accessories, damaged finishes and leaks should be disclosed before service.",
    "rate": 6500,
    "unit": "quantity",
    "quoteIqNumber": 44,
    "category": "base"
  },
  {
    "id": "large-truck",
    "name": "Basic Large Truck/Work Truck Wash",
    "description": "Basic exterior wash of the large truck or work truck specifically identified in this estimate. Covers ordinary dirt on compatible, safely accessible exterior surfaces. Heavy grease, cement, road tar, engine or undercarriage cleaning, interior detailing, polishing and repairs are excluded unless separately listed.",
    "rate": 7500,
    "unit": "quantity",
    "quoteIqNumber": 45,
    "category": "base"
  },
  {
    "id": "commercial-truck",
    "name": "Basic Large Commercial Work T…",
    "description": "Basic exterior wash of the commercial work vehicle and accessible surfaces specifically identified in this estimate. Safe access and the included vehicle surfaces are reviewed before work. Interior work, heavy grease or specialty contamination, polishing, restoration and repairs are excluded unless individually listed.",
    "rate": 12500,
    "unit": "quantity",
    "quoteIqNumber": 46,
    "category": "base",
    "provisionalName": true
  },
  {
    "id": "trailer",
    "name": "Basic Utility / Enclosed Trailer Ext…",
    "description": "Basic exterior cleaning of the utility or enclosed trailer identified in this estimate, billed by the agreed measured linear feet. Covers compatible exterior surfaces that can be safely reached. Interior cleaning, cargo areas, heavy grease, oxidation restoration, polishing and repairs are excluded unless listed. Trailer length and included surfaces must be agreed before service.",
    "rate": 500,
    "unit": "linear ft",
    "quoteIqNumber": 47,
    "category": "base",
    "provisionalName": true
  },
  {
    "id": "boat",
    "name": "Basic Boat Wash",
    "description": "Basic wash of the boat exterior surfaces specifically listed in this estimate, billed by the agreed linear feet. Customer must provide safe access and secure the boat on a suitable trailer or support. Interior detailing, below-waterline fouling removal, oxidation restoration, polishing, waxing and mechanical work are excluded unless listed.",
    "rate": 600,
    "unit": "linear ft",
    "quoteIqNumber": 48,
    "category": "base"
  },
  {
    "id": "rv",
    "name": "Basic RV Wash",
    "description": "Basic exterior wash of the RV identified in this estimate, billed by the agreed measured linear feet. Compatible, safely reachable exterior surfaces are included; roof work is included only when expressly listed and safely accessible. Interior detailing, oxidation restoration, polishing, waxing, awning restoration, leak repairs and damaged decals are excluded.",
    "rate": 600,
    "unit": "linear ft",
    "quoteIqNumber": 49,
    "category": "base"
  },
  {
    "id": "utv",
    "name": "Basic UTV/Side by Side Wash",
    "description": "Basic exterior wash of the UTV or side-by-side identified in this estimate to remove ordinary surface dirt from compatible, accessible surfaces. Heavy packed mud, disassembly, engine or electrical detailing, interior restoration, polishing and repairs are excluded unless listed. Customer should disclose loose accessories, damaged finishes and known leaks.",
    "rate": 5000,
    "unit": "quantity",
    "quoteIqNumber": 50,
    "category": "base"
  },
  {
    "id": "window-oxidation",
    "name": "Window Frame Oxidation Removal",
    "unit": "window",
    "rate": 0,
    "description": "Specialty treatment of compatible exterior window-frame oxidation where safely accessible. Results depend on coating condition, age, sun exposure, and prior damage; full restoration is not guaranteed. Repairs, repainting, glass restoration, and damaged seals are not included unless separately listed.",
    "category": "other"
  },
  {
    "id": "underground-additional",
    "name": "Additional Underground Line — Same Visit",
    "unit": "line",
    "rate": 0,
    "description": "Flushing of an additional accessible underground drainage line during the same visit. Collapsed pipe, roots, broken fittings, excavation, repairs, and blockages beyond equipment reach are not included.",
    "category": "other"
  },
  {
    "id": "vehicle-wash",
    "name": "RV / Boat / Trailer / Work Vehicle Wash",
    "unit": "job",
    "rate": 0,
    "description": "Exterior wash of the vehicle or trailer surfaces specifically listed in this estimate. Oxidation removal, polishing, paint correction, interior detailing, roof restoration, decals, and specialty stain removal are not included unless separately listed.",
    "category": "other"
  },
  {
    "id": "cobweb-add-on",
    "name": "Detailed Cobweb Removal Add-On",
    "unit": "job",
    "rate": 0,
    "description": "Detailed removal of accessible cobwebs and spiderwebs from the exterior areas specifically listed in this estimate. Pest treatment, insect extermination, inaccessible high areas, staining, and repairs are not included.",
    "category": "other"
  },
  {
    "id": "holiday",
    "name": "Seasonal / Holiday Lighting",
    "unit": "job",
    "rate": 0,
    "description": "Installation or service of the seasonal lighting and accessories specifically listed in this estimate on safely accessible areas. Customer-provided products, electrical capacity, timers, storage, removal, replacement bulbs, repairs, and return visits are included only when specifically stated. Layout or pricing may change if hidden access, electrical, roofline, or product-condition issues are discovered.",
    "category": "other"
  },
  {
    "id": "commercial",
    "name": "Commercial Exterior Cleaning",
    "unit": "job",
    "rate": 0,
    "description": "Exterior cleaning of the commercial surfaces and areas specifically listed in this estimate. Work is limited to safely accessible, compatible materials and agreed service times. Specialty stain removal, grease remediation, hazardous materials, traffic control, water recovery, lift rental, permits, interior areas, and restoration are not included unless separately listed. Final results depend on surface age, condition, staining, and prior damage.",
    "category": "other"
  },
  {
    "id": "specialty",
    "name": "Specialty Exterior Service",
    "unit": "job",
    "rate": 0,
    "description": "Specialty exterior work limited to the exact surfaces, treatment, and expected result written in this estimate. Pricing assumes the conditions visible or disclosed when quoted. Hidden damage, additional areas, specialty chemicals, extended labor, repairs, restoration, or work outside the written scope requires customer approval and may change the price.",
    "category": "other"
  },
  {
    "id": "custom",
    "name": "Custom Service",
    "unit": "job",
    "rate": 0,
    "description": "Custom cleaning of the surfaces and items specifically identified in this estimate, using methods suitable for the material and agreed condition. Scope, measurements, price and special requirements must be listed before acceptance. Repairs, restoration, specialty treatments and additional areas are excluded unless expressly quoted. Additional work requires customer approval and may change the price.",
    "category": "other"
  }
];

export function serviceDescriptionFor(name: string): string {
  return FIRE_SERVICES.find((service) => service.name === name)?.description ?? "Service includes only the work and areas specifically listed in this estimate. Additional areas, repairs, restoration, specialty stain removal, or work outside the written scope requires customer approval and may change the price.";
}
