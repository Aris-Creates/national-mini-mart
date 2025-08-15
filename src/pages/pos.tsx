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
import { printThermalReceipt, downloadPdfReceipt } from '../lib/printing';
import { ProductSearch } from '../components/pos/ProductSearch';
import { ShoppingCart } from '../components/pos/ShoppingCart';

const GST_RATE = 0.18;
const docToProduct = (doc: DocumentData): Product => ({
  id: doc.id,
  name: doc.data().name || '',
  barcode: doc.data().barcode || '',
  mrp: doc.data().mrp || 0,
  stock: doc.data().stock || 0,
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
  const [discount, setDiscount] = useState(0);
  const [saleKey, setSaleKey] = useState(1);

  const { subTotal, gstAmount, totalAmount } = useMemo(() => {
    const sub = cart.reduce((acc, item) => acc + item.priceAtSale * item.quantity, 0);
    const gst = sub * GST_RATE;
    const preRoundTotal = sub + gst - discount;
    return { subTotal: sub, gstAmount: gst, totalAmount: Math.round(preRoundTotal) };
  }, [cart, discount]);

  const handleAddToCart = (product: Product) => {
    if (product.stock <= 0) {
      alert("This product is out of stock!");
      return;
    }
    const existingItem = cart.find(item => item.productId === product.id);
    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        alert("Cannot add more than available stock.");
        return;
      }
      setCart(cart.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { productId: product.id, productName: product.name, quantity: 1, priceAtSale: product.mrp }]);
    }
  };

  const handleBarcodeScan = async (barcode: string) => {
    try {
      const q = query(collection(db, "products"), where("barcode", "==", barcode), limit(1));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        handleAddToCart(docToProduct(snapshot.docs[0]));
      } else {
        alert(`Product with barcode "${barcode}" not found.`);
      }
    } catch (error) {
      console.error("Error fetching product by barcode:", error);
    }
  };

  useBarcodeScanner(handleBarcodeScan, !lastSale);

  const handleUpdateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setCart(cart.filter(item => item.productId !== productId));
    } else {
      setCart(cart.map(item => item.productId === productId ? { ...item, quantity: newQuantity } : item));
    }
  };

  const handleConfirmCheckout = async (paymentDetails: { paymentMode: 'Cash' | 'Card' | 'UPI', amountReceived: number | '' }) => {
    if (cart.length === 0 || isSubmitting) return;

    const finalSubTotal = cart.reduce((acc, item) => acc + item.priceAtSale * item.quantity, 0);
    const finalGstAmount = finalSubTotal * GST_RATE;
    const preRoundTotal = finalSubTotal + finalGstAmount - discount;
    const finalTotalAmount = Math.round(preRoundTotal);
    const roundOffAmount = finalTotalAmount - preRoundTotal;

    if (paymentDetails.paymentMode === 'Cash' && Number(paymentDetails.amountReceived) < finalTotalAmount) {
      alert("Amount received cannot be less than the total amount.");
      return;
    }

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      
      const saleDataForFirebase: Omit<Sale, 'id' | 'soldAt'> & { soldAt: any; gst?: number; roundOff?: number } = {
        billNumber: `B${Date.now()}`,
        items: cart,
        customerName: selectedCustomer?.name || walkInName.trim() || 'Walk-in Customer',
        ...(selectedCustomer && { customerId: selectedCustomer.id }),
        subTotal: finalSubTotal,
        discount: discount,
        gst: finalGstAmount,
        roundOff: roundOffAmount,
        totalAmount: finalTotalAmount,
        paymentMode: paymentDetails.paymentMode,
        amountReceived: paymentDetails.paymentMode === 'Cash' ? Number(paymentDetails.amountReceived) : finalTotalAmount,
        changeGiven: paymentDetails.paymentMode === 'Cash' ? Math.max(0, Number(paymentDetails.amountReceived) - finalTotalAmount) : 0,
        loyaltyPointsEarned: selectedCustomer ? Math.floor(finalTotalAmount / 100) : 0,
        loyaltyPointsUsed: 0,
        soldAt: serverTimestamp(),
        soldBy: user?.email || user?.uid || 'System',
      };
      
      const saleRef = doc(collection(db, "sales"));
      batch.set(saleRef, saleDataForFirebase);
      
      cart.forEach(item => {
        const productRef = doc(db, "products", item.productId);
        batch.update(productRef, { stock: increment(-item.quantity), updatedAt: serverTimestamp() });
      });
      
      if (selectedCustomer) {
        const customerRef = doc(db, "customers", selectedCustomer.id);
        batch.update(customerRef, { loyaltyPoints: increment(saleDataForFirebase.loyaltyPointsEarned), updatedAt: serverTimestamp() });
      }

      await batch.commit();
      
      const finalSaleObject: Sale = { ...saleDataForFirebase, id: saleRef.id, soldAt: Timestamp.now() };
      setLastSale(finalSaleObject);
      setCart([]);

      // --- CHANGE: Refresh the ProductSearch component immediately upon sale completion ---
      setSaleKey(prevKey => prevKey + 1);

    } catch (err) {
      console.error("Checkout failed:", err);
      alert("An error occurred during checkout. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handlePrint = () => { if (receiptRef.current) printThermalReceipt(receiptRef.current); };
  const handleDownloadPdf = () => { if (receiptRef.current && lastSale) downloadPdfReceipt(receiptRef.current, `receipt-${lastSale.billNumber}.pdf`); };

  const handleNewSale = () => {
    // This function now just resets the cart/sale state.
    // The ProductSearch refresh has already happened.
    setLastSale(null);
    setSelectedCustomer(null);
    setWalkInName('');
    setDiscount(0);
  };

  return (
    <div className="bg-slate-900 text-white min-h-screen p-6 font-sans">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">POS Billing</h1>
        <p className="text-slate-400">Process sales and manage transactions</p>
      </header>
      
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ProductSearch 
          key={saleKey} 
          onAddToCart={handleAddToCart} 
        />
        
        <ShoppingCart 
          cart={cart}
          lastSale={lastSale}
          isSubmitting={isSubmitting}
          onUpdateQuantity={handleUpdateQuantity}
          onConfirmCheckout={handleConfirmCheckout}
          onPrint={handlePrint}
          onDownloadPdf={handleDownloadPdf}
          onNewSale={handleNewSale}
          selectedCustomer={selectedCustomer}
          onSelectCustomer={setSelectedCustomer}
          walkInName={walkInName}
          setWalkInName={setWalkInName}
          discount={discount}
          onDiscountChange={setDiscount}
        />
      </main>

      <div className="hidden">
        {lastSale && <ThermalLayout ref={receiptRef} sale={lastSale} storeDetails={{ name: "The Corner Store", address: "123 Main St", phone: "555-123-4567" }}/>}
      </div>
    </div>
  );
}