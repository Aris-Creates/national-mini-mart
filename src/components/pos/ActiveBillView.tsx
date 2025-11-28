import { useRef, useEffect, useState } from 'react';
import { Trash2, Calculator, Edit3, AlertCircle } from 'lucide-react';
import { collection, doc, writeBatch, serverTimestamp, increment, Timestamp, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { Product } from '../../types/product';
import { ActiveBill } from '../../types/pos';
import { SaleItem, Sale } from '../../types/sale';
import { formatCurrency } from '../../utils/formatCurrency';
import { useSaleCalculations } from '../../hooks/useSaleCalculations';
import { ProductSearchInput, ProductSearchInputHandle } from './ProductSearchInput';
import { CustomerSelect } from './CustomerSelect';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { ThermalLayout } from '../../components/printing/ThermalLayout';
import { printThermalReceipt } from '../../lib/printing';

interface ActiveBillViewProps {
    bill: ActiveBill;
    onUpdate: (updates: Partial<ActiveBill>) => void;
    onBillCompleted: () => void;
}

export function ActiveBillView({ bill, onUpdate, onBillCompleted }: ActiveBillViewProps) {
    const { profile } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const receiptRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<ProductSearchInputHandle>(null);
    const qtyInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const [lastSaleForPrint, setLastSaleForPrint] = useState<Sale | null>(null);

    // Sync refs
    useEffect(() => {
        qtyInputRefs.current = qtyInputRefs.current.slice(0, bill.cart.length);
    }, [bill.cart]);

    // --- Calculations ---
    const {
        subTotalForDb, gstForDb, loyaltyDiscount, additionalDiscountAmount,
        totalAmount, roundOffAmount, displaySubtotal
    } = useSaleCalculations({
        items: bill.cart,
        discountType: bill.discountType,
        discountValue: bill.discountValue,
        loyaltyPointsToUse: bill.loyaltyPointsToUse,
        customer: bill.customer
    });

    // GST Split Logic (Equal Split)
    const cgstAmount = gstForDb / 2;
    const sgstAmount = gstForDb / 2;

    // --- Handlers ---
    const handleAddToCart = async (product: Product) => {
        let newCart = [...bill.cart];
        const existingIndex = newCart.findIndex(item => item.productId === product.id);

        if (existingIndex > -1) {
            const currentItem = newCart[existingIndex];
            if (product.unit_type === 'piece' && currentItem.quantity + 1 > product.stock_quantity) {
                if (!bill.existingSaleId) { alert("Stock limit reached!"); return; }
            }
            newCart[existingIndex] = { ...currentItem, quantity: currentItem.quantity + 1 };
        } else {
            if (product.stock_quantity <= 0 && !bill.existingSaleId) { alert("Out of Stock"); return; }
            let rawSalePrice = (product.sellingPrice && product.sellingPrice > 0 && product.sellingPrice < product.mrp) ? product.sellingPrice : product.mrp;
            const newItem: SaleItem = {
                productId: product.id, productName: product.name, quantity: 1, mrp: product.mrp,
                priceAtSale: rawSalePrice, costPriceAtSale: product.costPrice, gstRate: product.gst_rate,
                unitType: product.unit_type, unitValue: product.unit_value, isGstInclusive: product.is_gst_inclusive, isFreeItem: false
            };
            newCart.push(newItem);
        }

        if (product.hasFreeItem && product.freeProductId) {
            const freeProductRef = doc(db, "products", product.freeProductId);
            const freeProductSnap = await getDoc(freeProductRef);
            if (freeProductSnap.exists()) {
                const freeP = freeProductSnap.data();
                const qtyToGive = product.freeItemQuantity || 1;
                const existingFreeIndex = newCart.findIndex(item => item.productId === product.freeProductId && item.isFreeItem);
                if (existingFreeIndex > -1) {
                    newCart[existingFreeIndex] = { ...newCart[existingFreeIndex], quantity: newCart[existingFreeIndex].quantity + qtyToGive };
                } else {
                    newCart.push({
                        productId: freeProductSnap.id, productName: (freeP.name || product.freeProductName) + " (FREE)",
                        quantity: qtyToGive, mrp: freeP.mrp || 0, priceAtSale: 0, costPriceAtSale: freeP.costPrice || 0,
                        gstRate: freeP.gst_rate || 0, unitType: freeP.unit_type || 'piece', unitValue: freeP.unit_value || 1,
                        isGstInclusive: freeP.is_gst_inclusive ?? true, isFreeItem: true
                    });
                }
            }
        }
        onUpdate({ cart: newCart });
        setTimeout(() => searchInputRef.current?.focus(), 50);
    };

    const handleUpdateQuantity = (index: number, val: string) => {
        if (val === '') { const updated = [...bill.cart]; (updated[index] as any).quantity = ''; onUpdate({ cart: updated }); return; }
        const newQty = parseFloat(val);
        if (isNaN(newQty)) return;
        const updated = [...bill.cart]; updated[index].quantity = newQty; onUpdate({ cart: updated });
    };

    const handleRemoveItem = (index: number) => {
        const updated = bill.cart.filter((_, i) => i !== index);
        onUpdate({ cart: updated });
        if (updated.length === 0) searchInputRef.current?.focus();
        else setTimeout(() => qtyInputRefs.current[Math.min(index, updated.length - 1)]?.focus(), 50);
    };

    const handleCheckout = async (print: boolean = false) => {
        if (bill.cart.length === 0 || isSubmitting) return;

        let finalAmountReceived = bill.paymentMode === 'Cash' ? Number(bill.amountReceived) : totalAmount;
        let changeGiven = bill.paymentMode === 'Cash' ? Math.max(0, finalAmountReceived - totalAmount) : 0;

        if (bill.paymentMode === 'Cash' && finalAmountReceived < totalAmount) { alert("Insufficient Cash"); return; }

        setIsSubmitting(true);
        try {
            const batch = writeBatch(db);
            let saleRef;
            const saleData: any = {
                items: bill.cart,
                customerName: bill.customer?.name || bill.walkInName || 'Walk-in',
                customerId: bill.customer?.id || null,
                subTotal: subTotalForDb,
                discount: bill.cart.reduce((acc, item) => acc + (item.mrp - item.priceAtSale) * item.quantity, 0),
                additionalDiscount: additionalDiscountAmount > 0 ? { type: bill.discountType, value: Number(bill.discountValue), amount: additionalDiscountAmount } : null,
                loyaltyDiscount: loyaltyDiscount,
                gst: gstForDb,
                roundOff: roundOffAmount,
                totalAmount: totalAmount,
                paymentMode: bill.paymentMode,
                amountReceived: finalAmountReceived,
                changeGiven: changeGiven,
                loyaltyPointsEarned: bill.customer ? Math.floor(totalAmount / 100) : 0,
                loyaltyPointsUsed: bill.loyaltyPointsToUse,
                soldBy: profile?.email || 'System'
            };

            if (bill.existingSaleId) {
                saleRef = doc(db, "sales", bill.existingSaleId);
                const oldSaleSnap = await getDoc(saleRef);
                if (oldSaleSnap.exists()) {
                    const oldItems = oldSaleSnap.data().items as SaleItem[];
                    oldItems.forEach(item => {
                        const productRef = doc(db, "products", item.productId);
                        batch.update(productRef, { stock_quantity: increment(item.quantity) });
                    });
                    bill.cart.forEach(item => {
                        const productRef = doc(db, "products", item.productId);
                        batch.update(productRef, { stock_quantity: increment(-item.quantity), updatedAt: serverTimestamp() });
                    });
                    batch.update(saleRef, { ...saleData, updatedAt: serverTimestamp() });
                }
            } else {
                saleRef = doc(collection(db, "sales"));
                saleData.billNumber = `B${Date.now()}`;
                saleData.soldAt = serverTimestamp();
                batch.set(saleRef, saleData);
                bill.cart.forEach(item => {
                    const productRef = doc(db, "products", item.productId);
                    batch.update(productRef, { stock_quantity: increment(-item.quantity), updatedAt: serverTimestamp() });
                });
            }

            if (bill.customer && !bill.existingSaleId) {
                const custRef = doc(db, "customers", bill.customer.id);
                const pointsChange = (saleData.loyaltyPointsEarned) - (bill.loyaltyPointsToUse);
                batch.update(custRef, { loyaltyPoints: increment(pointsChange) });
            }

            await batch.commit();

            if (print) {
                setLastSaleForPrint({ ...saleData, id: saleRef.id, billNumber: bill.billNumber || saleData.billNumber, soldAt: Timestamp.now() } as Sale);
            } else {
                onBillCompleted();
                searchInputRef.current?.focus();
            }

        } catch (err) {
            console.error(err);
            alert("Transaction Failed");
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- KEYBOARD SHORTCUTS ---
    // Keep reference to latest handleCheckout to avoid stale closures in useEffect
    const handleCheckoutRef = useRef(handleCheckout);
    useEffect(() => {
        handleCheckoutRef.current = handleCheckout;
    });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl + P: Print & Checkout
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
                e.preventDefault();
                // We use the Ref to call the latest version of the function
                handleCheckoutRef.current(true);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Auto-print effect
    useEffect(() => {
        if (lastSaleForPrint && receiptRef.current) {
            printThermalReceipt(receiptRef.current);
            setLastSaleForPrint(null);
            onBillCompleted();
            searchInputRef.current?.focus();
        }
    }, [lastSaleForPrint, onBillCompleted]);

    const getItemTotal = (item: SaleItem) => (item.priceAtSale * (typeof item.quantity === 'number' ? item.quantity : 0));

    return (
        <div className="flex flex-col h-full bg-slate-50 relative">
            
            {/* 1. Edit Mode Notification Banner */}
            {bill.existingSaleId && (
                <div className="bg-orange-100 border-b border-orange-200 px-4 py-2 flex items-center justify-between shrink-0 animate-in slide-in-from-top-1">
                    <div className="flex items-center gap-2 text-orange-800 font-bold text-sm">
                        <Edit3 size={16} />
                        <span>Editing Bill: {bill.billNumber}</span>
                    </div>
                    <div className="flex items-center gap-1 text-orange-700 text-xs font-medium uppercase tracking-wide">
                        <AlertCircle size={14} />
                        Modification Mode
                    </div>
                </div>
            )}

            {/* 2. Top Controls (Inputs) */}
            <div className="bg-white p-4 border-b border-slate-200 flex gap-4 shrink-0 shadow-sm z-20">
                <div className="w-[30%]">
                    <CustomerSelect 
                        selectedCustomer={bill.customer} 
                        walkInName={bill.walkInName} 
                        onSelect={(c) => onUpdate({ customer: c, walkInName: '' })} 
                        onWalkInChange={(n) => onUpdate({ walkInName: n, customer: null })} 
                    />
                </div>
                <div className="w-[70%]">
                    <ProductSearchInput 
                        ref={searchInputRef} 
                        onSelect={handleAddToCart} 
                        onArrowDownFromEmpty={() => qtyInputRefs.current[0]?.focus()} 
                    />
                </div>
            </div>

            {/* 3. Cart Table */}
            <div className="flex-grow overflow-y-auto p-4">
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                            <tr>
                                <th className="p-3">Product</th>
                                <th className="p-3 w-28 text-right">Price</th>
                                <th className="p-3 w-32 text-center">Qty</th>
                                <th className="p-3 w-32 text-right">Total</th>
                                <th className="p-3 w-12 text-center"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {bill.cart.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-16 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="bg-slate-100 p-4 rounded-full">
                                                <Calculator size={32} />
                                            </div>
                                            <p className="font-medium">Ready to Bill</p>
                                            <p className="text-xs">Scan a barcode or type to search (F2)</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                bill.cart.map((item, index) => (
                                    <tr key={`${item.productId}-${index}`} className={`hover:bg-blue-50/50 transition-colors ${item.isFreeItem ? 'bg-purple-50 hover:bg-purple-100/50' : ''}`}>
                                        <td className="p-3">
                                            <div className="font-bold text-slate-800">{item.productName}</div>
                                            <div className="flex gap-2 mt-0.5">
                                                {item.unitType === 'weight' && <span className="text-[10px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-medium">Weight</span>}
                                                {item.isFreeItem && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">FREE</span>}
                                            </div>
                                        </td>
                                        <td className="p-3 text-right text-slate-600 font-mono">
                                            {formatCurrency(item.priceAtSale)}
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center justify-center">
                                                <input 
                                                    ref={el => { qtyInputRefs.current[index] = el; }} 
                                                    type="number" 
                                                    min="0.001" 
                                                    step={item.unitType === 'weight' ? "0.001" : "1"} 
                                                    value={item.quantity} 
                                                    onChange={(e) => handleUpdateQuantity(index, e.target.value)} 
                                                    className="w-20 border-slate-300 rounded text-center h-8 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-bold bg-white" 
                                                />
                                                <span className="ml-1.5 text-xs text-slate-400 font-medium w-4">
                                                    {item.unitType === 'weight' ? 'kg' : 'pc'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-3 text-right font-bold text-slate-800 font-mono">
                                            {formatCurrency(getItemTotal(item))}
                                        </td>
                                        <td className="p-3 text-center">
                                            <button onClick={() => handleRemoveItem(index)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 4. Bottom Panel */}
            <div className="bg-white border-t border-slate-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-30">
                <div className="flex gap-8 h-full">
                    
                    {/* Left: Discount & Points */}
                    <div className="w-[40%] flex flex-col justify-between">
                         <div className="grid grid-cols-2 gap-4">
                             <div>
                                 <label className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1 block">Bill Discount</label>
                                 <div className="flex gap-0 shadow-sm rounded-md">
                                    <select 
                                        value={bill.discountType} 
                                        onChange={(e) => onUpdate({ discountType: e.target.value as any })} 
                                        className="border border-r-0 border-slate-300 rounded-l-md text-sm bg-slate-50 px-2 py-2 focus:ring-0 focus:border-slate-300 text-slate-600"
                                    >
                                        <option value="percentage">%</option>
                                        <option value="fixed">₹</option>
                                    </select>
                                    <Input 
                                        type="number" 
                                        placeholder="0" 
                                        value={bill.discountValue} 
                                        onChange={(e) => onUpdate({ discountValue: e.target.value === '' ? '' : parseFloat(e.target.value) })} 
                                        className="h-auto py-2 rounded-l-none border-l-0"
                                    />
                                 </div>
                             </div>
                             
                             {bill.customer && (
                                 <div>
                                     <label className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1 block">
                                         Points (Bal: {bill.customer.loyaltyPoints})
                                     </label>
                                     <Input 
                                        type="number" 
                                        placeholder="Redeem Points" 
                                        max={bill.customer.loyaltyPoints} 
                                        value={bill.loyaltyPointsToUse || ''} 
                                        onChange={(e) => onUpdate({ loyaltyPointsToUse: parseInt(e.target.value) || 0 })} 
                                        className="h-auto py-2"
                                     />
                                 </div>
                             )}
                         </div>
                    </div>

                    {/* Middle: Totals & Tax */}
                    <div className="flex-1 flex flex-col justify-end items-end space-y-1 text-sm pr-4 border-r border-slate-100">
                         <div className="flex justify-between w-48 text-slate-600">
                             <span>Subtotal:</span> <span className="font-mono">{formatCurrency(displaySubtotal)}</span>
                         </div>
                         
                         {additionalDiscountAmount > 0 && (
                            <div className="flex justify-between w-48 text-green-600">
                                <span>Discount:</span> <span className="font-mono">-{formatCurrency(additionalDiscountAmount)}</span>
                            </div>
                         )}
                         
                         {loyaltyDiscount > 0 && (
                            <div className="flex justify-between w-48 text-green-600">
                                <span>Points:</span> <span className="font-mono">-{formatCurrency(loyaltyDiscount)}</span>
                            </div>
                         )}

                         {/* GST Separator */}
                         <div className="w-48 my-1 border-t border-dashed border-slate-200"></div>

                         <div className="flex justify-between w-48 text-slate-400 text-xs">
                             <span>CGST (2.5%):</span> <span className="font-mono">{formatCurrency(cgstAmount)}</span>
                         </div>
                         <div className="flex justify-between w-48 text-slate-400 text-xs">
                             <span>SGST (2.5%):</span> <span className="font-mono">{formatCurrency(sgstAmount)}</span>
                         </div>
                         
                         <div className="w-48 my-1 border-t border-slate-200"></div>
                         
                         <div className="flex justify-between w-48 font-bold text-slate-900 text-xl">
                             <span>Total:</span> <span className="font-mono">{formatCurrency(totalAmount)}</span>
                         </div>
                    </div>

                    {/* Right: Payment & Action */}
                    <div className="w-[25%] flex flex-col gap-3">
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            {['Cash', 'Card', 'UPI'].map(mode => (
                                <button 
                                    key={mode} 
                                    onClick={() => onUpdate({ paymentMode: mode as any })} 
                                    className={`
                                        flex-1 py-1.5 text-xs font-bold rounded-md transition-all 
                                        ${bill.paymentMode === mode ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}
                                    `}
                                >
                                    {mode}
                                </button>
                            ))}
                        </div>
                        
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-sans text-lg">₹</span>
                            <input 
                                type="number" 
                                placeholder={bill.paymentMode === 'Cash' ? "Received" : "Full Amount"} 
                                value={bill.amountReceived} 
                                onChange={(e) => onUpdate({ amountReceived: e.target.value === '' ? '' : parseFloat(e.target.value) })} 
                                className="w-full pl-8 pr-3 py-2.5 border-2 border-slate-200 focus:border-blue-500 focus:ring-0 rounded-lg font-bold text-lg text-slate-800 bg-slate-50 focus:bg-white transition-colors" 
                                disabled={bill.paymentMode !== 'Cash'} 
                            />
                            {bill.paymentMode === 'Cash' && Number(bill.amountReceived) >= totalAmount && (
                                <div className="absolute -bottom-5 right-0 text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">
                                    Change: {formatCurrency(Number(bill.amountReceived) - totalAmount)}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2 mt-auto pt-1">
                            <Button 
                                onClick={() => handleCheckout(true)} 
                                disabled={isSubmitting || totalAmount <= 0} 
                                className={`flex-1 text-white h-11 text-base shadow-md transition-transform active:scale-[0.98] ${bill.existingSaleId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'}`} 
                                title="Ctrl + P"
                            >
                                {isSubmitting ? 'Processing...' : (bill.existingSaleId ? 'Update' : 'Print Bill')}
                            </Button>
                             <Button 
                                onClick={() => handleCheckout(false)} 
                                disabled={isSubmitting || totalAmount <= 0} 
                                variant="secondary" 
                                className="w-11 h-11 flex items-center justify-center border-slate-300"
                                title="Save without Print"
                            >
                                <span className="text-[10px] font-bold uppercase">Save</span>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="hidden">
                 {lastSaleForPrint && (
                     <ThermalLayout ref={receiptRef} sale={lastSaleForPrint} storeDetails={{
                             name: "National Mini Mart",
                             address: "140/115, Hospital Road, Ooty, 643091",
                             phone: "0423 2446089",
                             mobile: "9092484510",
                             gst: "33AUBPM5493L1ZA"
                         }} />
                 )}
            </div>
        </div>
    );
}