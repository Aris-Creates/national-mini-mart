// src/components/pos/OrderPanel.tsx
import { useState, useEffect, useRef } from 'react'; // ADDED useRef
import { collection, query, where, getDocs, limit, DocumentData, Timestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Customer } from '../../types/customer';
import { SaleItem } from '../../types/sale';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { formatCurrency } from '../../utils/formatCurrency';
import { Plus, Minus, CreditCard, Wallet, X, Percent, IndianRupee, PackagePlus, UserPlus } from 'lucide-react';

const docToCustomer = (doc: DocumentData): Customer => ({
    id: doc.id,
    name: doc.data().name || '',
    phone: doc.data().phone || '',
    address: doc.data().address || '',
    loyaltyPoints: doc.data().loyaltyPoints || 0,
    createdAt: doc.data().createdAt as Timestamp,
    updatedAt: doc.data().updatedAt as Timestamp,
});

interface OrderPanelProps {
    cart: SaleItem[];
    isSubmitting: boolean;
    onUpdateQuantity: (productId: string, newQuantity: number) => void;
    onConfirmCheckout: (
        paymentDetails: { paymentMode: 'Cash' | 'Card' | 'UPI', amountReceived: number | '' },
        andThenPrint?: boolean
    ) => void;
    selectedCustomer: Customer | null;
    onSelectCustomer: (customer: Customer | null) => void;
    walkInName: string;
    setWalkInName: (name: string) => void;
    subTotal: number;
    loyaltyDiscount: number;
    totalAmount: number;
    loyaltyPointsToUse: number;
    onLoyaltyPointsChange: (points: number) => void;
    additionalDiscountAmount: number;
    discountType: 'percentage' | 'fixed';
    onDiscountTypeChange: (type: 'percentage' | 'fixed') => void;
    discountValue: number | '';
    onDiscountValueChange: (value: number | '') => void;
}

export function OrderPanel(props: OrderPanelProps) {
    const {
        cart, isSubmitting, onUpdateQuantity, onConfirmCheckout,
        selectedCustomer, onSelectCustomer, walkInName, setWalkInName,
        subTotal, loyaltyDiscount, totalAmount,
        loyaltyPointsToUse, onLoyaltyPointsChange,
        additionalDiscountAmount, discountType, onDiscountTypeChange, discountValue, onDiscountValueChange
    } = props;

    const [paymentMode, setPaymentMode] = useState<'Cash' | 'Card' | 'UPI'>('Cash');
    const [amountReceived, setAmountReceived] = useState<number | ''>('');
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const [customerResults, setCustomerResults] = useState<Customer[]>([]);
    const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
    
    // NEW: Ref for the cash input field
    const cashInputRef = useRef<HTMLInputElement>(null);

    // MODIFIED: useEffect for Ctrl+P now has proper cash validation
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.ctrlKey && event.key.toLowerCase() === 'p') {
                event.preventDefault();

                if (isSubmitting || cart.length === 0 || totalAmount <= 0) {
                    return;
                }

                let paymentDetails: { paymentMode: 'Cash' | 'Card' | 'UPI', amountReceived: number | '' };

                // Smart validation based on payment mode
                if (paymentMode === 'Cash') {
                    if (Number(amountReceived) < totalAmount) {
                        alert('Please enter cash received. It must be greater than or equal to the total amount.');
                        // Focus the input field to guide the user
                        cashInputRef.current?.focus();
                        return; // Stop the checkout process
                    }
                    paymentDetails = { paymentMode, amountReceived: Number(amountReceived) };
                } else {
                    // For Card/UPI, assume exact amount is paid
                    paymentDetails = { paymentMode, amountReceived: totalAmount };
                }
                
                onConfirmCheckout(paymentDetails, true);
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
        // ADDED `amountReceived` to dependency array to get the latest value
    }, [isSubmitting, cart, totalAmount, paymentMode, amountReceived, onConfirmCheckout]);

    useEffect(() => {
        const searchCustomers = async () => {
            if (customerSearchTerm.trim().length < 3) { setCustomerResults([]); return; }
            setIsSearchingCustomers(true);
            try {
                const q = query(collection(db, "customers"), where('phone', '>=', customerSearchTerm), where('phone', '<=', customerSearchTerm + '\uf8ff'), limit(5));
                const snapshot = await getDocs(q);
                setCustomerResults(snapshot.docs.map(docToCustomer));
            } catch (error) { console.error("Error searching customers:", error); }
            finally { setIsSearchingCustomers(false); }
        };
        const debounce = setTimeout(() => searchCustomers(), 300);
        return () => clearTimeout(debounce);
    }, [customerSearchTerm]);

    const handleSelectCustomer = (customer: Customer) => {
        onSelectCustomer(customer);
        setWalkInName('');
        setCustomerSearchTerm('');
        setCustomerResults([]);
    };

    const handleRemoveCustomer = () => {
        onSelectCustomer(null);
        onLoyaltyPointsChange(0);
    }
    
    const roundOffAmount = totalAmount - (subTotal - additionalDiscountAmount - loyaltyDiscount);
    const productSavings = cart.reduce((acc, item) => acc + (item.mrp - item.priceAtSale) * item.quantity, 0);
    const totalSavings = productSavings + additionalDiscountAmount + loyaltyDiscount;

    const handleDiscountInputChange = (type: 'percentage' | 'fixed', valueStr: string) => {
        const value = valueStr === '' ? '' : parseFloat(valueStr) || 0;
        onDiscountTypeChange(type);
        onDiscountValueChange(value);
    }

    const equivalentPercent = subTotal > 0 ? (additionalDiscountAmount / subTotal * 100) : 0;
    const equivalentFixed = additionalDiscountAmount;
    
    const maxPointsCanUse = loyaltyDiscount / 5;

    return (
        <div className="bg-white border border-gray-200 flex flex-col h-full">
            {/* ... rest of the component is unchanged ... */}
            <h2 className="text-xl font-bold text-gray-800 p-4 border-b border-gray-200">Current Order</h2>
            <div className="p-4 border-b border-gray-200">
              {selectedCustomer ? (
                    <div className="bg-gray-100 p-3 border border-gray-200">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-semibold text-blue-600">{selectedCustomer.name}</p>
                                <p className="text-xs text-gray-500">{selectedCustomer.phone}</p>
                                <p className="text-xs text-gray-500">Loyalty Points: {selectedCustomer.loyaltyPoints}</p>
                            </div>
                            <Button variant="secondary" className="h-7 w-7" onClick={handleRemoveCustomer}><X size={16} /></Button>
                        </div>
                    </div>
                ) : (
                    <div className="relative">
                        <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <Input
                            className="pl-10"
                            placeholder="Search phone or enter walk-in name..."
                            value={customerSearchTerm || walkInName}
                            onChange={(e) => { setWalkInName(e.target.value); setCustomerSearchTerm(e.target.value); }}
                        />
                        {customerSearchTerm && (
                            <div className="absolute z-10 w-full bg-white mt-1 border border-gray-200 shadow-lg max-h-48 overflow-y-auto">
                                {isSearchingCustomers && <p className="p-2 text-gray-500">Searching...</p>}
                                {customerResults.map(customer => (
                                    <div key={customer.id} onClick={() => handleSelectCustomer(customer)} className="p-2 hover:bg-gray-100 cursor-pointer">
                                        <p>{customer.name} ({customer.phone})</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div className="flex-grow overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <PackagePlus size={48} className="mb-2" />
                        <p>Your cart is empty</p>
                    </div>
                ) : cart.map(item => (
                    <div key={item.productId} className="flex items-center gap-3">
                        <div className="flex-grow">
                            <p className="font-medium text-sm text-gray-800 truncate">{item.productName}</p>
                            <div className="flex items-baseline gap-2">
                                <p className="text-sm font-bold text-blue-700">{formatCurrency(item.priceAtSale)}</p>
                                {item.priceAtSale < item.mrp && (
                                    <p className="text-xs text-gray-400 line-through">{formatCurrency(item.mrp)}</p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="secondary" className="h-7 w-7" onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}><Minus size={14} /></Button>
                            <span className="w-6 text-center font-bold">{item.quantity}</span>
                            <Button variant="secondary" className="h-7 w-7" onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}><Plus size={14} /></Button>
                        </div>
                        <p className="font-semibold w-24 text-right">{formatCurrency(item.priceAtSale * item.quantity)}</p>
                    </div>
                ))}
            </div>
            {cart.length > 0 && (
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                    <div className="space-y-2 text-sm mb-4">
                        <div className="flex justify-between text-gray-700"><span>Subtotal</span><span>{formatCurrency(subTotal)}</span></div>
                        <div className="border-y border-gray-200 py-3 space-y-2">
                          <label className="block text-sm font-medium text-gray-600">Additional Discount</label>
                            <div className="flex gap-2">
                                <div className="relative flex-grow">
                                    <Input type="number" className="pl-8" placeholder="0.00" value={discountType === 'percentage' ? discountValue : equivalentPercent.toFixed(2)} onChange={(e) => handleDiscountInputChange('percentage', e.target.value)} onFocus={() => onDiscountTypeChange('percentage')} />
                                    <Percent size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                </div>
                                <div className="relative flex-grow">
                                    <Input type="number" className="pl-8" placeholder="0.00" value={discountType === 'fixed' ? discountValue : equivalentFixed.toFixed(2)} onChange={(e) => handleDiscountInputChange('fixed', e.target.value)} onFocus={() => onDiscountTypeChange('fixed')} />
                                    <IndianRupee size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                </div>
                            </div>
                        </div>
                        {totalSavings > 0 && ( <div className="flex justify-between font-medium text-green-600"> <span>Total Savings</span> <span>- {formatCurrency(totalSavings)}</span> </div> )}
                        {selectedCustomer && selectedCustomer.loyaltyPoints > 0 && (
                            <div className="flex justify-between items-center text-gray-700">
                                <span>Use Points ({selectedCustomer.loyaltyPoints})</span>
                                <Input type="number" className="h-8 w-24 text-right bg-white" value={loyaltyPointsToUse || ''}
                                       max={maxPointsCanUse}
                                       disabled={totalAmount <= 0}
                                       onChange={(e) => onLoyaltyPointsChange(parseInt(e.target.value) || 0)}
                                />
                            </div>
                        )}
                        {loyaltyDiscount > 0 && (<div className="flex justify-between text-green-600"><span>Loyalty Discount</span><span>- {formatCurrency(loyaltyDiscount)}</span></div>)}
                        <div className="flex justify-between text-gray-600"><span>Round Off</span><span>{roundOffAmount.toFixed(2)}</span></div>
                    </div>
                    <div className="flex justify-between items-center font-bold text-2xl border-t border-gray-300 pt-3 my-3">
                        <span className="text-gray-800">Total</span>
                        <span className="text-blue-700">{formatCurrency(totalAmount)}</span>
                    </div>
                    <div>
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            <button onClick={() => setPaymentMode('Cash')} className={`py-2 flex items-center justify-center gap-2 text-sm transition-colors ${paymentMode === 'Cash' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}><Wallet size={16} /> Cash</button>
                            <button onClick={() => setPaymentMode('Card')} className={`py-2 flex items-center justify-center gap-2 text-sm transition-colors ${paymentMode === 'Card' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}><CreditCard size={16} /> Card</button>
                            <button onClick={() => setPaymentMode('UPI')} className={`py-2 flex items-center justify-center gap-2 text-sm transition-colors ${paymentMode === 'UPI' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}><span className="font-bold text-xs">UPI</span></button>
                        </div>
                        {paymentMode === 'Cash' && (
                            <div className="mb-4">
                                {/* NEW: Added ref to this input */}
                                <Input
                                    ref={cashInputRef}
                                    type="number"
                                    placeholder="Cash Received"
                                    value={amountReceived}
                                    onChange={e => setAmountReceived(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                />
                                {Number(amountReceived) >= totalAmount && totalAmount > 0 && (
                                    <p className="text-sm text-center mt-2 text-green-600">Change Due: <span className="font-bold">{formatCurrency(Number(amountReceived) - totalAmount)}</span></p>
                                )}
                            </div>
                        )}
                        <Button
                            onClick={() => onConfirmCheckout({ paymentMode, amountReceived }, false)}
                            disabled={isSubmitting || cart.length === 0}
                            className="w-full text-lg font-bold bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                        >
                            {isSubmitting ? "Processing..." : `Bill & Collect ${formatCurrency(totalAmount)}`}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}