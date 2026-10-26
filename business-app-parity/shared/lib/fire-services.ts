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
    "description": "Service includes only the work and areas listed in this estimate. Additional work requires customer approval.",
    "rate": 5000,
    "unit": "quantity",
    "quoteIqNumber": 2,
    "category": "base"
  },
  {
    "id": "roof-debris-medium",
    "name": "Roof Debris Removal (Medium)",
    "description": "Service includes only the work and areas listed in this estimate. Additional work requires customer approval.",
    "rate": 7500,
    "unit": "quantity",
    "quoteIqNumber": 3,
    "category": "base"
  },
  {
    "id": "roof-debris-heavy",
    "name": "Roof Debris Removal (Heavy)",
    "description": "Service includes only the work and areas listed in this estimate. Additional work requires customer approval.",
    "rate": 10000,
    "unit": "quantity",
    "quoteIqNumber": 4,
    "category": "base"
  },
  {
    "id": "roof-organic",
    "name": "Heavy Organic Growth Treatment",
    "description": "Service includes only the work and areas listed in this estimate. Additional work requires customer approval.",
    "rate": 7500,
    "unit": "each",
    "quoteIqNumber": 5,
    "category": "supplemental"
  },
  {
    "id": "roof-access",
    "name": "Steep Roof/Difficult Access",
    "description": "Service includes only the work and areas listed in this estimate. Additional work requires customer approval.",
    "rate": 5000,
    "unit": "each",
    "quoteIqNumber": 6,
    "category": "supplemental"
  },
  {
    "id": "roof-complex",
    "name": "Complex Roof Design",
    "description": "Service includes only the work and areas listed in this estimate. Additional work requires customer approval.",
    "rate": 5000,
    "unit": "each",
    "quoteIqNumber": 7,
    "category": "supplemental"
  },
  {
    "id": "plant-protection",
    "name": "Extensive Plant Protection",
    "description": "Service includes only the work and areas listed in this estimate. Additional work requires customer approval.",
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
    "description": "Service includes only the work and areas listed in this estimate. Additional work requires customer approval.",
    "rate": 10000,
    "unit": "quantity",
    "quoteIqNumber": 10,
    "category": "supplemental"
  },
  {
    "id": "trim-addon-2f",
    "name": "2 Story Premium Trim Wash (Add-On)",
    "description": "Service includes only the work and areas listed in this estimate. Additional work requires customer approval.",
    "rate": 20000,
    "unit": "quantity",
    "quoteIqNumber": 11,
    "category": "supplemental"
  },
  {
    "id": "trim-1f",
    "name": "Premium Exterior Trim Wash 1-Story",
    "description": "Service includes only the work and areas listed in this estimate. Additional work requires customer approval.",
    "rate": 17500,
    "unit": "quantity",
    "quoteIqNumber": 12,
    "category": "base"
  },
  {
    "id": "trim-2f",
    "name": "Premium Exterior Trim Wash 2-Story",
    "description": "Service includes only the work and areas listed in this estimate. Additional work requires customer approval.",
    "rate": 25000,
    "unit": "quantity",
    "quoteIqNumber": 13,
    "category": "base"
  },
  {
    "id": "access-surcharge",
    "name": "Access Difficulty Surcharge",
    "description": "Service includes only the work and areas listed in this estimate. Additional work requires customer approval.",
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
    "description": "Service includes only the work and areas listed in this estimate. Additional work requires customer approval.",
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
    "description": "Service includes only the work and areas listed in this estimate. Additional work requires customer approval.",
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
    "description": "Service includes only the work and areas listed in this estimate. Additional work requires customer approval.",
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
    "description": "Service includes only the work and areas listed in this estimate. Additional work requires customer approval.",
    "rate": 2500,
    "unit": "quantity",
    "quoteIqNumber": 34,
    "category": "supplemental"
  },
  {
    "id": "window-oxidation-2f",
    "name": "2nd Floor Window Frame Oxidation Removal",
    "description": "Service includes only the work and areas listed in this estimate. Additional work requires customer approval.",
    "rate": 4000,
    "unit": "quantity",
    "quoteIqNumber": 35,
    "category": "supplemental"
  },
  {
    "id": "hard-water",
    "name": "Hard Water Stain Removal",
    "description": "Service includes only the work and areas listed in this estimate. Additional work requires customer approval.",
    "rate": 2000,
    "unit": "each",
    "quoteIqNumber": 36,
    "category": "base"
  },
  {
    "id": "rust",
    "name": "Rust Stain Removal",
    "description": "Service includes only the work and areas listed in this estimate. Additional work requires customer approval.",
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
    "description": "Service includes only the work and areas listed in this estimate. Additional work requires customer approval.",
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
    "description": "Service includes only the work and areas listed in this estimate. Additional work requires customer approval.",
    "rate": 5000,
    "unit": "quantity",
    "quoteIqNumber": 43,
    "category": "base"
  },
  {
    "id": "truck-suv",
    "name": "Basic Truck/SUV Wash",
    "description": "Service includes only the work and areas listed in this estimate. Additional work requires customer approval.",
    "rate": 6500,
    "unit": "quantity",
    "quoteIqNumber": 44,
    "category": "base"
  },
  {
    "id": "large-truck",
    "name": "Basic Large Truck/Work Truck Wash",
    "description": "Service includes only the work and areas listed in this estimate. Additional work requires customer approval.",
    "rate": 7500,
    "unit": "quantity",
    "quoteIqNumber": 45,
    "category": "base"
  },
  {
    "id": "commercial-truck",
    "name": "Basic Large Commercial Work T…",
    "description": "Service includes only the work and areas listed in this estimate. Additional work requires customer approval.",
    "rate": 12500,
    "unit": "quantity",
    "quoteIqNumber": 46,
    "category": "base",
    "provisionalName": true
  },
  {
    "id": "trailer",
    "name": "Basic Utility / Enclosed Trailer Ext…",
    "description": "Service includes only the work and areas listed in this estimate. Additional work requires customer approval.",
    "rate": 500,
    "unit": "linear ft",
    "quoteIqNumber": 47,
    "category": "base",
    "provisionalName": true
  },
  {
    "id": "boat",
    "name": "Basic Boat Wash",
    "description": "Service includes only the work and areas listed in this estimate. Additional work requires customer approval.",
    "rate": 600,
    "unit": "linear ft",
    "quoteIqNumber": 48,
    "category": "base"
  },
  {
    "id": "rv",
    "name": "Basic RV Wash",
    "description": "Service includes only the work and areas listed in this estimate. Additional work requires customer approval.",
    "rate": 600,
    "unit": "linear ft",
    "quoteIqNumber": 49,
    "category": "base"
  },
  {
    "id": "utv",
    "name": "Basic UTV/Side by Side Wash",
    "description": "Service includes only the work and areas listed in this estimate. Additional work requires customer approval.",
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
    "description": "Custom work is limited to the services, surfaces, and expected result written in this estimate. Anything not specifically described is excluded. Pricing may be revised with customer approval if measurements, access, surface condition, hidden damage, or the requested scope differs from the information available when the estimate was prepared.",
    "category": "other"
  }
];

export function serviceDescriptionFor(name: string): string {
  return FIRE_SERVICES.find((service) => service.name === name)?.description ?? "Service includes only the work and areas specifically listed in this estimate. Additional areas, repairs, restoration, specialty stain removal, or work outside the written scope requires customer approval and may change the price.";
}
