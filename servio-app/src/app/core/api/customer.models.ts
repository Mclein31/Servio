// api models
import { OrderStatus, EscrowState, PaymentMethod } from '../../shared/models/domain.models';
import { CategoryId, RequestStatus } from '../../shared/models/ui.models';

export interface SkuDto { id: string; categoryId: CategoryId; name: string; priceCentavos: number; unit: 'job' | 'hr' | 'errand' | 'visit'; durationLabel: string; inclusions: string[] }
export interface AddonDto { id: string; name: string; detail: string; priceCentavos: number }
export interface CatalogDto { skus: SkuDto[]; addons: AddonDto[]; trustFeeCentavos: number; cancellationFees: { enRouteCentavos: number; arrivedCentavos: number } }
export interface ProDto {
  id: string; name: string; avatarKey: string | null; headline: string | null; bio: string | null; credentials: string[];
  yearsExperience: number; jobsDone: number; rating: number; ratingCount: number; isOnline: boolean; distanceKm: number | null;
  fromPriceCentavos: number; skus: SkuDto[]; reviews: { id: string; author: string; rating: number; body: string | null; createdAt: string }[];
}
export interface BulletinDto { id: string; authorId: string; skuId: string; acceptedProId: string | null; bookingId: string | null; title: string; description: string; categoryId: CategoryId; author: string; createdAt: string; neighborhood: string; distanceKm: number | null; priceCentavos: number; unit: SkuDto['unit']; status: RequestStatus; lat: number | null; lng: number | null }
export interface BookingDto {
  id: string; code: string; customerId: string; proId: string | null; skuId: string; skuName: string; priceCentavos: number; trustFeeCentavos: number;
  address: { street: string; barangay: string; city: string; landmark?: string }; lat: number; lng: number; schedule: string;
  paymentMethod: PaymentMethod; status: OrderStatus; escrow: EscrowState; completionPin?: string; tipCentavos: number; expectedArrivalAt: string | null;
  events: { status: OrderStatus; createdAt: string; note: string | null }[];
  addons: { id: string; addonSkuId: string; addonName: string; priceCentavos: number; photoKey: string; note: string; createdAt: string; decision: 'PENDING' | 'APPROVED' | 'DECLINED' }[];
  customer: { id: string; name: string | null; avatarKey: string | null };
  pro: { id: string; name: string | null; avatarKey: string | null; rating: number; ratingCount: number } | null;
  reviewed: boolean;
  reviewRating?: number | null;
}
export interface MessageDto { id: string; senderId: string | null; body: string; photoKey: string | null; createdAt: string }
