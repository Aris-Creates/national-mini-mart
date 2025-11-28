import { Timestamp } from "firebase/firestore";

export interface Product {
  id: string;
  name: string;
  
  // Hierarchy
  category: string;
  sub_category: string;
  brand: string;

  // Pricing
  costPrice: number;
  is_gst_inclusive: boolean;
  gst_rate: number;
  mrp: number;
  sellingPrice?: number;

  // Inventory & Units
  stock_quantity: number;
  min_stock_level: number;
  unit_type: 'piece' | 'weight';
  unit_value: number;

  // Free Item Logic (Typical POS Structure)
  hasFreeItem: boolean;
  freeProductId?: string; // ID of the product given for free
  freeProductName?: string; // Snapshot of name for display
  freeItemQuantity?: number; // How many to give per 1 unit of main item

  // Meta
  productCode: string;
  hsn_code: string;
  barcode?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}