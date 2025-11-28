import { Customer } from './customer';
import { SaleItem } from './sale';

export interface ActiveBill {
  id: number;
  label: string;
  cart: SaleItem[];
  customer: Customer | null;
  walkInName: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number | '';
  loyaltyPointsToUse: number;
  paymentMode: 'Cash' | 'Card' | 'UPI';
  amountReceived: number | '';
  
  // NEW: Fields for Edit Mode
  existingSaleId?: string; 
  billNumber?: string;
}

// Factory function to create a new bill state with a specific ID
export const createEmptyBill = (id: number): ActiveBill => ({
  id,
  label: `Bill ${id}`,
  cart: [],
  customer: null,
  walkInName: '',
  discountType: 'percentage',
  discountValue: '',
  loyaltyPointsToUse: 0,
  paymentMode: 'Cash',
  amountReceived: '',
  
  // Initialize as undefined for new bills
  existingSaleId: undefined,
  billNumber: undefined
});