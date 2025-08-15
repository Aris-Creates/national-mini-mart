const LOYALTY_RATE = 100; // 1 point per ₹100

export function calculateLoyaltyPoints(totalAmount: number): number {
  if (totalAmount < LOYALTY_RATE) return 0;
  return Math.floor(totalAmount / LOYALTY_RATE);
}