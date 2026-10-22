// domain models
import { CategoryId, HelperSummary, RequestStatus } from './ui.models';

export type OrderStatus =
  | 'PENDING_ACCEPTANCE'
  | 'ACCEPTED'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type EscrowState = 'NONE' | 'HOLD_AUTHORIZED' | 'COMPLETED' | 'REFUNDED';

export type PaymentMethod = 'GCASH' | 'CARD';

export interface ServiceSku {
  id: string;
  name: string;
  category: CategoryId;
  pricePhp: number;
  unit: 'job' | 'hr' | 'errand' | 'visit';
  durationLabel: string;
  inclusions: string[];
}

export interface AddonSku {
  id: string;
  name: string;
  pricePhp: number;
  detail: string;
}

export type AddonDecision = 'PENDING' | 'APPROVED' | 'DECLINED';

export interface AddonQuote {
  id: string;
  sku: AddonSku;
  photoUrl: string;
  note: string;
  createdAt: Date;
  decision: AddonDecision;
}

export interface Order {
  coordinates?: readonly [number, number];
  id: string;
  code?: string;
  customerId?: string;
  expectedArrivalAt?: string | null;
  reviewed?: boolean;
  sku: ServiceSku;
  helper: HelperSummary;
  customerName: string;
  customerAvatarUrl: string;
  address: { street: string; barangay: string; city: string; landmark: string };
  schedule: string;
  paymentMethod: PaymentMethod;
  trustFeePhp: number;
  discountPhp?: number;
  addons: AddonQuote[];
  status: OrderStatus;
  escrow: EscrowState;
  completionPin: string;
  tipPhp: number;
  statusTimes: Partial<Record<OrderStatus, Date>>;
}

export interface BulletinRequest {
  id: string;
  authorId?: string;
  skuId?: string;
  acceptedProId?: string | null;
  bookingId?: string | null;
  lat?: number;
  lng?: number;
  title: string;
  description: string;
  category: CategoryId;
  author: string;
  postedAgo: string;
  neighborhood: string;
  distanceKm: number;
  pricePhp: number;
  priceUnit?: 'hr' | 'job' | 'errand';
  status: RequestStatus;
}

export interface HelperReview {
  author: string;
  rating: number;
  when: string;
  text: string;
}

export interface HelperProfile extends HelperSummary {
  bio: string;
  credentials: string[];
  skus: ServiceSku[];
  reviews: HelperReview[];
  jobsDone: number;
  yearsExperience: number;
}

export interface ChatMessage {
  id: string;
  from: 'system' | 'helper' | 'customer';
  photoUrl?: string;
  text: string;
  time: string;
}

export type LedgerKind = 'credit' | 'debit' | 'escrow';

export interface LedgerEntry {
  id: string;
  kind: LedgerKind;
  amountPhp: number;
  title: string;
  detail: string;
  when: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}
