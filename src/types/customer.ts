import { Timestamp } from "firebase/firestore";

export interface Customer {
  id: string;
  phone: string;
  name: string;
  address?: string;
  loyaltyPoints: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}