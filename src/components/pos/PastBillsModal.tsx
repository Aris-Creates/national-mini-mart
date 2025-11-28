import { useEffect, useState, useRef } from 'react';
import { X, Printer, Search, FileText, Edit } from 'lucide-react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Sale } from '../../types/sale';
import { formatCurrency } from '../../utils/formatCurrency';
import { ThermalLayout } from '../printing/ThermalLayout';
import { printThermalReceipt } from '../../lib/printing';

const docToSale = (doc: any): Sale => ({ id: doc.id, ...doc.data() });

export function PastBillsModal({ onClose, onEdit }: { onClose: () => void, onEdit: (sale: Sale) => void }) {
    const [sales, setSales] = useState<Sale[]>([]);
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const receiptRef = useRef<HTMLDivElement>(null);

    // 1. Fetch Sales
    useEffect(() => {
        const fetchSales = async () => {
            try {
                const q = query(collection(db, "sales"), orderBy("soldAt", "desc"), limit(50));
                const snap = await getDocs(q);
                const fetchedSales = snap.docs.map(docToSale);
                setSales(fetchedSales);
                
                // Auto-select the first one for immediate keyboard nav
                if (fetchedSales.length > 0) {
                    setSelectedSale(fetchedSales[0]);
                }
            } catch (error) {
                console.error("Error fetching sales:", error);
            }
        };
        fetchSales();
    }, []);

    // 2. Keyboard Navigation & Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (sales.length === 0) return;

            // Find current index
            const currentIndex = selectedSale 
                ? sales.findIndex(s => s.id === selectedSale.id) 
                : -1;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const nextIndex = currentIndex < sales.length - 1 ? currentIndex + 1 : currentIndex;
                setSelectedSale(sales[nextIndex]);
            } 
            else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0;
                setSelectedSale(sales[prevIndex]);
            }
            else if (e.key === 'Enter' && selectedSale) {
                e.preventDefault();
                onEdit(selectedSale); // Trigger Edit
            }
            else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p' && selectedSale) {
                e.preventDefault();
                // Trigger Print
                if (receiptRef.current) {
                    printThermalReceipt(receiptRef.current);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [sales, selectedSale, onEdit]);

    // 3. Auto-scroll to selected item
    useEffect(() => {
        if (selectedSale) {
            const element = document.getElementById(`bill-item-${selectedSale.id}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }, [selectedSale]);

    const handlePrint = () => {
        if (receiptRef.current && selectedSale) {
            printThermalReceipt(receiptRef.current);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex overflow-hidden">
                {/* Sidebar */}
                <div className="w-1/3 border-r border-gray-200 bg-gray-50 flex flex-col">
                    <div className="p-4 border-b border-gray-200">
                        <h2 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                            <FileText size={20} /> Recent Bills
                        </h2>
                        <div className="flex flex-col gap-1 mt-2 text-xs text-gray-400">
                            <p>↑ ↓ to navigate</p>
                            <p>↵ Enter to Edit</p>
                            <p>Ctrl+P to Print</p>
                        </div>
                    </div>
                    <div className="overflow-y-auto flex-1">
                        {sales.map(sale => (
                            <div
                                key={sale.id}
                                id={`bill-item-${sale.id}`} // ID for scrolling
                                onClick={() => setSelectedSale(sale)}
                                className={`p-4 border-b cursor-pointer transition-colors 
                                    ${selectedSale?.id === sale.id 
                                        ? 'bg-white border-l-4 border-l-blue-600 shadow-sm ring-1 ring-black/5 z-10' 
                                        : 'hover:bg-white border-l-4 border-l-transparent text-gray-600'
                                    }`}
                            >
                                <div className="flex justify-between font-medium">
                                    <span className={selectedSale?.id === sale.id ? 'text-gray-900' : ''}>{sale.billNumber}</span>
                                    <span className={selectedSale?.id === sale.id ? 'text-blue-700' : ''}>{formatCurrency(sale.totalAmount)}</span>
                                </div>
                                <div className="text-xs text-gray-400 mt-1 flex justify-between">
                                    <span>{sale.soldAt?.toDate().toLocaleDateString()}</span>
                                    <span className="truncate max-w-[100px] text-right">{sale.customerName}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Detail View */}
                <div className="w-2/3 flex flex-col bg-white">
                    {selectedSale ? (
                        <>
                            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
                                <div>
                                    <h3 className="font-bold text-xl text-gray-800">{selectedSale.billNumber}</h3>
                                    <p className="text-sm text-gray-500">Customer: {selectedSale.customerName}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => onEdit(selectedSale)}
                                        className="px-3 py-2 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 flex items-center gap-2 text-sm font-medium transition-colors"
                                        title="Press Enter"
                                    >
                                        <Edit size={16} /> Edit
                                    </button>

                                    <button 
                                        onClick={handlePrint} 
                                        className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center gap-2 text-sm font-medium transition-colors"
                                        title="Press Ctrl+P"
                                    >
                                        <Printer size={16} /> Print
                                    </button>
                                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6">
                                <table className="w-full text-sm mb-6">
                                    <thead>
                                        <tr className="border-b text-left text-gray-500">
                                            <th className="py-2 font-medium">Item</th>
                                            <th className="py-2 font-medium">Qty</th>
                                            <th className="py-2 text-right font-medium">Price</th>
                                            <th className="py-2 text-right font-medium">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedSale.items.map((item, i) => (
                                            <tr key={i} className="border-b border-gray-50 last:border-0">
                                                <td className="py-3 text-gray-800">
                                                    {item.productName}
                                                    {item.isFreeItem && <span className="ml-2 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">FREE</span>}
                                                </td>
                                                <td className="py-3 text-gray-600">
                                                    {item.quantity} {item.unitType === 'weight' ? 'kg' : ''}
                                                </td>
                                                <td className="py-3 text-right text-gray-600">{formatCurrency(item.priceAtSale)}</td>
                                                <td className="py-3 text-right font-medium text-gray-800">{formatCurrency(item.priceAtSale * item.quantity)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* Summary Box */}
                                <div className="flex justify-end border-t pt-4">
                                    <div className="w-64 space-y-2 text-right text-sm">
                                        <div className="flex justify-between text-gray-500"><span>Subtotal:</span> <span>{formatCurrency(selectedSale.subTotal)}</span></div>
                                        
                                        {(selectedSale.additionalDiscount?.amount || 0) > 0 && (
                                            <div className="flex justify-between text-green-600"><span>Discount:</span> <span>-{formatCurrency(selectedSale.additionalDiscount?.amount || 0)}</span></div>
                                        )}
                                        
                                        {(selectedSale.loyaltyDiscount || 0) > 0 && (
                                            <div className="flex justify-between text-green-600"><span>Loyalty:</span> <span>-{formatCurrency(selectedSale.loyaltyDiscount || 0)}</span></div>
                                        )}

                                        <div className="flex justify-between text-gray-400 text-xs"><span>GST (Inc):</span> <span>{formatCurrency(selectedSale.gst)}</span></div>
                                        
                                        <div className="flex justify-between font-bold text-xl text-gray-900 pt-2 border-t mt-2">
                                            <span>Total:</span> <span>{formatCurrency(selectedSale.totalAmount)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                            <Search size={48} className="mb-4 opacity-20" />
                            <p>Select a bill to view details or edit</p>
                            <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full"><X size={24} /></button>
                        </div>
                    )}
                </div>
            </div>

            {/* Hidden for Print */}
            <div className="hidden">
                {selectedSale && (
                    <ThermalLayout ref={receiptRef} sale={selectedSale} storeDetails={{
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