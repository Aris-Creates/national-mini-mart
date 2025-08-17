import { Timestamp } from "firebase/firestore";

export interface Product {
  id: string;
  barcode: string;
  name: string;
  mrp: number; // Final, tax-inclusive price
  discountPrice?: number;
  stock: number;
  gstRate?: number; // The GST percentage (e.g., 18 for 18%)
  imageUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}