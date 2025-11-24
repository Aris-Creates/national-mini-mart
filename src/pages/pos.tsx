// src/pages/PosPage.tsx
import { useState, useRef, useEffect, useCallback } from 'react'; // ADDED: useEffect, useCallback
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

  // NEW: State to trigger the direct-to-print workflow
  const [shouldPrintOnSaleComplete, setShouldPrintOnSaleComplete] = useState(false);

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
    customer: selectedCustomer,
  });

  const handleAddToCart = (product: Product) => {
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

  // MODIFIED: The function now accepts an `andThenPrint` flag.
  const handleConfirmCheckout = async (
    paymentDetails: { paymentMode: 'Cash' | 'Card' | 'UPI', amountReceived: number | '' },
    andThenPrint: boolean = false
  ) => {
    if (cart.length === 0 || isSubmitting) return;
    if (paymentDetails.paymentMode === 'Cash' && Number(paymentDetails.amountReceived) < totalAmount) {
      alert("Amount received cannot be less than the total amount."); return;
    }

    // NEW: Set the print trigger flag based on how this function was called.
    setShouldPrintOnSaleComplete(andThenPrint);

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      const productSavings = cart.reduce((acc, item) => acc + (item.mrp - item.priceAtSale) * item.quantity, 0);
      const pointsEarned = selectedCustomer ? Math.floor(totalAmount / 100) : 0;
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
        soldBy: profile?.email || profile?.uid || 'System',
      };
      const saleRef = doc(collection(db, "sales"));
      batch.set(saleRef, saleDataForFirebase);
      cart.forEach(item => { const productRef = doc(db, "products", item.productId); batch.update(productRef, { stock_quantity: increment(-item.quantity), updatedAt: serverTimestamp() }); });

      if (selectedCustomer) {
        const customerRef = doc(db, "customers", selectedCustomer.id);
        const pointsChange = pointsEarned - pointsUsed;
        batch.update(customerRef, { loyaltyPoints: increment(pointsChange), updatedAt: serverTimestamp() });
      }

      await batch.commit();
      const finalSaleObject: Sale = { ...saleDataForFirebase, id: saleRef.id, soldAt: Timestamp.now() };

      // Setting lastSale will trigger the overlay OR our new print effect
      setLastSale(finalSaleObject);

      // Reset cart state for the next sale (customer is reset in handleNewSale)
      setCart([]);
      setDiscountValue('');
      setLoyaltyPointsToUse(0);
    } catch (err) { console.error("Checkout failed:", err); alert("An error occurred during checkout. Please try again."); }
    finally { setIsSubmitting(false); }
  };

  const handlePrint = useCallback(() => {
    if (receiptRef.current) {
      printThermalReceipt(receiptRef.current);
    }
  }, []);

  const handleNewSale = useCallback(() => {
    setLastSale(null);
    setSelectedCustomer(null);
    setWalkInName('');
    setLoyaltyPointsToUse(0);
    setDiscountValue('');
    setSaleKey(prevKey => prevKey + 1);
  }, []);

  // NEW: This effect handles the direct-to-print workflow
  useEffect(() => {
    // It runs when a sale is completed AND the print flag was set
    if (shouldPrintOnSaleComplete && lastSale && receiptRef.current) {
      // Trigger the print function
      handlePrint();

      // Immediately reset for the next sale, bypassing overlay interaction.
      handleNewSale();

      // Reset the trigger flag.
      setShouldPrintOnSaleComplete(false);
    }
  }, [lastSale, shouldPrintOnSaleComplete, handlePrint, handleNewSale]);

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
            onConfirmCheckout={handleConfirmCheckout} // This now supports the direct-print flag
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

      {/* MODIFIED: Don't show overlay if we are in the direct-to-print flow */}
      {lastSale && !shouldPrintOnSaleComplete && (
        <SaleCompleteOverlay
          lastSale={lastSale}
          onPrint={handlePrint}
          onNewSale={handleNewSale}
        />
      )}

      <div className="hidden">
        {lastSale && (
          <ThermalLayout
            ref={receiptRef}
            sale={lastSale}
            storeDetails={{
              name: "National Mini Mart",
              address: "140/115, Hospital Road, Ooty, 643091",
              phone: "0423 2446089",
              mobile: "9092484510",
              gst: "33AUBPM5493L1ZA"
            }}
          />
        )}
      </div>
    </div>
  );
}