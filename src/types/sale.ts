// src/types/sale.ts
import { Timestamp } from "firebase/firestore";

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  mrp: number;
  priceAtSale: number;
  gstRate?: number; // GST rate for this specific item
}

export interface Sale {
  id: string;
  billNumber: string;
  items: SaleItem[];
  customerName: string;
  customerId?: string;
  subTotal: number; // The total base price of all items (pre-tax, for DB)
  discount: number; // Sum of individual product-level discounts
  additionalDiscount?: {
    type: 'percentage' | 'fixed';
    value: number;
    amount: number;
  };
  gst: number; // The total GST amount from all items (for DB)
  roundOff: number;
  totalAmount: number;
  paymentMode: 'Cash' | 'Card' | 'UPI';
  amountReceived: number;
  changeGiven: number;
  loyaltyPointsEarned: number;
  loyaltyPointsUsed: number;
  soldAt: Timestamp;
  soldBy: string;
}