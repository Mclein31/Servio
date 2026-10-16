import { demoId, DEMO } from './guard';

export const DEMO_LOCATIONS = [
  { barangay: 'Centro 10', lat: 17.6134, lng: 121.7305 },
  { barangay: 'Ugac Norte', lat: 17.618111, lng: 121.718927 },
  { barangay: 'Centro 5', lat: 17.608459, lng: 121.726858 },
  { barangay: 'Tanza', lat: 17.626467, lng: 121.735061 },
  { barangay: 'Caritan Centro', lat: 17.625031, lng: 121.721542 },
  { barangay: 'Atulayan Sur', lat: 17.634940, lng: 121.720236 },
] as const;
export const DEMO_ADDRESS = { street: 'Ugac Norte', barangay: 'Barangay Ugac Norte', city: 'Tuguegarao City', landmark: 'Residential lane off Bassig Street · meet at the entrance' };
export const DEMO_PROS = [
  { id: DEMO.daniel, email: 'demo.pro@servio.test', name: 'Daniel K.', headline: 'Electronics & IT', rating: 4.9, count: 28, jobs: 142, years: 5, location: 0,
    skus: ['sku-ac-leak','sku-elec-inspect','sku-laptop-diag'], credentials: ['NBI Clearance','TESDA RAC NC II','Electrical Installation NC II'],
    bio: 'I help Tuguegarao households with aircon, electrical and electronics repairs. I arrive with tools and explain every step.', image: 'daniel.png' },
  { id: DEMO.chris, email: 'demo.chris@servio.test', name: 'Chris L.', headline: 'Handyman', rating: 4.8, count: 19, jobs: 37, years: 6, location: 1,
    skus: ['sku-handyman'], credentials: ['NBI Clearance','ID Verified'], bio: 'Furniture assembly, mounting, minor carpentry and repainting around the house.', image: null },
  { id: DEMO.ava, email: 'demo.ava@servio.test', name: 'Ava L.', headline: 'Beauty & Care', rating: 5, count: 31, jobs: 64, years: 7, location: 4,
    skus: ['sku-hair'], credentials: ['NBI Clearance','TESDA Hairdressing NC II'], bio: 'Home haircuts, styling and nail care for busy families and seniors.', image: 'ava.png' },
  { id: DEMO.kevin, email: 'demo.kevin@servio.test', name: 'Kevin T.', headline: 'Tech Help', rating: 4.7, count: 21, jobs: 25, years: 3, location: 3,
    skus: ['sku-laptop-diag'], credentials: ['NBI Clearance','ID Verified'], bio: 'Laptop and phone setup, software support and Wi-Fi troubleshooting.', image: null },
  { id: DEMO.tutor, email: 'demo.tutor@servio.test', name: 'Sofia R.', headline: 'Math Tutor', rating: 5, count: 14, jobs: 28, years: 4, location: 2,
    skus: ['sku-math','sku-science'], credentials: ['NBI Clearance','LET Passer','ID Verified'], bio: 'Licensed teacher helping Grade 1–12 students in Centro and Ugac Norte with math, homework and test prep.', image: null },
] as const;
export const DEMO_AUTHORS = ['Mia S.', 'Carlo B.', 'Lola Remy', 'Joy F.', 'Tess A.', 'Anne T.'].map((name,i) => ({ id: demoId(20+i), name, email: `demo.neighbor${i+1}@servio.test` }));
export const DEMO_BULLETIN = [
  { skuId: 'sku-math', description: 'Algebra help twice a week after school.', status: 'OPEN', minutes: 2 },
  { skuId: 'sku-ac-leak', description: 'Water dripping from indoor unit since this morning.', status: 'URGENT', minutes: 15 },
  { skuId: 'sku-grocery', description: 'Weekly public market groceries for a senior resident. List provided.', status: 'OPEN', minutes: 60 },
  { skuId: 'sku-laptop-diag', description: 'Set up a new laptop and install school software.', status: 'ACCEPTED', minutes: 180 },
  { skuId: 'sku-hair', description: 'Simple trim at home, mornings preferred.', status: 'OPEN', minutes: 300 },
  { skuId: 'sku-sink-leak', description: 'Faucet base leaking under the sink.', status: 'COMPLETED', minutes: 1440 },
] as const;
export const DEMO_IMAGES = [
  { key: `uploads/avatar/2026/10/${demoId(9001)}.png`, ownerId: DEMO.customer, purpose: 'avatar' as const, file: 'avatars/sophia.png' },
  { key: `uploads/avatar/2026/10/${demoId(9002)}.png`, ownerId: DEMO.daniel, purpose: 'avatar' as const, file: 'avatars/daniel.png' },
  { key: `uploads/avatar/2026/10/${demoId(9003)}.png`, ownerId: DEMO.ava, purpose: 'avatar' as const, file: 'avatars/ava.png' },
  { key: `uploads/addon_evidence/2026/10/${demoId(9004)}.png`, ownerId: DEMO.daniel, purpose: 'addon_evidence' as const, file: 'design/sample-drain-hose-evidence.png' },
] as const;
