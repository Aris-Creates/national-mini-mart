// src/pages/PosPage.tsx
import { useState, useRef } from 'react';
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
import { useSaleCalculations } from '../hooks/useSaleCalculations';

const docToProduct = (doc: DocumentData): Product => {
    // ... docToProduct converter remains the same
    const data = doc.data();
    return {
        id: doc.id,
        name: data.name || '',
        costPrice: data.costPrice || 0,
        mrp: data.mrp || 0,
        sellingPrice: data.sellingPrice,
        stock_quantity: data.stock_quantity || 0,
        min_stock_level: data.min_stock_level || 0,
        gst_rate: data.gst_rate || 0,
        hsn_code: data.hsn_code || '',
        brand: data.brand || '',
        barcode: data.barcode || '',
        createdAt: data.createdAt as Timestamp,
        updatedAt: data.updatedAt as Timestamp,
    };
};

export default function PosPage() {
  // **FIXED**: Get the full user profile, including their role and other details.
  const { profile } = useAuth(); 
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
    displaySubtotal,
    additionalDiscountAmount,
    loyaltyDiscount,
    totalAmount,
    roundOffAmount,
    subTotalForDb,
    gstForDb,
  } = useSaleCalculations({
    items: cart,
    discountType,
    discountValue,
    loyaltyPointsToUse,
    customer: selectedCustomer, // Pass the selected customer to the hook
  });

  const handleAddToCart = (product: Product) => {
    // ... handleAddToCart logic remains the same
    if (product.stock_quantity <= 0) { alert("This product is out of stock!"); return; }
    const existingItem = cart.find(item => item.productId === product.id);
    if (existingItem) {
      if (existingItem.quantity >= product.stock_quantity) { alert("Cannot add more than available stock."); return; }
      setCart(cart.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      const priceAtSale = (product.sellingPrice && product.sellingPrice > 0 && product.sellingPrice < product.mrp)
        ? product.sellingPrice
        : product.mrp;

      const newSaleItem: SaleItem = {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        mrp: product.mrp,
        priceAtSale: priceAtSale,
        costPriceAtSale: product.costPrice,
        gstRate: product.gst_rate,
      };
      setCart([...cart, newSaleItem]);
    }
  };

  const handleBarcodeScan = async (barcode: string) => {
    // ... handleBarcodeScan logic remains the same
    try {
      const q = query(collection(db, "products"), where("barcode", "==", barcode), limit(1));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) { handleAddToCart(docToProduct(snapshot.docs[0])); }
      else { alert(`Product with barcode "${barcode}" not found.`); }
    } catch (error) { console.error("Error fetching product by barcode:", error); }
  };
  useBarcodeScanner(handleBarcodeScan, !lastSale);

  const handleUpdateQuantity = (productId: string, newQuantity: number) => {
    // ... handleUpdateQuantity logic remains the same
    if (newQuantity <= 0) { setCart(cart.filter(item => item.productId !== productId)); }
    else { setCart(cart.map(item => item.productId === productId ? { ...item, quantity: newQuantity } : item)); }
  };

  const handleConfirmCheckout = async (paymentDetails: { paymentMode: 'Cash' | 'Card' | 'UPI', amountReceived: number | '' }) => {
    if (cart.length === 0 || isSubmitting) return;
    if (paymentDetails.paymentMode === 'Cash' && Number(paymentDetails.amountReceived) < totalAmount) {
      alert("Amount received cannot be less than the total amount."); return;
    }
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      const productSavings = cart.reduce((acc, item) => acc + (item.mrp - item.priceAtSale) * item.quantity, 0);

      // **FIXED**: Correctly calculate points earned and used
      const pointsEarned = selectedCustomer ? Math.floor(totalAmount / 100) : 0;
      // The `useSaleCalculations` hook ensures `loyaltyDiscount` is valid, so we derive `pointsUsed` from it.
      const pointsUsed = loyaltyDiscount > 0 ? loyaltyPointsToUse : 0;

      const saleDataForFirebase: Omit<Sale, 'id' | 'soldAt'> & { soldAt: any } = {
        billNumber: `B${Date.now()}`,
        items: cart,
        customerName: selectedCustomer?.name || walkInName.trim() || 'Walk-in Customer',
        ...(selectedCustomer && { customerId: selectedCustomer.id }),
        subTotal: subTotalForDb,
        discount: productSavings,
        ...(additionalDiscountAmount > 0 && { additionalDiscount: { type: discountType, value: Number(discountValue), amount: additionalDiscountAmount } }),
        gst: gstForDb,
        roundOff: roundOffAmount,
        totalAmount: totalAmount,
        paymentMode: paymentDetails.paymentMode,
        amountReceived: paymentDetails.paymentMode === 'Cash' ? Number(paymentDetails.amountReceived) : totalAmount,
        changeGiven: paymentDetails.paymentMode === 'Cash' ? Math.max(0, Number(paymentDetails.amountReceived) - totalAmount) : 0,
        loyaltyPointsEarned: pointsEarned,
        loyaltyPointsUsed: pointsUsed,
        soldAt: serverTimestamp(),
        // Use the profile from useAuth to record who sold the item
        soldBy: profile?.email || profile?.uid || 'System',
      };
      const saleRef = doc(collection(db, "sales"));
      batch.set(saleRef, saleDataForFirebase);
      cart.forEach(item => { const productRef = doc(db, "products", item.productId); batch.update(productRef, { stock_quantity: increment(-item.quantity), updatedAt: serverTimestamp() }); });
      
      // **FIXED**: Correctly update customer's loyalty points
      if (selectedCustomer) {
        const customerRef = doc(db, "customers", selectedCustomer.id);
        const pointsChange = pointsEarned - pointsUsed;
        batch.update(customerRef, { loyaltyPoints: increment(pointsChange), updatedAt: serverTimestamp() });
      }

      await batch.commit();
      const finalSaleObject: Sale = { ...saleDataForFirebase, id: saleRef.id, soldAt: Timestamp.now() };
      setLastSale(finalSaleObject);
      setCart([]);
      setDiscountValue('');
      setLoyaltyPointsToUse(0); // Reset points used for next sale
    } catch (err) { console.error("Checkout failed:", err); alert("An error occurred during checkout. Please try again."); }
    finally { setIsSubmitting(false); }
  };

  const handlePrint = () => { if (receiptRef.current) printThermalReceipt(receiptRef.current); };
  const handleNewSale = () => { setLastSale(null); setSelectedCustomer(null); setWalkInName(''); setLoyaltyPointsToUse(0); setDiscountValue(''); setSaleKey(prevKey => prevKey + 1); };

  return (
    <div className="bg-gray-100 text-black min-h-screen font-sans">
      <header className="flex justify-between items-center p-4 border-b border-gray-300 bg-white">
        <div><h1 className="text-2xl font-bold text-gray-800">POS</h1><p className="text-sm text-gray-500">Logged in as {profile?.email}</p></div>
      </header>
      <main className="grid grid-cols-1 md:grid-cols-5 gap-6 p-6 h-[calc(100vh-81px)]">
        <div className="md:col-span-3 h-full"><ProductSearchPanel key={saleKey} onAddToCart={handleAddToCart} /></div>
        <div className="md:col-span-2 h-full">
          <OrderPanel
            cart={cart}
            isSubmitting={isSubmitting}
            onUpdateQuantity={handleUpdateQuantity}
            onConfirmCheckout={handleConfirmCheckout}
            selectedCustomer={selectedCustomer}
            onSelectCustomer={setSelectedCustomer}
            walkInName={walkInName}
            setWalkInName={setWalkInName}
            subTotal={displaySubtotal}
            loyaltyDiscount={loyaltyDiscount}
            totalAmount={totalAmount}
            loyaltyPointsToUse={loyaltyPointsToUse}
            onLoyaltyPointsChange={setLoyaltyPointsToUse}
            additionalDiscountAmount={additionalDiscountAmount}
            discountType={discountType}
            onDiscountTypeChange={setDiscountType}
            discountValue={discountValue}
            onDiscountValueChange={setDiscountValue} />
        </div>
      </main>
      {lastSale && (<SaleCompleteOverlay lastSale={lastSale} onPrint={handlePrint} onNewSale={handleNewSale} />)}
      <div className="hidden">{lastSale && <ThermalLayout ref={receiptRef} sale={lastSale} storeDetails={{ name: "National Mini Mart", address: "123 Main St", phone: "555-123-4567" }} />}</div>
    </div>
  );
}