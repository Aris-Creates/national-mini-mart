// src/components/pos/OrderPanel.tsx
import { useState, useEffect } from 'react';
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
    onConfirmCheckout: (paymentDetails: { paymentMode: 'Cash' | 'Card' | 'UPI', amountReceived: number | '' }) => void;
    selectedCustomer: Customer | null;
    onSelectCustomer: (customer: Customer | null) => void;
    walkInName: string;
    setWalkInName: (name: string) => void;
    subTotal: number; // This is the simple, tax-inclusive subtotal for display
    totalDiscount: number;
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
        subTotal, totalDiscount, loyaltyDiscount, totalAmount,
        loyaltyPointsToUse, onLoyaltyPointsChange,
        additionalDiscountAmount, discountType, onDiscountTypeChange, discountValue, onDiscountValueChange
    } = props;

    const [paymentMode, setPaymentMode] = useState<'Cash' | 'Card' | 'UPI'>('Cash');
    const [amountReceived, setAmountReceived] = useState<number | ''>('');
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const [customerResults, setCustomerResults] = useState<Customer[]>([]);
    const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);

    useEffect(() => {
        const searchCustomers = async () => {
            if (customerSearchTerm.trim().length < 3) {
                setCustomerResults([]);
                return;
            }
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

    const handleDiscountInputChange = (type: 'percentage' | 'fixed', valueStr: string) => {
        const value = valueStr === '' ? '' : parseFloat(valueStr) || 0;
        onDiscountTypeChange(type);
        onDiscountValueChange(value);
    }
    
    const equivalentPercent = subTotal > 0 ? (additionalDiscountAmount / subTotal * 100) : 0;
    const equivalentFixed = additionalDiscountAmount;

    return (
        <div className="bg-slate-800/50 rounded-lg flex flex-col h-full">
            <h2 className="text-xl font-bold p-4 border-b border-slate-700">Current Order</h2>
            
            {/* Customer Section */}
            <div className="p-4 border-b border-slate-700">
                {selectedCustomer ? (
                    <div className="bg-slate-700/50 p-3 rounded-md">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-semibold text-blue-300">{selectedCustomer.name}</p>
                                <p className="text-xs text-slate-400">{selectedCustomer.phone}</p>
                                <p className="text-xs text-slate-400">Loyalty Points: {selectedCustomer.loyaltyPoints}</p>
                            </div>
                            <Button variant="secondary" className="h-7 w-7" onClick={handleRemoveCustomer}><X size={16} /></Button>
                        </div>
                    </div>
                ) : (
                    <div className="relative">
                        <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <Input
                            className="pl-10"
                            placeholder="Search phone or enter walk-in name..."
                            value={customerSearchTerm || walkInName}
                            onChange={(e) => { setWalkInName(e.target.value); setCustomerSearchTerm(e.target.value); }}
                        />
                        {customerSearchTerm && (
                            <div className="absolute z-10 w-full bg-slate-700 mt-1 rounded-md shadow-lg max-h-48 overflow-y-auto">
                                {isSearchingCustomers && <p className="p-2 text-slate-400">Searching...</p>}
                                {customerResults.map(customer => (
                                    <div key={customer.id} onClick={() => handleSelectCustomer(customer)} className="p-2 hover:bg-slate-600 cursor-pointer">
                                        <p>{customer.name} ({customer.phone})</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Cart Items */}
            <div className="flex-grow overflow-y-auto p-4 space-y-3">
                {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500">
                        <PackagePlus size={48} className="mb-2" />
                        <p>Your cart is empty</p>
                    </div>
                ) : cart.map(item => (
                    <div key={item.productId} className="flex items-center gap-3">
                        <div className="flex-grow">
                            <p className="font-semibold text-sm truncate">{item.productName}</p>
                            <p className="text-xs text-slate-400">{formatCurrency(item.priceAtSale)}</p>
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

            {/* Billing & Checkout */}
            {cart.length > 0 && (
                <div className="p-4 border-t border-slate-700 bg-slate-900/30 rounded-b-lg">
                    <div className="space-y-2 text-sm mb-4">
                        <div className="flex justify-between text-slate-300"><span>Subtotal</span><span>{formatCurrency(subTotal)}</span></div>
                        {totalDiscount > 0 && <div className="flex justify-between text-green-400"><span>Product Discounts</span><span>- {formatCurrency(totalDiscount)}</span></div>}
                        
                        <div className="border-y border-slate-700 py-3 space-y-2">
                            <label className="block text-sm font-medium text-slate-300">Additional Discount</label>
                            <div className="flex gap-2">
                                <div className="relative flex-grow">
                                    <Input type="number" className="pl-8" placeholder="0.00" value={discountType === 'percentage' ? discountValue : equivalentPercent.toFixed(2)} onChange={(e) => handleDiscountInputChange('percentage', e.target.value)} onFocus={() => onDiscountTypeChange('percentage')} />
                                    <Percent size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                </div>
                                <div className="relative flex-grow">
                                    <Input type="number" className="pl-8" placeholder="0.00" value={discountType === 'fixed' ? discountValue : equivalentFixed.toFixed(2)} onChange={(e) => handleDiscountInputChange('fixed', e.target.value)} onFocus={() => onDiscountTypeChange('fixed')} />
                                    <IndianRupee size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                </div>
                            </div>
                        </div>
                        {additionalDiscountAmount > 0 && <div className="flex justify-between text-green-400"><span>Cart Discount</span><span>- {formatCurrency(additionalDiscountAmount)}</span></div>}
                        
                        {selectedCustomer && selectedCustomer.loyaltyPoints > 0 && (
                            <div className="flex justify-between items-center text-slate-300">
                                <span>Use Points ({selectedCustomer.loyaltyPoints})</span>
                                <Input type="number" className="h-8 w-24 text-right bg-slate-700" value={loyaltyPointsToUse || ''} onChange={(e) => onLoyaltyPointsChange(Math.min(parseInt(e.target.value) || 0, selectedCustomer.loyaltyPoints))} />
                            </div>
                        )}
                        {loyaltyDiscount > 0 && <div className="flex justify-between text-green-400"><span>Loyalty Discount</span><span>- {formatCurrency(loyaltyDiscount)}</span></div>}
                        
                        <div className="flex justify-between text-slate-300"><span>Round Off</span><span>{roundOffAmount.toFixed(2)}</span></div>
                    </div>
                    
                    <div className="flex justify-between items-center font-bold text-2xl border-t border-slate-600 pt-3 my-3">
                        <span>Total</span>
                        <span>{formatCurrency(totalAmount)}</span>
                    </div>

                    <div>
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            <button onClick={() => setPaymentMode('Cash')} className={`py-2 rounded-md flex items-center justify-center gap-2 text-sm transition-colors ${paymentMode === 'Cash' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-700 hover:bg-slate-600'}`}><Wallet size={16} /> Cash</button>
                            <button onClick={() => setPaymentMode('Card')} className={`py-2 rounded-md flex items-center justify-center gap-2 text-sm transition-colors ${paymentMode === 'Card' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-700 hover:bg-slate-600'}`}><CreditCard size={16} /> Card</button>
                            <button onClick={() => setPaymentMode('UPI')} className={`py-2 rounded-md flex items-center justify-center gap-2 text-sm transition-colors ${paymentMode === 'UPI' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-700 hover:bg-slate-600'}`}><span className="font-bold text-xs">UPI</span></button>
                        </div>
                        {paymentMode === 'Cash' && (
                            <div className="mb-4">
                                <Input type="number" placeholder="Cash Received" value={amountReceived} onChange={e => setAmountReceived(e.target.value === '' ? '' : parseFloat(e.target.value))} />
                                {Number(amountReceived) >= totalAmount && totalAmount > 0 && (
                                    <p className="text-sm text-center mt-2 text-green-400">Change Due: <span className="font-bold">{formatCurrency(Number(amountReceived) - totalAmount)}</span></p>
                                )}
                            </div>
                        )}
                        <Button onClick={() => onConfirmCheckout({ paymentMode, amountReceived })} disabled={isSubmitting} className="w-full text-lg font-bold bg-green-600 hover:bg-green-700">
                            {isSubmitting ? "Processing..." : `Pay Now`}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}