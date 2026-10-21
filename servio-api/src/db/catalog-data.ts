// service catalog rows
export const CATEGORY_ROWS = [
  { id: 'tutoring', label: 'Tutoring', icon: 'school-outline', sortOrder: 1 },
  { id: 'repairs', label: 'Repairs', icon: 'construct-outline', sortOrder: 2 },
  { id: 'errands', label: 'Errands', icon: 'cart-outline', sortOrder: 3 },
  { id: 'beauty', label: 'Beauty & Care', icon: 'flower-outline', sortOrder: 4 },
  { id: 'tech', label: 'Tech Help', icon: 'laptop-outline', sortOrder: 5 },
] as const;

export const SKU_ROWS = [
  { id: 'sku-ac-leak', categoryId: 'repairs', name: 'Split AC Water Leak Repair', priceCentavos: 110000, unit: 'job', durationLabel: '45–60 min', inclusions: ['Leak diagnosis & drain line flush', 'Drain pan and outlet check', 'Test run after repair', 'Parts quoted separately, in-app'] },
  { id: 'sku-sink-leak', categoryId: 'repairs', name: 'Faucet & Sink Leak Fix', priceCentavos: 150000, unit: 'job', durationLabel: '45–60 min', inclusions: ['Leak diagnosis', 'Seal / washer replacement', 'Parts quoted separately'] },
  { id: 'sku-elec-inspect', categoryId: 'repairs', name: 'Electrical Safety Inspection', priceCentavos: 45000, unit: 'visit', durationLabel: '30–45 min', inclusions: ['Outlet and breaker checks', 'Written findings'] },
  { id: 'sku-handyman', categoryId: 'repairs', name: 'General Handyman', priceCentavos: 40000, unit: 'hr', durationLabel: '1 hr', inclusions: ['Furniture assembly', 'Minor fixes & mounting'] },
  { id: 'sku-math', categoryId: 'tutoring', name: 'Math Tutoring', priceCentavos: 35000, unit: 'hr', durationLabel: '1 hr', inclusions: ['Grade 1–12 math', 'Homework & test prep'] },
  { id: 'sku-science', categoryId: 'tutoring', name: 'Science Tutoring', priceCentavos: 40000, unit: 'hr', durationLabel: '1 hr', inclusions: ['Grade 7–12 science'] },
  { id: 'sku-grocery', categoryId: 'errands', name: 'Grocery Pickup', priceCentavos: 15000, unit: 'errand', durationLabel: '1–2 hrs', inclusions: ['Local store run', 'Purchases paid separately'] },
  { id: 'sku-hair', categoryId: 'beauty', name: 'Home Haircut & Styling', priceCentavos: 45000, unit: 'hr', durationLabel: '1 hr', inclusions: ['Wash, cut & blow-dry'] },
  { id: 'sku-laptop-diag', categoryId: 'tech', name: 'Laptop Diagnostics & Repair', priceCentavos: 50000, unit: 'hr', durationLabel: '1 hr', inclusions: ['Hardware & software checks', 'Pickup and return in-barangay'] },
] as const;

export const ADDON_ROWS = [
  { id: 'addon-drain-hose', name: 'Heavy Duty Flexible PVC Drain Hose', detail: '3 meters · includes installation', priceCentavos: 35000 },
  { id: 'addon-freon', name: 'Freon R410A Top-up', detail: 'Up to 1.5 HP unit · leak test included', priceCentavos: 220000 },
  { id: 'addon-unclog', name: 'Minor Drain Unclogging', detail: 'Pressure flush of indoor drain line', priceCentavos: 100000 },
] as const;
