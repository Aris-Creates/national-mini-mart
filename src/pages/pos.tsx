// src/pages/PosPage.tsx
import { useState, useRef, useMemo } from 'react';
import { collection, writeBatch, doc, serverTimestamp, increment, Timestamp, query, where, getDocs, limit, DocumentData } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../hooks/useAuth';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { Sale, SaleItem } from '../types/sale';
import { Product } from '../types/product';
import { Customer } from '../types/customer';
import { ThermalLayout } from '../components/printing/ThermalLayout';
import { printThermalReceipt } from '../lib/printing';
import { ProductSearchPanel } from '../components/pos/ProductSearchPanel';
import { OrderPanel } from '../components/pos/OrderPanel';
import { SaleCompleteOverlay } from '../components/pos/SaleCompleteOverlay';
import { LogOut } from 'lucide-react';
import { Button } from '../components/ui/Button';

const FALLBACK_GST_RATE = 18;
const LOYALTY_POINT_VALUE = 5;

const docToProduct = (doc: DocumentData): Product => ({
  id: doc.id,
  name: doc.data().name || '',
  barcode: doc.data().barcode || '',
  mrp: doc.data().mrp || 0,
  discountPrice: doc.data().discountPrice,
  stock: doc.data().stock || 0,
  gstRate: doc.data().gstRate,
  createdAt: doc.data().createdAt as Timestamp,
  updatedAt: doc.data().updatedAt as Timestamp,
});

export default function PosPage() {
  const { user } = useAuth();
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [walkInName, setWalkInName] = useState('');
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const [loyaltyPointsToUse, setLoyaltyPointsToUse] = useState(0);
  const [saleKey, setSaleKey] = useState(1);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState<number | ''>('');

  const {
    displaySubtotal, totalDiscount, additionalDiscountAmount, loyaltyDiscount, totalAmount,
    subTotalForDb, gstForDb
  } = useMemo(() => {
    // Part 1: Accurate backend calculations (separating tax)
    const dbTotals = cart.reduce((acc, item) => {
      const itemTotal = item.priceAtSale * item.quantity;
      const gstRate = typeof item.gstRate === 'number' ? item.gstRate : FALLBACK_GST_RATE;
      const basePrice = itemTotal / (1 + gstRate / 100);
      const itemGst = itemTotal - basePrice;
      acc.subTotal += basePrice;
      acc.gstAmount += itemGst;
      return acc;
    }, { subTotal: 0, gstAmount: 0 });

    // Part 2: Simplified UI calculations (using tax-inclusive prices)
    const uiSubtotal = cart.reduce((acc, item) => acc + item.priceAtSale * item.quantity, 0);
    const productDiscounts = cart.reduce((acc, item) => acc + (item.mrp - item.priceAtSale) * item.quantity, 0);

    let calculatedAddDiscount = 0;
    const val = Number(discountValue);
    if (val > 0) {
      if (discountType === 'percentage') {
        calculatedAddDiscount = uiSubtotal * (val / 100);
      } else {
        calculatedAddDiscount = val;
      }
    }
    const finalAddDiscount = Math.min(calculatedAddDiscount, uiSubtotal);

    const totalBeforeLoyalty = uiSubtotal - finalAddDiscount;
    const maxPointsValue = Math.floor(totalBeforeLoyalty);
    const maxPointsCanUse = selectedCustomer ? Math.min(selectedCustomer.loyaltyPoints, Math.floor(maxPointsValue / LOYALTY_POINT_VALUE)) : 0;
    const actualPointsToUse = Math.max(0, Math.min(loyaltyPointsToUse, maxPointsCanUse));
    const lDiscount = actualPointsToUse * LOYALTY_POINT_VALUE;

    const preRoundTotal = totalBeforeLoyalty - lDiscount;

    return {
      displaySubtotal: uiSubtotal,
      totalDiscount: productDiscounts,
      additionalDiscountAmount: finalAddDiscount,
      loyaltyDiscount: lDiscount,
      totalAmount: Math.round(preRoundTotal),
      subTotalForDb: dbTotals.subTotal,
      gstForDb: dbTotals.gstAmount,
    };
  }, [cart, selectedCustomer, loyaltyPointsToUse, discountType, discountValue]);

  const handleAddToCart = (product: Product) => {
    if (product.stock <= 0) { alert("This product is out of stock!"); return; }
    const existingItem = cart.find(item => item.productId === product.id);
    if (existingItem) {
      if (existingItem.quantity >= product.stock) { alert("Cannot add more than available stock."); return; }
      setCart(cart.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      const priceAtSale = (product.discountPrice && product.discountPrice > 0 && product.discountPrice < product.mrp) ? product.discountPrice : product.mrp;
      setCart([...cart, { productId: product.id, productName: product.name, quantity: 1, mrp: product.mrp, priceAtSale: priceAtSale, gstRate: product.gstRate }]);
    }
  };

  const handleBarcodeScan = async (barcode: string) => {
    try {
      const q = query(collection(db, "products"), where("barcode", "==", barcode), limit(1));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) { handleAddToCart(docToProduct(snapshot.docs[0])); }
      else { alert(`Product with barcode "${barcode}" not found.`); }
    } catch (error) { console.error("Error fetching product by barcode:", error); }
  };
  useBarcodeScanner(handleBarcodeScan, !lastSale);

  const handleUpdateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) { setCart(cart.filter(item => item.productId !== productId)); }
    else { setCart(cart.map(item => item.productId === productId ? { ...item, quantity: newQuantity } : item)); }
  };

  const handleConfirmCheckout = async (paymentDetails: { paymentMode: 'Cash' | 'Card' | 'UPI', amountReceived: number | '' }) => {
    if (cart.length === 0 || isSubmitting) return;
    const preRoundTotal = displaySubtotal - additionalDiscountAmount - loyaltyDiscount;
    const roundOffAmount = totalAmount - preRoundTotal;
    if (paymentDetails.paymentMode === 'Cash' && Number(paymentDetails.amountReceived) < totalAmount) {
      alert("Amount received cannot be less than the total amount."); return;
    }
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      const saleDataForFirebase: Omit<Sale, 'id' | 'soldAt'> & { soldAt: any; gst?: number; roundOff?: number } = {
        billNumber: `B${Date.now()}`, items: cart, customerName: selectedCustomer?.name || walkInName.trim() || 'Walk-in Customer',
        ...(selectedCustomer && { customerId: selectedCustomer.id }),
        subTotal: subTotalForDb, discount: totalDiscount,
        ...(additionalDiscountAmount > 0 && { additionalDiscount: { type: discountType, value: Number(discountValue), amount: additionalDiscountAmount } }),
        gst: gstForDb, roundOff: roundOffAmount, totalAmount: totalAmount,
        paymentMode: paymentDetails.paymentMode, amountReceived: paymentDetails.paymentMode === 'Cash' ? Number(paymentDetails.amountReceived) : totalAmount,
        changeGiven: paymentDetails.paymentMode === 'Cash' ? Math.max(0, Number(paymentDetails.amountReceived) - totalAmount) : 0,
        loyaltyPointsEarned: selectedCustomer ? Math.floor(totalAmount / 100) : 0, loyaltyPointsUsed: loyaltyPointsToUse,
        soldAt: serverTimestamp(), soldBy: user?.email || user?.uid || 'System',
      };
      const saleRef = doc(collection(db, "sales"));
      batch.set(saleRef, saleDataForFirebase);
      cart.forEach(item => { const productRef = doc(db, "products", item.productId); batch.update(productRef, { stock: increment(-item.quantity), updatedAt: serverTimestamp() }); });
      if (selectedCustomer) { const customerRef = doc(db, "customers", selectedCustomer.id); const pointsChange = saleDataForFirebase.loyaltyPointsEarned - saleDataForFirebase.loyaltyPointsUsed; batch.update(customerRef, { loyaltyPoints: increment(pointsChange), updatedAt: serverTimestamp() }); }
      await batch.commit();
      const finalSaleObject: Sale = { ...saleDataForFirebase, id: saleRef.id, soldAt: Timestamp.now() };
      setLastSale(finalSaleObject); setCart([]); setDiscountValue('');
    } catch (err) { console.error("Checkout failed:", err); alert("An error occurred during checkout. Please try again."); }
    finally { setIsSubmitting(false); }
  };

  const handlePrint = () => { if (receiptRef.current) printThermalReceipt(receiptRef.current); };
  const handleNewSale = () => { setLastSale(null); setSelectedCustomer(null); setWalkInName(''); setLoyaltyPointsToUse(0); setDiscountValue(''); setSaleKey(prevKey => prevKey + 1); };

  return (
    <div className="bg-slate-900 text-white min-h-screen font-sans">
      <header className="flex justify-between items-center p-4 border-b border-slate-700/50">
        <div><h1 className="text-2xl font-bold">POS Terminal</h1><p className="text-sm text-slate-400">Logged in as {user?.email}</p></div>
        <Button variant="secondary"><LogOut size={20} className="mr-2" />Sign Out</Button>
      </header>
      <main className="grid grid-cols-1 md:grid-cols-5 gap-6 p-6 h-[calc(100vh-81px)]">
        <div className="md:col-span-3 h-full"><ProductSearchPanel key={saleKey} onAddToCart={handleAddToCart} /></div>
        <div className="md:col-span-2 h-full">
          <OrderPanel cart={cart} isSubmitting={isSubmitting} onUpdateQuantity={handleUpdateQuantity} onConfirmCheckout={handleConfirmCheckout}
            selectedCustomer={selectedCustomer} onSelectCustomer={setSelectedCustomer} walkInName={walkInName} setWalkInName={setWalkInName}
            subTotal={displaySubtotal} totalDiscount={totalDiscount} loyaltyDiscount={loyaltyDiscount} totalAmount={totalAmount}
            loyaltyPointsToUse={loyaltyPointsToUse} onLoyaltyPointsChange={setLoyaltyPointsToUse}
            additionalDiscountAmount={additionalDiscountAmount}
            discountType={discountType}
            onDiscountTypeChange={setDiscountType} // <-- CORRECTED: Pass the state setter function
            discountValue={discountValue}
            onDiscountValueChange={setDiscountValue}
          />
        </div>
      </main>
      {lastSale && (<SaleCompleteOverlay lastSale={lastSale} onPrint={handlePrint} onNewSale={handleNewSale} />)}
      <div className="hidden">{lastSale && <ThermalLayout ref={receiptRef} sale={lastSale} storeDetails={{ name: "National Mini Mart", address: "123 Main St", phone: "555-123-4567" }} />}</div>
    </div>
  );
}