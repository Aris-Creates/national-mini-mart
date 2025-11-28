import { Timestamp } from 'firebase/firestore';

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  
  mrp: number;
  priceAtSale: number;
  costPriceAtSale: number;
  gstRate: number;
  
  unitType: 'piece' | 'weight';
  unitValue: number;
  isGstInclusive: boolean;

  // NEW: To highlight in UI
  isFreeItem?: boolean; 
}

export interface Sale {
  id: string;
  billNumber: string;
  items: SaleItem[];
  
  customerName: string;
  customerId?: string;
  
  subTotal: number;
  discount: number;
  additionalDiscount?: {
    type: 'percentage' | 'fixed';
    value: number;
    amount: number;
  };
  loyaltyDiscount?: number;
  
  gst: number;
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