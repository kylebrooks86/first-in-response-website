import {LEGACY_BUSINESS_TEMPLATE_DEFAULTS} from "./legacy-business-template-defaults.mjs";
export type FireTemplate = {
  key:string;
  name:string;
  category:"Estimates"|"Invoices"|"Scheduling"|"After service"|"Documents";
  channel:"both"|"email"|"sms"|"document";
  subject:string;
  body:string;
};

export const SERVICE_AGREEMENT = `FIRST IN RESPONSE EXTERIORS LLC
SERVICE AGREEMENT & LIABILITY WAIVER

This Agreement applies to the services specifically listed in the accepted estimate, proposal, invoice, or work order. It is incorporated into each accepted document unless First In Response Exteriors LLC (the “Company”) agrees otherwise in writing.

1. SCOPE OF SERVICES
Depending on the written estimate, services may include: house, siding, exterior trim, roof, concrete, driveway, sidewalk, patio, deck, fence, paver, patio-furniture, trash-bin, and cobweb/spiderweb cleaning; soft washing or pressure washing; gutter clean-out, downspout flushing, gutter brightening, and gutter-guard removal/reinstallation; exterior window, screen, frame, and sill cleaning; window-frame oxidation treatment; rust, organic, oil, hard-water, or other stain treatment; A/C condenser cleaning; dryer-vent cleaning; underground downspout or French-drain flushing; and exterior cleaning of cars, trucks, work trucks, SUVs, UTVs, RVs, boats, and trailers.

Only work expressly listed in the written estimate is included. Repairs, sealing, painting, pest control, plumbing, electrical work, mechanical repair, restoration, interior cleaning, and other unlisted work are excluded unless separately stated in writing. The Company may stop or decline work when conditions are unsafe, inaccessible, likely to cause damage, outside equipment limitations, or materially different from those visible when the estimate was prepared.

2. RESULTS AND PERMANENT CONDITIONS
Cleaning improves appearance but does not make aged or damaged materials new. Results vary with age, material, maintenance, prior treatments, drainage, weathering, and the type and length of staining. Unless specifically quoted as a restoration or stain-removal service, the Company does not guarantee removal of oxidation, rust, oil, grease, hard-water deposits, paint, efflorescence, mineral deposits, artillery fungus, discoloration, permanent organic staining, or deeply embedded contamination. Even when specialty treatment is quoted, complete removal is not guaranteed and test spots or repeat treatments may be necessary.

3. PRE-EXISTING CONDITIONS
Cleaning may reveal defects previously hidden by dirt, algae, mold, mildew, oxidation, staining, or weathering. The Company is not responsible for pre-existing or latent conditions, including loose or damaged shingles; granule loss; failing paint, stain, clear coat, decals, or sealant; oxidized siding; cracked mortar; loose gutters; failed window seals; worn caulking; water intrusion; loose or brittle screens; faded surfaces; cracked or spalled concrete; unstable pavers; deteriorated wood; damaged vents, ducts, drains, plumbing, wiring, fixtures, or fasteners; and conditions beyond the Company’s reasonable control.

4. CHEMICALS, WATER, AND OVERSPRAY
The Company may use professional exterior-cleaning products including sodium hypochlorite solutions, surfactants, detergents, degreasers, gutter-brightening products, wood-restoration products, rust removers, oxidation removers, and other industry-appropriate products. Reasonable precautions will be used, but exterior cleaning involves water, pressure, runoff, mist, and overspray. Pre-existing damage, poor seals, sensitive coatings, neglected vegetation, wind, and heat may increase risk.

5. CUSTOMER PREPARATION AND ACCESS
Before service, Customer will provide safe and unobstructed access and functioning water and electrical service when required; close and securely latch doors, windows, skylights, vents, and hatches; unlock gates; secure pets; keep children and others away from the work area; move or secure furniture, decorations, flags, cushions, vehicles, electronics, and fragile property; and identify known leaks, damage, loose materials, delicate plants, irrigation, electrical hazards, security devices, cameras, alarms, or other sensitive areas. Customer authorizes reasonable access to the areas listed in the estimate.

6. ROOFS AND ELEVATED WORK
Roof cleaning removes or treats organic growth and staining but does not repair leaks, structural defects, flashing, underlayment, shingles, fasteners, gutters, or drainage problems and does not guarantee roof life or waterproofing. Cleaning may reveal worn shingles, granule loss, prior repairs, manufacturer defects, or existing leaks. Roof cleaning is currently limited to areas the Company can safely service with available equipment; above-one-story, steep, fragile, or otherwise inaccessible roof work may be declined unless the written estimate expressly includes it.

7. CONCRETE, PAVERS, DECKS, AND FENCES
Concrete, masonry, pavers, wood, composite materials, and coatings can have uneven wear, hidden repairs, oxidation, efflorescence, loose joint sand, failing stain or paint, splintering, and color variation. Cleaning or restoration may make these differences more visible. Paver cleaning does not include re-sanding or sealing unless separately listed. Wood cleaning or restoration does not include sanding, staining, sealing, painting, or structural repair unless separately listed.

8. WINDOWS, SCREENS, FRAMES, AND OXIDATION
Exterior window cleaning is currently limited to accessible single-story exterior windows unless the written estimate expressly states otherwise. It covers only the glass and components stated in the estimate and does not correct failed seals, fogging between panes, scratches, etching, mineral damage, damaged tint, loose grids, deteriorated glazing, brittle screens, worn seals, or water intrusion. Hard-water, oxidation, frame/sill deep cleaning, screen cleaning, and stain removal are included only when listed. Oxidation-removal work may reveal uneven fading or failed paint and cannot restore deteriorated finishes to factory condition.

9. GUTTERS, DOWNSPOUTS, AND GUTTER GUARDS
Standard gutter service does not include repairs, resealing, realignment, replacement, roof repair, underground drain cleaning, or correction of drainage design unless listed. Basic downspout flushing does not guarantee that underground piping is clear. Gutter-guard removal/reinstallation is included only when listed and may involve additional labor. Some systems cannot be safely removed because of age, installation, design, or condition. The Company may decline removal. If guards cannot be removed or Customer declines required labor, complete debris removal cannot be guaranteed.

10. UNDERGROUND DOWNSPOUTS AND FRENCH DRAINS
Drain flushing is limited to accessible lines and the reach and capability of the Company’s equipment, currently up to approximately 100 feet. The service is intended to remove reachable loose debris and buildup; it is not excavation, pipe repair, camera certification, plumbing, or a guarantee of full drainage. The Company is not responsible for pre-existing collapsed, separated, crushed, rooted, improperly graded, undersized, inaccessible, or deteriorated lines. Service may be stopped if continued work could damage the system or equipment.

11. DRYER VENTS
Dryer-vent service is limited to the option and accessible vent path listed in the estimate and the reach of the Company’s equipment, currently up to approximately 40 feet. Exterior-only service does not include moving or accessing the dryer or cleaning inaccessible interior sections. Cleaning cannot correct crushed, disconnected, excessively long, improperly routed, wet, damaged, or code-deficient ductwork, appliance defects, or exterior-cap defects. Before-and-after airflow readings, when taken, document conditions at that time and are not a safety certification or guarantee against future lint buildup, fire, moisture, or appliance malfunction. The Company will not disconnect or reconnect gas appliances unless expressly agreed and legally permitted.

12. A/C CONDENSER CLEANING
A/C service is limited to accessible exterior surfaces and visible condenser coils. It is not HVAC maintenance, electrical service, refrigerant work, diagnosis, repair, or a performance guarantee. The Company is not responsible for pre-existing mechanical problems, electrical failures, corrosion, damaged fins, or equipment malfunctions discovered before, during, or after cleaning.

13. COBWEB AND SPIDERWEB REMOVAL
Cobweb/spiderweb removal is a cleaning service, not pest control. It does not remove or treat insects, spiders, nests, eggs, infestations, or entry points and does not prevent webs from returning. Results are limited by access, height, surface condition, and safety.

14. VEHICLES, RVs, BOATS, AND TRAILERS
Customer will close and secure windows, doors, hatches, vents, compartments, tops, covers, and accessories and disclose leaks, loose decals, damaged trim, oxidation, failing clear coat, exposed wiring, electronics, cameras, sensors, or aftermarket components. Service is exterior cleaning only unless the estimate states otherwise. The Company is not responsible for water intrusion or failure of pre-existing seals, coatings, decals, fabrics, electronics, or accessories.

15. PLANTS AND LANDSCAPING
Healthy, well-watered landscaping is generally more resistant to properly applied cleaning solutions. The Company will take reasonable precautions to pre-wet, rinse, or cover landscaping when practical. The Company cannot guarantee against damage caused or contributed to by drought, disease, insects, poor drainage, improper maintenance, extreme weather, existing plant stress, unhealthy vegetation, sensitive species, or conditions beyond reasonable control. Customer will identify delicate or recently planted landscaping before work begins.

16. PHOTOS AND PROPERTY DOCUMENTATION
The Company may take photos before, during, and after service to document property condition and completed work. Marketing use requires Customer’s separate Yes or No selection in the approval form. A No selection does not prevent the Company from retaining nonpublic photos reasonably needed for job documentation, quality control, payment disputes, insurance, or legal records.

17. SCHEDULING, WEATHER, AND CHANGES
Weather, unsafe conditions, water restrictions, equipment issues, or unexpected property conditions may require delay or rescheduling without constituting a breach. Customer-requested additions or conditions discovered after work begins may change price or time and require approval before the extra work proceeds. No appointment is confirmed until any required deposit is received.

18. PAYMENT AND CANCELLATION
A 50% deposit is required at booking unless the written estimate states otherwise. The remaining balance is due immediately upon completion unless otherwise agreed in writing. Deposits are non-refundable for Customer cancellations made less than 48 hours before the scheduled service date, except where applicable law requires otherwise. Weather or Company-initiated rescheduling does not by itself forfeit the deposit. Returned payments, chargebacks, or unpaid balances may be subject to reasonable collection costs, attorney’s fees where permitted by law, and lawful interest. Accepted methods may include cash, check, credit/debit card, ACH bank transfer, Venmo (@FirstInResponseExteriors), and Cash App ($FIREExteriors).

19. INSPECTION AND CONCERNS
Customer should inspect completed work promptly and notify the Company of any concern within 48 hours after service so the condition can be documented and reasonably evaluated. Customer will allow the Company a reasonable opportunity to inspect and address a reported concern before repairs are attempted or another contractor is hired. This notice provision does not waive any nonwaivable right or remedy provided by law.

20. LIMITATION OF LIABILITY AND NONWAIVABLE RIGHTS
To the fullest extent permitted by law, the Company is not liable for indirect, incidental, special, or consequential damages arising from the services. Nothing in this Agreement releases liability that cannot lawfully be waived or limits a Customer’s nonwaivable consumer rights, statutory cancellation rights, or remedies.

21. GOVERNING LAW, ELECTRONIC SIGNATURE, AND ACCEPTANCE
This Agreement is governed by Oklahoma law. By typing their full name, selecting photo permission, checking the acceptance box, and approving electronically, Customer confirms that they have had the opportunity to read this Agreement and accept the estimate, scope, price, payment terms, and all provisions above. Customer agrees that this electronic signature and record may be used as evidence of acceptance to the extent permitted by applicable law. The signed name, date, time, agreement version, estimate, and photo-permission selection will be stored with the customer record.

If any provision is held unenforceable, the remaining provisions will continue to the extent allowed by law. This Agreement, the accepted estimate, and approved written changes are the complete agreement for the listed services.`;

export const FIRE_TEMPLATES:FireTemplate[] = [
  {key:"estimate",name:"Estimate ready",category:"Estimates",channel:"both",subject:"Your estimate from First In Response Exteriors",body:"Hi @customer_first_name, your @service_list estimate for @estimate_total is ready. Review and approve: @estimate_link A 50% deposit is required to book; the balance is due upon completion. Thank you! — First In Response Exteriors"},
  {key:"photoEstimate",name:"Request estimate photos",category:"Estimates",channel:"both",subject:"Photos for your FIRE estimate",body:"Hi @customer_first_name! I work full-time as a firefighter on 24-hour shifts, so photos help me prepare your estimate sooner, often while I am on shift. Please send your service address, a wide photo of each area you want cleaned, and close-ups of stains, access issues or damage. For gutters or windows, include all sides needing service. Please take photos from a safe spot on the ground. If photos are not practical, we can arrange an in-person estimate. Thank you! — First In Response Exteriors"},
  {key:"followUp1",name:"Estimate follow-up — 1 day",category:"Estimates",channel:"both",subject:"Any questions about your estimate?",body:"Hi @customer_first_name, I wanted to make sure you received your @service_list estimate. You can review it here: @estimate_link I’m happy to answer any questions. — First In Response Exteriors"},
  {key:"followUp3",name:"Estimate follow-up — 3 days",category:"Estimates",channel:"both",subject:"Following up on your exterior cleaning estimate",body:"Hi @customer_first_name, just checking in on your @service_list estimate for @estimate_total. If you’d like to move forward, you can approve it here: @estimate_link Thank you again for considering First In Response Exteriors!"},
  {key:"followUp7",name:"Estimate follow-up — 7 days",category:"Estimates",channel:"both",subject:"Your First In Response Exteriors estimate",body:"Hi @customer_first_name, I wanted to follow up one last time on your @service_list estimate. It’s still available here: @estimate_link If the timing isn’t right, no problem at all—I’d be glad to help whenever you’re ready. — First In Response Exteriors"},
  {key:"declined",name:"Declined estimate follow-up",category:"Estimates",channel:"both",subject:"Thank you for considering First In Response Exteriors",body:"Hi @customer_first_name, thank you for considering First In Response Exteriors for your @service_list. If your plans change or you’d like to adjust the scope, I’d be happy to help. — First In Response Exteriors"},
  {key:"invoice",name:"Invoice ready",category:"Invoices",channel:"both",subject:"Your invoice from First In Response Exteriors",body:"Hi @customer_first_name, this is First In Response Exteriors. Your invoice for @service_list is ready. The remaining balance is @invoice_total. View it here: @invoice_link Thank you again for choosing us!"},
  {key:"invoiceReminder",name:"Payment reminder",category:"Invoices",channel:"both",subject:"Friendly payment reminder from First In Response Exteriors",body:"Hi @customer_first_name, this is a friendly reminder that the @invoice_total balance for your @service_list is still open. You can review the invoice here: @invoice_link If you have any questions, please reply here. Thank you! — First In Response Exteriors"},
  {key:"overdue",name:"Past-due invoice reminder",category:"Invoices",channel:"both",subject:"Past-due invoice from First In Response Exteriors",body:"Hi @customer_first_name, our records show the @invoice_total balance for your @service_list is past due. Please review the invoice here: @invoice_link If you’ve already arranged payment, please disregard this message. Thank you — First In Response Exteriors"},
  {key:"appointment",name:"Appointment confirmation",category:"Scheduling",channel:"both",subject:"Your First In Response Exteriors appointment",body:"Hi @customer_first_name, your @service_list appointment is confirmed for @schedule_date at @service_address. Please make sure gates are unlocked, pets are secured, and an outside water source is available. — First In Response Exteriors"},
  {key:"appointmentReminder",name:"24-hour appointment reminder",category:"Scheduling",channel:"both",subject:"Reminder: your service is tomorrow",body:"Hi @customer_first_name, this is a reminder that First In Response Exteriors is scheduled for your @service_list on @schedule_date. Please make sure gates are unlocked, pets are secured, and outside water is available. See you soon! — First In Response Exteriors"},
  {key:"onMyWay",name:"On the way",category:"Scheduling",channel:"sms",subject:"First In Response Exteriors is on the way",body:"Hi @customer_first_name, this is First In Response Exteriors. I’m on my way for your @service_list appointment and will be there shortly."},
  {key:"delay",name:"Weather or schedule delay",category:"Scheduling",channel:"both",subject:"Update about your scheduled service",body:"Hi @customer_first_name, weather or job conditions have affected today’s schedule. I’ll contact you shortly with an updated arrival time for your @service_list. Thank you for your patience. — First In Response Exteriors"},
  {key:"complete",name:"Job complete",category:"After service",channel:"both",subject:"Your service is complete",body:"Hi @customer_first_name, your @service_list is complete. Thank you for trusting First In Response Exteriors with your property! Please let me know if you have any questions. — First In Response Exteriors"},
  {key:"review",name:"Review request",category:"After service",channel:"both",subject:"How did we do?",body:"Hi @customer_first_name, thank you for choosing First In Response Exteriors for your @service_list. Reviews are tremendously important to my small firefighter-owned business. Google is the most helpful and preferred, but a Facebook recommendation and Yelp review are also greatly appreciated. You can choose any of them here: @review_link Thank you again for your support! — First In Response Exteriors"},
  {key:"thankYou",name:"Payment received / thank you",category:"After service",channel:"both",subject:"Payment received — thank you!",body:"Hi @customer_first_name, your payment for @service_list has been received. Thank you for choosing First In Response Exteriors—I truly appreciate your business! — First In Response Exteriors"},
  {key:"winBack6",name:"6-month check-in",category:"After service",channel:"both",subject:"Time for an exterior cleaning check-in?",body:"Hi @customer_first_name, First In Response Exteriors here. It’s been a while since your @service_list, so I wanted to check whether your property needs any exterior cleaning or maintenance. I’d be happy to provide an updated estimate."},
  {key:"winBack11",name:"11-month rebooking",category:"After service",channel:"both",subject:"Ready to schedule your annual exterior cleaning?",body:"Hi @customer_first_name, it’s almost been a year since your @service_list. Would you like me to prepare an updated estimate or reserve a spot for your next cleaning? Thank you for your continued support! — First In Response Exteriors"},
  {key:"inspection",name:"Inspection or job report",category:"After service",channel:"email",subject:"Your property report from First In Response Exteriors",body:"Hi @customer_first_name, your @service_list inspection or job report is ready. View the report and property documentation here: @form_link Please reply with any questions. — First In Response Exteriors"},
  {key:"autoReply",name:"Away reply",category:"After service",channel:"both",subject:"We received your message",body:"Hi @customer_first_name, thanks for contacting First In Response Exteriors. I’m currently helping a customer or working in the field, but I received your message and will respond as soon as I can. — First In Response Exteriors"},
  {key:"estimateFooter",name:"Estimate footer",category:"Documents",channel:"document",subject:"",body:"Thank you for the opportunity to earn your business. A 50% deposit reserves your service date, and the remaining balance is due immediately upon completion. Final scope and pricing are subject to visible property conditions and customer-approved changes."},
  {key:"invoiceFooter",name:"Invoice footer",category:"Documents",channel:"document",subject:"",body:"Thank you for choosing First In Response Exteriors. The remaining balance is due upon completion. Please contact First In Response Exteriors with any questions about this invoice or to arrange payment."},
  {key:"inspectionFooter",name:"Inspection report footer",category:"Documents",channel:"document",subject:"",body:"This report documents visible conditions at the time of service. Photos and notes are provided for customer records and do not replace evaluation by a licensed specialist when one is required."},
  {key:"contractTerms",name:"Service agreement",category:"Documents",channel:"document",subject:"",body:SERVICE_AGREEMENT},
];

export const templateByKey=(key:string)=>FIRE_TEMPLATES.find((item)=>item.key===key)??FIRE_TEMPLATES[0];


// Keep the owner's custom invoice footer untouched. Only normalize the exact
// legacy default already stored in D1; no migrations or customer-row writes.
export function publicInvoiceFooter(savedBody:string|null|undefined){
  const currentDefault=templateByKey("invoiceFooter").body;
  const legacyDefault="Thank you for choosing First In Response Exteriors. The remaining balance is due upon completion. Please contact Kyle with any questions about this invoice or to arrange payment.";
  return !savedBody||savedBody===legacyDefault?currentDefault:savedBody;
}

export function fillTemplate(value:string,variables:Record<string,string>){
  return value.replace(/@[a-z_]+/g,(tag)=>variables[tag]??tag);
}

// Normalize each exact old default field independently so a customized subject or
// body survives. No database writes; signed agreements and message audit rows
// never pass through this compatibility function.
export function businessTemplateOverride<T extends {key:string;subject:string;body:string}>(saved:T):T {
  const legacy=(LEGACY_BUSINESS_TEMPLATE_DEFAULTS as Record<string,{subject:string;body:string}>)[saved.key];
  const current=FIRE_TEMPLATES.find(item=>item.key===saved.key);
  if(!legacy||!current)return saved;
  return {...saved,subject:saved.subject===legacy.subject?current.subject:saved.subject,
    body:saved.body===legacy.body?current.body:saved.body};
}
