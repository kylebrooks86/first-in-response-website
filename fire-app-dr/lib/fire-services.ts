export type FireService = {
  id: string;
  name: string;
  unit: string;
  rate: number;
  description: string;
};

export const FIRE_SERVICES: FireService[] = [
  {
    id: "house-wash",
    name: "House Wash",
    unit: "sq ft",
    rate: 22,
    description: "Low-pressure cleaning of accessible siding, soffits, fascia, exterior trim, and other compatible surfaces to remove organic growth, dirt, cobwebs, and general buildup. Oxidation, rust, artillery fungus, paint failure, permanent staining, and restoration work are not included unless separately listed. Customer must close doors and windows, provide working water access, and move fragile items away from the work area. Some discoloration may remain when further cleaning could damage the surface.",
  },
  {
    id: "roof-wash",
    name: "Soft-Wash Roof Cleaning",
    unit: "job",
    rate: 15000,
    description: "Soft-wash treatment of safely accessible, compatible roof surfaces to address black streaks, algae, moss, and other organic growth. Heavy growth may continue lightening after service and may require time or an additional treatment. Permanent staining, oxidation, granule loss, leaks, repairs, and pre-existing roof damage are not included. Areas that cannot be reached safely with FIRE's current equipment, including certain upper-story or steep sections, may be excluded or require a revised quote.",
  },
  {
    id: "gutters",
    name: "Gutter Cleaning + Flush",
    unit: "linear ft",
    rate: 150,
    description: "Removal of loose debris from safely accessible gutters with a basic flush of accessible downspouts to confirm normal flow. Gutter guard removal and reinstall, underground drain clearing, packed or hardened blockages, repairs, resealing, and replacement parts are not included unless separately listed. Customer should identify known leaks, loose gutters, buried drain connections, and areas of concern before work begins.",
  },
  {
    id: "gutter-guards",
    name: "Remove & Reinstall Existing Gutter Guards",
    unit: "linear ft",
    rate: 50,
    description: "Temporary removal and reinstallation of the customer's existing gutter guards where needed to clean the gutter channel. New guards, replacement parts, repairs, and any guards that cannot be safely removed are not included. This is an add-on to gutter cleaning, charged only for the length requiring removal.",
  },
  {
    id: "gutter-brightening",
    name: "Gutter Brightening",
    unit: "linear ft",
    rate: 200,
    description: "Detail cleaning of accessible exterior gutter faces to improve dark streaking and surface buildup. Results depend on gutter age, coating condition, oxidation, sun exposure, and prior staining; complete restoration to a like-new finish is not guaranteed. Interior gutter cleaning, repairs, paint correction, and replacement are not included unless separately listed.",
  },
  {
    id: "concrete",
    name: "Driveway / Concrete Cleaning",
    unit: "sq ft",
    rate: 20,
    description: "Cleaning of stable, accessible concrete surfaces to remove dirt, organic growth, and general surface buildup. Oil, rust, paint, fertilizer stains, tire marks, efflorescence, and other specialty stains may require separate treatment and may not be fully removable. Loose, cracked, spalled, recently poured, painted, or previously damaged concrete will be cleaned only when it can be serviced safely.",
  },
  {
    id: "deck",
    name: "Deck / Patio Cleaning",
    unit: "sq ft",
    rate: 30,
    description: "Cleaning of safely accessible, compatible deck or patio surfaces using pressure and chemicals appropriate for the material and condition. Customer must remove furniture, rugs, planters, and fragile items before service. Existing paint or stain failure, oxidation, wood damage, loose boards, permanent discoloration, stripping, sanding, staining, sealing, and repairs are not included unless separately listed.",
  },
  {
    id: "fence",
    name: "Fence Cleaning",
    unit: "sq ft",
    rate: 40,
    description: "Cleaning of accessible fence surfaces to remove dirt, organic growth, and general buildup using methods appropriate for the material. Weathering, gray wood, oxidation, tannin stains, paint or stain failure, and permanent discoloration may remain after cleaning. Heavy restoration, stripping, sanding, staining, sealing, and repairs are not included unless separately listed.",
  },
  {
    id: "windows",
    name: "1st Floor Exterior Windows",
    unit: "window",
    rate: 700,
    description: "Exterior cleaning of safely accessible first-floor window glass. Customer must close and secure windows and remove fragile items from nearby areas. Interior glass, screens, tracks, deep frame and sill cleaning, hard-water deposits, paint, adhesive, oxidation, damaged seals, and restoration work are not included unless separately listed. FIRE currently limits standard window cleaning to single-story access.",
  },
  {
    id: "windows-2f",
    name: "2nd Floor Exterior Windows",
    unit: "window",
    rate: 1100,
    description: "Exterior cleaning of safely accessible second-floor standard window glass. Service is limited by safe access and current equipment. Screens, tracks, deep frame and sill cleaning, hard-water restoration, paint, adhesive, oxidation, damaged seals, and interior glass are not included unless separately listed.",
  },
  {
    id: "french-windows-1f",
    name: "1st Floor Exterior French-Pane Windows",
    unit: "window",
    rate: 1200,
    description: "Exterior cleaning of safely accessible first-floor French-pane window glass, including the additional detail work required by divided panes. Screens, tracks, deep frame and sill cleaning, hard-water restoration, paint, adhesive, oxidation, damaged seals, and interior glass are not included unless separately listed.",
  },
  {
    id: "french-windows-2f",
    name: "2nd Floor Exterior French-Pane Windows",
    unit: "window",
    rate: 1800,
    description: "Exterior cleaning of safely accessible second-floor French-pane window glass, including the additional detail work required by divided panes. Service is limited by safe access and current equipment. Screens, tracks, deep frame and sill cleaning, hard-water restoration, paint, adhesive, oxidation, damaged seals, and interior glass are not included unless separately listed.",
  },
  {
    id: "screens-1f",
    name: "1st Floor Window Screen Cleaning",
    unit: "screen",
    rate: 300,
    description: "Cleaning of removable, safely accessible first-floor window screens. Bent frames, torn mesh, brittle clips, stuck screens, repairs, and replacement are not included.",
  },
  {
    id: "screens-2f",
    name: "2nd Floor Window Screen Cleaning",
    unit: "screen",
    rate: 600,
    description: "Cleaning of removable, safely accessible second-floor window screens. Service is limited by safe access and current equipment. Bent frames, torn mesh, brittle clips, stuck screens, repairs, and replacement are not included.",
  },

  {
    id: "window-deep-1f",
    name: "1st Floor Deep Exterior Window Frame & Sill Cleaning",
    unit: "window",
    rate: 0,
    description: "Deep exterior cleaning of safely accessible first-floor window frames and sills. Heavy oxidation, failed coatings, hard-water restoration, paint, adhesive, damaged seals, repairs, and interior detailing are not included unless separately listed.",
  },
  {
    id: "window-deep-2f",
    name: "2nd Floor Deep Exterior Window Frame & Sill Cleaning",
    unit: "window",
    rate: 0,
    description: "Deep exterior cleaning of safely accessible second-floor window frames and sills. Service is limited by safe access and current equipment. Heavy oxidation, failed coatings, hard-water restoration, paint, adhesive, damaged seals, repairs, and interior detailing are not included unless separately listed.",
  },
  {
    id: "window-oxidation",
    name: "Window Frame Oxidation Removal",
    unit: "window",
    rate: 0,
    description: "Specialty treatment of compatible exterior window-frame oxidation where safely accessible. Results depend on coating condition, age, sun exposure, and prior damage; full restoration is not guaranteed. Repairs, repainting, glass restoration, and damaged seals are not included unless separately listed.",
  },
  {
    id: "trash-bins",
    name: "Trash Bin Cleaning",
    unit: "bin",
    rate: 2500,
    description: "Cleaning and deodorizing of customer-owned trash or recycling bins. Bins must be empty and accessible. Paint, tar, construction material, hazardous waste, embedded staining, damage, and pest remediation are not included.",
  },

  {
    id: "underground-first",
    name: "Underground Downspout Flush — First Line",
    unit: "line",
    rate: 0,
    description: "Flushing of one accessible underground downspout line using FIRE's current jetting equipment. Service is intended to improve normal flow through accessible piping; collapsed pipe, roots, broken fittings, excavation, repairs, and blockages beyond equipment reach are not included.",
  },
  {
    id: "underground-additional",
    name: "Additional Underground Line — Same Visit",
    unit: "line",
    rate: 0,
    description: "Flushing of an additional accessible underground drainage line during the same visit. Collapsed pipe, roots, broken fittings, excavation, repairs, and blockages beyond equipment reach are not included.",
  },
  {
    id: "french-drain",
    name: "French Drain Flush",
    unit: "line",
    rate: 0,
    description: "Flushing of an accessible French drain line using FIRE's current equipment. Results depend on pipe condition, access, sediment load, roots, and structural integrity. Excavation, repairs, replacement, and inaccessible or collapsed sections are not included.",
  },
  {
    id: "premium-fence",
    name: "Premium Fence Restoration",
    unit: "sq ft",
    rate: 0,
    description: "Enhanced cleaning/restoration treatment for compatible fence surfaces where standard cleaning is not sufficient. Final scope, chemicals, and expected results depend on material and condition. Repairs, board replacement, sanding, staining, and sealing are not included unless separately listed.",
  },
  {
    id: "ac-rinse",
    name: "AC Condenser Rinse Add-On",
    unit: "job",
    rate: 0,
    description: "Gentle exterior rinse of an accessible outdoor condenser coil and cabinet as an add-on service. Electrical work, disassembly beyond normal access, chemical coil restoration, repairs, refrigerant service, and HVAC diagnosis are not included.",
  },
  {
    id: "vehicle-wash",
    name: "RV / Boat / Trailer / Work Vehicle Wash",
    unit: "job",
    rate: 0,
    description: "Exterior wash of the vehicle or trailer surfaces specifically listed in this estimate. Oxidation removal, polishing, paint correction, interior detailing, roof restoration, decals, and specialty stain removal are not included unless separately listed.",
  },
  {
    id: "cobweb-add-on",
    name: "Detailed Cobweb Removal Add-On",
    unit: "job",
    rate: 0,
    description: "Detailed removal of accessible cobwebs and spiderwebs from the exterior areas specifically listed in this estimate. Pest treatment, insect extermination, inaccessible high areas, staining, and repairs are not included.",
  },
  {
    id: "dryer",
    name: "Dryer Vent Cleaning",
    unit: "job",
    rate: 0,
    description: "Cleaning of an accessible dryer vent line up to approximately 40 feet using FIRE's current equipment, with before-and-after airflow readings when conditions allow. Customer must provide safe access to the dryer and exterior termination and disclose known damage or disconnections. Appliance repair, wall or roof repair, inaccessible or unsafe terminations, pest removal, damaged ducts, and blockages that cannot be cleared with standard equipment are not included and may require a specialist.",
  },
  {
    id: "holiday",
    name: "Seasonal / Holiday Lighting",
    unit: "job",
    rate: 0,
    description: "Installation or service of the seasonal lighting and accessories specifically listed in this estimate on safely accessible areas. Customer-provided products, electrical capacity, timers, storage, removal, replacement bulbs, repairs, and return visits are included only when specifically stated. Layout or pricing may change if hidden access, electrical, roofline, or product-condition issues are discovered.",
  },
  {
    id: "commercial",
    name: "Commercial Exterior Cleaning",
    unit: "job",
    rate: 0,
    description: "Exterior cleaning of the commercial surfaces and areas specifically listed in this estimate. Work is limited to safely accessible, compatible materials and agreed service times. Specialty stain removal, grease remediation, hazardous materials, traffic control, water recovery, lift rental, permits, interior areas, and restoration are not included unless separately listed. Final results depend on surface age, condition, staining, and prior damage.",
  },
  {
    id: "specialty",
    name: "Specialty Exterior Service",
    unit: "job",
    rate: 0,
    description: "Specialty exterior work limited to the exact surfaces, treatment, and expected result written in this estimate. Pricing assumes the conditions visible or disclosed when quoted. Hidden damage, additional areas, specialty chemicals, extended labor, repairs, restoration, or work outside the written scope requires customer approval and may change the price.",
  },
  {
    id: "custom",
    name: "Custom Service",
    unit: "job",
    rate: 0,
    description: "Custom work is limited to the services, surfaces, and expected result written in this estimate. Anything not specifically described is excluded. Pricing may be revised with customer approval if measurements, access, surface condition, hidden damage, or the requested scope differs from the information available when the estimate was prepared.",
  },
];

export function serviceDescriptionFor(name: string): string {
  return FIRE_SERVICES.find((service) => service.name === name)?.description ?? "Service includes only the work and areas specifically listed in this estimate. Additional areas, repairs, restoration, specialty stain removal, or work outside the written scope requires customer approval and may change the price.";
}
