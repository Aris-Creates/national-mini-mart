import { Timestamp } from "firebase/firestore";

export interface Product {
  id: string;
  barcode: string;
  name: string;
  mrp: number;
  discountPrice?: number;
  stock: number;
  imageUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}