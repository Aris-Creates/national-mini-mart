// src/components/pos/SaleCompleteOverlay.tsx
import { Sale } from '../../types/sale';
import { Button } from '../ui/Button';
import { formatCurrency } from '../../utils/formatCurrency';
import { CheckCircle, Printer, ShoppingCart } from 'lucide-react';

interface SaleCompleteOverlayProps {
    lastSale: Sale;
    onPrint: () => void;
    onNewSale: () => void;
}

export function SaleCompleteOverlay({ lastSale, onPrint, onNewSale }: SaleCompleteOverlayProps) {
    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
            <div className="bg-slate-800 rounded-xl shadow-2xl p-8 md:p-10 text-center max-w-md w-full border border-slate-700 flex flex-col items-center">
                <CheckCircle className="text-green-400 mb-4" size={60} strokeWidth={2} />
                <h2 className="text-3xl font-bold text-white mb-2">Sale Successful!</h2>
                <p className="text-slate-400 mb-8">The transaction has been completed and recorded.</p>

                {/* --- Redesigned Information Panel --- */}
                <div className="w-full bg-slate-900/50 rounded-lg p-6 mb-8 text-left border border-slate-700">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400 text-sm">Bill Number</span>
                            <span className="font-mono text-white font-semibold">{lastSale.billNumber}</span>
                        </div>

                        {/* Conditionally show Change Due for cash transactions */}
                        {lastSale.paymentMode === 'Cash' && lastSale.changeGiven > 0 && (
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 text-sm">Change Due</span>
                                <span className="font-mono text-amber-400 font-semibold">{formatCurrency(lastSale.changeGiven)}</span>
                            </div>
                        )}
                        
                        <div className="flex justify-between items-center border-t border-slate-700 pt-4">
                            <span className="text-slate-300 font-bold text-lg">Total Paid</span>
                            <span className="font-mono text-green-400 font-bold text-2xl">{formatCurrency(lastSale.totalAmount)}</span>
                        </div>
                    </div>
                </div>
                
                {/* --- Redesigned Action Buttons --- */}
                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button onClick={onPrint} variant="secondary" className="w-full justify-center gap-2 py-3">
                        <Printer size={18} />
                        Print Receipt
                    </Button>
                    <Button onClick={onNewSale} className="w-full justify-center gap-2 py-3 bg-green-800 hover:bg-green-900">
                        <ShoppingCart size={18} />
                        Start New Sale
                    </Button>
                </div>
            </div>
        </div>
    );
}