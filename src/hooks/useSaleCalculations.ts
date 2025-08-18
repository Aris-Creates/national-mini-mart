// src/hooks/useSaleCalculations.ts
import { useMemo } from 'react';
import { SaleItem } from '../types/sale';

const LOYALTY_POINT_VALUE = 5; // Assuming this is constant

interface UseSaleCalculationsProps {
  items: SaleItem[];
  discountType: 'percentage' | 'fixed';
  discountValue: number | '';
  loyaltyPointsToUse: number;
  customer?: { loyaltyPoints: number } | null; 
}

export function useSaleCalculations({
  items,
  discountType,
  discountValue,
  loyaltyPointsToUse,
  customer,
}: UseSaleCalculationsProps) {
  
  return useMemo(() => {
    // **FIX 1: UI Subtotal is now calculated from `priceAtSale`**
    // This is the actual total of items in the cart before any cart-level discounts.
    const uiSubtotal = items.reduce((acc, item) => acc + item.priceAtSale * item.quantity, 0);

    // **FIX 2: DB totals are now correctly derived from `priceAtSale` and `gstRate`**
    // This accurately separates the pre-tax base price and GST for accounting.
    const dbTotals = items.reduce((acc, item) => {
      const itemTotal = item.priceAtSale * item.quantity;
      // Reverse calculate the base price from the tax-inclusive sale price
      const basePriceTotal = itemTotal / (1 + item.gstRate / 100);
      const itemGst = itemTotal - basePriceTotal;
      
      acc.subTotal += basePriceTotal;
      acc.gstAmount += itemGst;
      return acc;
    }, { subTotal: 0, gstAmount: 0 });


    // The rest of the logic now works correctly because its inputs are accurate.
    let calculatedAddDiscount = 0;
    const val = Number(discountValue);
    if (val > 0) {
      if (discountType === 'percentage') {
        // This now correctly applies the percentage to the actual cart total
        calculatedAddDiscount = uiSubtotal * (val / 100);
      } else {
        calculatedAddDiscount = val;
      }
    }
    const finalAddDiscount = Math.min(calculatedAddDiscount, uiSubtotal);

    const totalBeforeLoyalty = uiSubtotal - finalAddDiscount;
    const maxPointsValue = Math.floor(totalBeforeLoyalty);
    const maxPointsCanUse = customer ? Math.min(customer.loyaltyPoints, Math.floor(maxPointsValue / LOYALTY_POINT_VALUE)) : 0;
    const actualPointsToUse = Math.max(0, Math.min(loyaltyPointsToUse, maxPointsCanUse));
    const lDiscount = actualPointsToUse * LOYALTY_POINT_VALUE;
    const preRoundTotal = totalBeforeLoyalty - lDiscount;
    const finalTotal = Math.round(preRoundTotal);
    const roundOff = finalTotal - preRoundTotal;

    return {
      displaySubtotal: uiSubtotal,
      additionalDiscountAmount: finalAddDiscount,
      loyaltyDiscount: lDiscount,
      totalAmount: finalTotal,
      roundOffAmount: roundOff,
      subTotalForDb: dbTotals.subTotal,
      gstForDb: dbTotals.gstAmount,
    };
  }, [items, customer, loyaltyPointsToUse, discountType, discountValue]);
}