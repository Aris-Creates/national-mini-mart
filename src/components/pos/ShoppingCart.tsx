import { useState, useMemo, useEffect } from 'react';
import { collection, query, where, getDocs, limit, DocumentData, Timestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Customer } from '../../types/customer';
import { Sale, SaleItem } from '../../types/sale';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { formatCurrency } from '../../utils/formatCurrency';
import { User, Plus, Minus, CreditCard, Wallet, Printer, Download } from 'lucide-react';

const GST_RATE = 0.18;
const docToCustomer = (doc: DocumentData): Customer => ({
    id: doc.id,
    name: doc.data().name || '',
    phone: doc.data().phone || '',
    address: doc.data().address || '',
    loyaltyPoints: doc.data().loyaltyPoints || 0,
    createdAt: doc.data().createdAt as Timestamp,
    updatedAt: doc.data().updatedAt as Timestamp,
});

interface ShoppingCartProps {
    cart: SaleItem[];
    lastSale: Sale | null;
    isSubmitting: boolean;
    onUpdateQuantity: (productId: string, newQuantity: number) => void;
    onConfirmCheckout: (paymentDetails: { paymentMode: 'Cash' | 'Card' | 'UPI', amountReceived: number | '' }) => void;
    onPrint: () => void;
    onDownloadPdf: () => void;
    onNewSale: () => void;
    selectedCustomer: Customer | null;
    onSelectCustomer: (customer: Customer | null) => void;
    walkInName: string;
    setWalkInName: (name: string) => void;
    discount: number;
    onDiscountChange: (discount: number) => void;
}

export function ShoppingCart(props: ShoppingCartProps) {
    const {
        cart, lastSale, isSubmitting, onUpdateQuantity, onConfirmCheckout, onPrint, onNewSale,
        selectedCustomer, onSelectCustomer, walkInName, setWalkInName, discount, onDiscountChange
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
                const q = query(
                    collection(db, "customers"),
                    where('phone', '>=', customerSearchTerm),
                    where('phone', '<=', customerSearchTerm + '\uf8ff'),
                    limit(5)
                );
                const snapshot = await getDocs(q);
                setCustomerResults(snapshot.docs.map(docToCustomer));
            } catch (error) {
                console.error("Error searching customers:", error);
            } finally {
                setIsSearchingCustomers(false);
            }
        };

        const debounce = setTimeout(() => searchCustomers(), 300);
        return () => clearTimeout(debounce);
    }, [customerSearchTerm]);

    const handleSelect = (customer: Customer) => {
        onSelectCustomer(customer);
        setWalkInName('');
        setCustomerSearchTerm('');
    };

    const { subTotal, gstAmount, totalAmount, roundOffAmount } = useMemo(() => {
        const sub = cart.reduce((acc, item) => acc + item.priceAtSale * item.quantity, 0);
        const gst = sub * GST_RATE;
        const preRoundTotal = sub + gst - discount;
        const finalTotal = Math.round(preRoundTotal);
        const roundOff = finalTotal - preRoundTotal;

        return {
            subTotal: sub,
            gstAmount: gst,
            totalAmount: finalTotal,
            roundOffAmount: roundOff
        };
    }, [cart, discount]);

    const handleCheckoutClick = () => {
        onConfirmCheckout({ paymentMode, amountReceived });
    };

    return (
        <div className="lg:col-span-1 bg-slate-800 p-4 rounded-lg flex flex-col">
            <h2 className="text-xl font-bold mb-4">Shopping Cart</h2>
            <div className="relative mb-4">
                <Input
                    placeholder="Search phone or enter walk-in name..."
                    value={selectedCustomer ? selectedCustomer.name : walkInName}
                    onChange={(e) => {
                        if (selectedCustomer) onSelectCustomer(null);
                        setWalkInName(e.target.value);
                        setCustomerSearchTerm(e.target.value);
                    }}
                    disabled={!!lastSale}
                />
                {customerSearchTerm && !selectedCustomer && (
                    <div className="absolute z-10 w-full bg-slate-700 mt-1 rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {isSearchingCustomers && <p className="p-2 text-slate-400">Searching...</p>}
                        {!isSearchingCustomers && customerResults.length === 0 && (
                            <p className="p-2 text-slate-400">No customers found.</p>
                        )}
                        {customerResults.map(customer => (
                            <div key={customer.id} onClick={() => handleSelect(customer)} className="p-2 hover:bg-slate-600 cursor-pointer">
                                <p>{customer.name}</p>
                                <p className="text-xs text-slate-400">{customer.phone}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex-grow overflow-y-auto space-y-2 py-2 border-y border-slate-700 min-h-[150px]">
                {cart.length === 0 ? <p className="h-full flex items-center justify-center text-slate-500">Cart is empty</p> :
                    cart.map(item => (
                        <div key={item.productId} className="flex items-center gap-3">
                            <div className="flex-grow">
                                <p className="font-semibold text-sm truncate">{item.productName}</p>
                                <p className="text-xs text-slate-400">{item.quantity} x {formatCurrency(item.priceAtSale)}</p>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button variant="secondary" onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}><Minus size={14} /></Button>
                                <span className="w-6 text-center">{item.quantity}</span>
                                <Button variant="secondary" onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}><Plus size={14} /></Button>
                            </div>
                            <p className="font-semibold w-20 text-right">{formatCurrency(item.priceAtSale * item.quantity)}</p>
                        </div>
                    ))
                }
            </div>

            <div className="pt-4 space-y-3 text-sm">
                <div className="flex justify-between text-slate-300"><span>Subtotal</span><span>{formatCurrency(subTotal)}</span></div>
                <div className="flex justify-between text-slate-300"><span>GST ({GST_RATE * 100}%)</span><span>{formatCurrency(gstAmount)}</span></div>
                <div className="flex justify-between items-center text-slate-300">
                    <span>Discount</span>
                    <div className="w-28">
                        <Input
                            type="number"
                            placeholder="0.00"
                            className="h-8 w-full text-right bg-slate-700 border-slate-600 p-1 text-sm"
                            value={discount || ''}
                            onChange={(e) => onDiscountChange(parseFloat(e.target.value) || 0)}
                            disabled={!!lastSale}
                        />
                    </div>
                </div>
                <div className="flex justify-between text-slate-300">
                    <span>Round Off</span>
                    <span className={roundOffAmount >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {roundOffAmount.toFixed(2)}
                    </span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t border-slate-700 pt-2">
                    <span>Total</span>
                    <span>{formatCurrency(totalAmount)}</span>
                </div>
            </div>


            <div className="mt-auto pt-4">
                {lastSale ? (
                    <div className="space-y-3 text-center animate-fade-in">
                        <h3 className="text-lg font-bold text-green-400">Sale Completed!</h3>
                        <Button
                            onClick={onPrint}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-md text-base font-medium"
                        >
                            <Printer size={18} className="inline-block" />
                            <span>Print Receipt</span>
                        </Button>

                        <Button
                            onClick={onNewSale}
                            variant="secondary"
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-md text-base font-medium"
                        >
                            Start New Sale
                        </Button>
                    </div>

                ) : (
                    <div>
                        <p className="text-sm font-medium mb-2">Payment Method:</p>
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            <button onClick={() => setPaymentMode('Cash')} className={`p-2 rounded-md flex items-center justify-center gap-2 text-sm transition-colors ${paymentMode === 'Cash' ? 'bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}><Wallet size={16} /> Cash</button>
                            <button onClick={() => setPaymentMode('Card')} className={`p-2 rounded-md flex items-center justify-center gap-2 text-sm transition-colors ${paymentMode === 'Card' ? 'bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}><CreditCard size={16} /> Card</button>
                            <button onClick={() => setPaymentMode('UPI')} className={`p-2 rounded-md flex items-center justify-center gap-2 text-sm transition-colors ${paymentMode === 'UPI' ? 'bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}><span className="font-bold text-xs">UPI</span></button>
                        </div>
                        {paymentMode === 'Cash' && (
                            <div className="mb-4">
                                <Input type="number" placeholder="Cash Received" value={amountReceived} onChange={e => setAmountReceived(e.target.value === '' ? '' : parseFloat(e.target.value))} />
                                {Number(amountReceived) >= totalAmount && totalAmount > 0 && (
                                    <p className="text-sm text-center mt-2 text-slate-300">Change Due: <span className="font-bold">{formatCurrency(Number(amountReceived) - totalAmount)}</span></p>
                                )}
                            </div>
                        )}
                        <Button onClick={handleCheckoutClick} disabled={cart.length === 0 || isSubmitting} className="w-full text-lg py-3 bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700">
                            {isSubmitting ? 'Processing...' : `Pay ${formatCurrency(totalAmount)}`}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}