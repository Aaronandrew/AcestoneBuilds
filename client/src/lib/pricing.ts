export const PRICING_RATES = {
  kitchen: 200,
  bathroom: 150,
  painting: 2.50,
  flooring: 5.00,
  roofing: 9.00,
} as const;

export const RUSH_MARKUP = 0.15; // 15% markup for rush jobs

export function calculateQuote(
  jobType: keyof typeof PRICING_RATES,
  squareFootage: number,
  urgency: 'normal' | 'rush'
): number {
  const baseRate = PRICING_RATES[jobType];
  let total = baseRate * squareFootage;
  
  if (urgency === 'rush') {
    total = total * (1 + RUSH_MARKUP);
  }
  
  return Math.round(total * 100) / 100; // Round to 2 decimal places
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export const JOB_TYPE_LABELS = {
  kitchen: 'Kitchen Remodel',
  bathroom: 'Bathroom Remodel',
  painting: 'Painting',
  flooring: 'Flooring',
  roofing: 'Roofing',
} as const;

export const URGENCY_LABELS = {
  normal: 'Normal Timeline',
  rush: 'Rush Job (+15%)',
} as const;
