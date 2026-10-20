import {
  AddonSku,
  BulletinRequest,
  ChatMessage,
  HelperProfile,
  LedgerEntry,
  ServiceSku,
} from '../../shared/models/domain.models';
import { Category } from '../../shared/models/ui.models';

export const CATEGORIES: Category[] = [
  { id: 'tutoring', label: 'Tutoring', shortLabel: 'Tutoring', caption: 'Academic help for all ages', icon: 'school-outline', tint: 'var(--servio-cat-tutoring)', accent: '#2563EB' },
  { id: 'repairs', label: 'Repairs', shortLabel: 'Repairs', caption: 'Fixes, installs & upkeep', icon: 'construct-outline', tint: 'var(--servio-cat-repairs)', accent: '#D04A00' },
  { id: 'errands', label: 'Errands', shortLabel: 'Errands', caption: 'Groceries, pickups & more', icon: 'cart-outline', tint: 'var(--servio-cat-errands)', accent: '#059669' },
  { id: 'beauty', label: 'Beauty & Care', shortLabel: 'Beauty', caption: 'Hair, nails & wellness', icon: 'flower-outline', tint: 'var(--servio-cat-beauty)', accent: '#DB2777' },
  { id: 'tech', label: 'Tech Help', shortLabel: 'Tech', caption: 'Devices & troubleshooting', icon: 'laptop-outline', tint: 'var(--servio-cat-tech)', accent: '#7C3AED' },
];

export const SKUS: Record<string, ServiceSku> = {
  acLeak: {
    id: 'sku-ac-leak',
    name: 'Split AC Water Leak Repair',
    category: 'repairs',
    pricePhp: 1100,
    unit: 'job',
    durationLabel: '45–60 min',
    inclusions: ['Leak diagnosis & drain line flush', 'Drain pan and outlet check', 'Test run after repair', 'Parts quoted separately, in-app'],
  },
  sinkLeak: {
    id: 'sku-sink-leak',
    name: 'Faucet & Sink Leak Fix',
    category: 'repairs',
    pricePhp: 1500,
    unit: 'job',
    durationLabel: '45–60 min',
    inclusions: ['Leak diagnosis', 'Seal / washer replacement', 'Parts quoted separately'],
  },
  elecInspect: {
    id: 'sku-elec-inspect',
    name: 'Electrical Safety Inspection',
    category: 'repairs',
    pricePhp: 450,
    unit: 'visit',
    durationLabel: '30–45 min',
    inclusions: ['Outlet and breaker checks', 'Written findings'],
  },
  laptopDiag: {
    id: 'sku-laptop-diag',
    name: 'Laptop Diagnostics & Repair',
    category: 'tech',
    pricePhp: 500,
    unit: 'hr',
    durationLabel: '1 hr',
    inclusions: ['Hardware & software checks', 'Pickup and return in-barangay'],
  },
  mathTutor: { id: 'sku-math', name: 'Math Tutoring', category: 'tutoring', pricePhp: 350, unit: 'hr', durationLabel: '1 hr', inclusions: ['Grade 1–12 math', 'Homework & test prep'] },
  scienceTutor: { id: 'sku-science', name: 'Science Tutoring', category: 'tutoring', pricePhp: 400, unit: 'hr', durationLabel: '1 hr', inclusions: ['Grade 7–12 science'] },
  handyman: { id: 'sku-handyman', name: 'General Handyman', category: 'repairs', pricePhp: 400, unit: 'hr', durationLabel: '1 hr', inclusions: ['Furniture assembly', 'Minor fixes & mounting'] },
  grocery: { id: 'sku-grocery', name: 'Grocery Pickup', category: 'errands', pricePhp: 150, unit: 'errand', durationLabel: '1–2 hrs', inclusions: ['Local store run', 'Purchases paid separately'] },
  hairTrim: { id: 'sku-hair', name: 'Home Haircut & Styling', category: 'beauty', pricePhp: 450, unit: 'hr', durationLabel: '1 hr', inclusions: ['Wash, cut & blow-dry'] },
};

export const BULLETIN_SKUS: ServiceSku[] = [
  SKUS['mathTutor'], SKUS['scienceTutor'], SKUS['acLeak'], SKUS['sinkLeak'], SKUS['handyman'], SKUS['grocery'], SKUS['hairTrim'], SKUS['laptopDiag'],
];

export const ADDON_CATALOG: AddonSku[] = [
  { id: 'addon-drain-hose', name: 'Heavy Duty Flexible PVC Drain Hose', pricePhp: 350, detail: '3 meters · includes installation' },
  { id: 'addon-freon', name: 'Freon R410A Top-up', pricePhp: 2200, detail: 'Up to 1.5 HP unit · leak test included' },
  { id: 'addon-unclog', name: 'Minor Drain Unclogging', pricePhp: 1000, detail: 'Pressure flush of indoor drain line' },
];

export const HELPERS: HelperProfile[] = [
  {
    id: 'sofia', name: 'Sofia R.', avatarUrl: '', category: 'Math Tutor',
    rating: 5.0, reviewCount: 14, distanceKm: 1.2, hourlyRatePhp: 350, isAvailable: true, badgeLabel: 'Verified',
    bio: 'Licensed teacher helping Grade 1–12 students in Centro and Ugac Norte with math, homework and test prep.',
    credentials: ['NBI Clearance', 'LET Passer', 'ID Verified'],
    skus: [SKUS['mathTutor'], SKUS['scienceTutor']],
    reviews: [
      { author: 'Mia S.', rating: 5, when: 'Oct 12', text: 'Patient and clear — my son finally gets fractions.' },
      { author: 'Paolo R.', rating: 5, when: 'Oct 3', text: 'Great test prep session, very organised.' },
      { author: 'Jen D.', rating: 5, when: 'Sep 28', text: 'Always on time and well prepared.' },
    ],
    jobsDone: 28, yearsExperience: 4,
  },
  {
    id: 'daniel', name: 'Daniel K.', avatarUrl: 'assets/avatars/daniel.png', category: 'Electronics & IT',
    rating: 4.9, reviewCount: 28, distanceKm: 2.5, hourlyRatePhp: 500, isAvailable: true, badgeLabel: 'Top Pro',
    bio: 'I help Tuguegarao households with aircon, electrical and electronics repairs. I arrive with tools and explain every step.',
    credentials: ['NBI Clearance', 'TESDA RAC NC II', 'Electrical Installation NC II'],
    skus: [SKUS['acLeak'], SKUS['elecInspect'], SKUS['laptopDiag']],
    reviews: [
      { author: 'Mia S.', rating: 5, when: 'Oct 10', text: 'Found the leak quickly and explained every step. Everything was spotless after.' },
      { author: 'Carlo B.', rating: 5, when: 'Oct 6', text: 'Fast, honest and clean work on our split-type AC.' },
      { author: 'Anne T.', rating: 4, when: 'Sep 30', text: 'Good job on the outlet repair. Slightly late but messaged ahead.' },
    ],
    jobsDone: 142, yearsExperience: 5,
  },
  {
    id: 'chris', name: 'Chris L.', avatarUrl: '', category: 'Handyman',
    rating: 4.8, reviewCount: 19, distanceKm: 0.8, hourlyRatePhp: 400, isAvailable: true,
    bio: 'Furniture assembly, mounting, minor carpentry and repainting around the house.',
    credentials: ['NBI Clearance', 'ID Verified'],
    skus: [SKUS['handyman']],
    reviews: [
      { author: 'Lea P.', rating: 5, when: 'Oct 9', text: 'Assembled two wardrobes in an hour. Neat work.' },
      { author: 'Rico V.', rating: 5, when: 'Oct 1', text: 'Mounted our TV perfectly level.' },
      { author: 'Gab C.', rating: 4, when: 'Sep 22', text: 'Good work, brought his own drill.' },
    ],
    jobsDone: 37, yearsExperience: 6,
  },
  {
    id: 'ava', name: 'Ava L.', avatarUrl: 'assets/avatars/ava.png', category: 'Beauty & Care',
    rating: 5.0, reviewCount: 31, distanceKm: 3.1, hourlyRatePhp: 450, isAvailable: true,
    bio: 'Home haircuts, styling and nail care for busy families and seniors.',
    credentials: ['NBI Clearance', 'TESDA Hairdressing NC II'],
    skus: [SKUS['hairTrim']],
    reviews: [
      { author: 'Tess A.', rating: 5, when: 'Oct 11', text: 'Lola loved her new haircut. So gentle.' },
      { author: 'Kim N.', rating: 5, when: 'Oct 5', text: 'Professional and very clean setup.' },
      { author: 'Bea L.', rating: 5, when: 'Sep 29', text: 'Booked again for the whole family.' },
    ],
    jobsDone: 64, yearsExperience: 7,
  },
  {
    id: 'kevin', name: 'Kevin T.', avatarUrl: '', category: 'Tech Help',
    rating: 4.7, reviewCount: 21, distanceKm: 3.1, hourlyRatePhp: 500, isAvailable: true,
    bio: 'Laptop and phone setup, software support and Wi-Fi troubleshooting.',
    credentials: ['NBI Clearance', 'ID Verified'],
    skus: [SKUS['laptopDiag']],
    reviews: [
      { author: 'Joy F.', rating: 5, when: 'Oct 8', text: 'Fixed our Wi-Fi dead zones.' },
      { author: 'Ben S.', rating: 4, when: 'Oct 2', text: 'Set up my new laptop and printer.' },
      { author: 'Rose M.', rating: 5, when: 'Sep 25', text: 'Very patient with my questions.' },
    ],
    jobsDone: 25, yearsExperience: 3,
  },
];

export const HELPER_CATEGORIES: Record<string, string[]> = {
  sofia: ['tutoring'],
  daniel: ['repairs', 'tech'],
  chris: ['repairs'],
  ava: ['beauty'],
  kevin: ['tech'],
};

export const BULLETIN_REQUESTS: BulletinRequest[] = [
  { id: 'req-1', title: 'Math Tutor for Grade 8', description: 'Algebra help twice a week after school.', category: 'tutoring', author: 'Mia S.', postedAgo: '2 mins ago', neighborhood: 'Barangay Centro 10', distanceKm: 1.2, pricePhp: 350, priceUnit: 'hr', status: 'OPEN' },
  { id: 'req-2', title: 'Split AC Water Leak Repair', description: 'Water dripping from indoor unit since this morning.', category: 'repairs', author: 'Carlo B.', postedAgo: '15 mins ago', neighborhood: 'Barangay Ugac Norte', distanceKm: 1.4, pricePhp: 1100, priceUnit: 'job', status: 'URGENT' },
  { id: 'req-3', title: 'Grocery Pickup — Public Market', description: 'Weekly groceries for a senior resident. List provided.', category: 'errands', author: 'Lola Remy', postedAgo: '1 hour ago', neighborhood: 'Barangay Centro 5', distanceKm: 0.8, pricePhp: 150, priceUnit: 'errand', status: 'OPEN' },
  { id: 'req-4', title: 'Laptop Setup Assistance', description: 'Set up a new laptop and install school software.', category: 'tech', author: 'Joy F.', postedAgo: '3 hours ago', neighborhood: 'Barangay Tanza', distanceKm: 2.6, pricePhp: 500, priceUnit: 'hr', status: 'ACCEPTED' },
  { id: 'req-5', title: 'Home Haircut for Lola', description: 'Simple trim at home, mornings preferred.', category: 'beauty', author: 'Tess A.', postedAgo: '5 hours ago', neighborhood: 'Barangay Caritan Centro', distanceKm: 4.2, pricePhp: 450, priceUnit: 'hr', status: 'OPEN' },
  { id: 'req-6', title: 'Kitchen Faucet Leak', description: 'Faucet base leaking under the sink.', category: 'repairs', author: 'Anne T.', postedAgo: 'Yesterday', neighborhood: 'Barangay Atulayan Sur', distanceKm: 2.1, pricePhp: 1500, priceUnit: 'job', status: 'COMPLETED' },
];

export const PAST_ORDERS = [
  { id: 'SRV-8807', title: 'Laptop Repair Pickup', helper: 'Kevin T.', when: 'Yesterday, 4:10 PM', amountPhp: 550 },
  { id: 'SRV-8790', title: 'Faucet & Sink Leak Fix', helper: 'Daniel K.', when: 'Oct 10, 11:20 AM', amountPhp: 1550 },
  { id: 'SRV-8772', title: 'Grocery Pickup Help', helper: 'Ava L.', when: 'Oct 6, 2:15 PM', amountPhp: 200 },
];

export const SEED_CHAT: ChatMessage[] = [
  { id: 'm0', from: 'system', text: 'Order #SRV-8821 accepted. Escrow of ₱1,150 authorized.', time: '10:28 AM' },
  { id: 'm1', from: 'helper', text: 'Hi Sophia! I’m on my way. Is parking available near the gate?', time: '10:35 AM' },
  { id: 'm2', from: 'customer', text: 'Yes, use Gate 2. The guard can point you to visitor parking.', time: '10:36 AM' },
  { id: 'm3', from: 'helper', text: 'Perfect, thank you. I’ll message when I arrive.', time: '10:36 AM' },
];

export const SEED_LEDGER: LedgerEntry[] = [
  { id: 'l-1', kind: 'escrow', amountPhp: 1275, title: 'Pipe Leak Repair', detail: 'Order #SRV-8819 · In Escrow', when: 'Today, 8:05 AM' },
  { id: 'l-2', kind: 'credit', amountPhp: 1375, title: 'Faucet & Sink Leak Fix', detail: 'Order #SRV-8820 · Completed · incl. ₱100 tip', when: 'Today, 9:42 AM' },
  { id: 'l-3', kind: 'credit', amountPhp: 1508.75, title: 'AC Cleaning', detail: 'Order #SRV-8817 · Completed', when: 'Today, 7:30 AM' },
  { id: 'l-4', kind: 'credit', amountPhp: 432.5, title: 'Electrical Inspection', detail: 'Order #SRV-8812 · Completed · incl. ₱50 tip', when: 'Today, 6:55 AM' },
  { id: 'l-5', kind: 'debit', amountPhp: -2500, title: 'Cashout to GCash 0917***4567', detail: 'InstaPay · ₱15 fee', when: 'Oct 12, 6:00 PM' },
];
