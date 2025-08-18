// src/types/sale.ts
import { Timestamp } from "firebase/firestore";

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  mrp: number; // The original MRP at the time of sale
  priceAtSale: number; // The price the customer actually paid per unit
  costPriceAtSale: number; // The store's cost at the time of sale
  gstRate: number;
}

export interface Sale {
  id: string;
  billNumber: string;
  items: SaleItem[];
  customerName: string;
  customerId?: string;
  subTotal: number; // Sum of items' pre-tax base price
  discount: number;
  additionalDiscount?: {
    type: 'percentage' | 'fixed';
    value: number;
    amount: number;
  };
  gst: number; // Total GST amount
  roundOff: number;
  totalAmount: number;
  paymentMode: 'Cash' | 'Card' | 'UPI';
  amountReceived: number;
  changeGiven: number;
  loyaltyPointsEarned: number;
  loyaltyPointsUsed: number;
  soldAt: Timestamp;
  soldBy: string;
  updatedAt?: Timestamp;
}