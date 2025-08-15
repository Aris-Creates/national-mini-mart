import { Timestamp } from "firebase/firestore";

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  priceAtSale: number;
}

export interface Sale {
  id: string;
  billNumber: string;
  customerId?: string | null;
  customerName: string;
  items: SaleItem[];
  subTotal: number;
  discount: number;
  gst?: number;
  totalAmount: number;
  paymentMode: 'Cash' | 'UPI' | 'Card' | 'Other';
  amountReceived?: number;
  changeGiven?: number;
  loyaltyPointsEarned: number;
  loyaltyPointsUsed: number;
  soldAt: Timestamp;
  soldBy: string;
  
}