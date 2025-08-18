// src/types/product.ts
import { Timestamp } from "firebase/firestore";

export interface Product {
  id: string;
  name: string;
  costPrice: number; // Price the store paid for the item
  mrp: number; // Maximum Retail Price (sticker price)
  sellingPrice?: number; // Optional discounted price, overrides MRP if present and lower
  stock_quantity: number;
  min_stock_level: number;
  gst_rate: number;
  hsn_code: string;
  brand: string;
  barcode?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}