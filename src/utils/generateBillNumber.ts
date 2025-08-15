import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "../../firebase";
export async function generateBillNumber(): Promise<string> {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  
  const prefix = `POS-${year}${month}${day}-`;

  const startOfToday = new Date(year, today.getMonth(), today.getDate(), 0, 0, 0);
  const startOfTodayTimestamp = Timestamp.fromDate(startOfToday);

  const salesRef = collection(db, "sales");
  const q = query(salesRef, where("soldAt", ">=", startOfTodayTimestamp));
  
  const querySnapshot = await getDocs(q);
  const todayCount = querySnapshot.size;

  const nextNumber = String(todayCount + 1).padStart(3, '0');

  return `${prefix}${nextNumber}`;
}