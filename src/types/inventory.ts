import { Timestamp } from "firebase/firestore";

export interface InventoryLog {
  id: string;
  productId: string;
  productName: string;
  quantityAdded: number;
  addedBy: string;
  addedAt: Timestamp;
}