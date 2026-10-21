// ui models
export type RequestStatus = 'OPEN' | 'URGENT' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface StepMilestone {
  index: number;
  label: string;
  isCompleted: boolean;
  isActive: boolean;
  time?: string;
}

export interface HelperSummary {
  id: string;
  name: string;
  avatarUrl: string;
  category: string;
  rating: number;
  reviewCount: number;
  distanceKm: number;
  hourlyRatePhp: number;
  rateUnit?: string;
  isAvailable: boolean;
  badgeLabel?: string;
}

export type CategoryId = 'tutoring' | 'repairs' | 'errands' | 'beauty' | 'tech';

export interface Category {
  id: CategoryId;
  label: string;
  shortLabel: string;
  caption: string;
  icon: string;
  tint: string;
  accent: string;
}

export const DEFAULT_STEP_LABELS = ['Posted', 'Accepted', 'On the Way', 'Arrived', 'Done'] as const;

export function buildMilestones(
  activeIndex: number,
  labels: readonly string[] = DEFAULT_STEP_LABELS,
  times: (string | undefined)[] = [],
): StepMilestone[] {
  return labels.map((label, index) => ({
    index,
    label,
    isCompleted: index < activeIndex || (activeIndex >= labels.length - 1 && index === labels.length - 1),
    isActive: index === activeIndex && activeIndex < labels.length - 1,
    time: times[index],
  }));
}
