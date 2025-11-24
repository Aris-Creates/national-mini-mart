// src/components/pos/SaleCompleteOverlay.tsx
import { useEffect } from 'react';
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
    // Add useEffect to handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Check for Ctrl + P to trigger printing
            if (event.ctrlKey && event.key.toLowerCase() === 'p') {
                event.preventDefault(); // Prevent the default browser print dialog
                onPrint();
            }
        };

        // Add event listener when the component mounts
        window.addEventListener('keydown', handleKeyDown);

        // Clean up the event listener when the component unmounts
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onPrint]); // Dependency array ensures the effect uses the latest onPrint function

    return (
        // --- Light Theme Change: Overlay background ---
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
            {/* --- Light Theme Change: Main card styling --- */}
            <div className="bg-white rounded-xl shadow-2xl p-8 md:p-10 text-center max-w-md w-full border border-gray-200 flex flex-col items-center">
                {/* --- Color Change: Icon color for better contrast on white --- */}
                <CheckCircle className="text-green-500 mb-4" size={60} strokeWidth={1.5} />
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Sale Successful!</h2>
                <p className="text-gray-500 mb-6">The transaction has been completed and recorded.</p>

                {/* --- Redesigned Information Panel for Light Theme --- */}
                <div className="w-full bg-gray-50 rounded-lg p-6 mb-8 text-left border border-gray-200">
                    <div className="space-y-4">
                        <div className="flex justify-between items-baseline">
                            <span className="text-gray-600 text-sm font-sans">Bill Number</span>
                            <span className="font-mono text-gray-900 font-semibold">{lastSale.billNumber}</span>
                        </div>

                        {/* Conditionally show Change Due for cash transactions */}
                        {lastSale.paymentMode === 'Cash' && lastSale.changeGiven > 0 && (
                            <div className="flex justify-between items-baseline">
                                <span className="text-gray-600 text-sm font-sans">Change Due</span>
                                {/* --- Color Change: Use a distinct color for change --- */}
                                <span className="font-mono text-orange-600 font-semibold">{formatCurrency(lastSale.changeGiven)}</span>
                            </div>
                        )}
                        
                        {/* --- Improved Visual Hierarchy: Larger font and clear separation for the total --- */}
                        <div className="flex justify-between items-baseline border-t border-gray-200 pt-4">
                            <span className="text-gray-800 font-bold text-lg font-sans">Total Paid</span>
                            <span className="font-mono text-green-600 font-bold text-2xl">{formatCurrency(lastSale.totalAmount)}</span>
                        </div>
                    </div>
                </div>
                
                {/* --- Redesigned Action Buttons for Light Theme --- */}
                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* --- Secondary button with explicit light theme styling --- */}
                    <Button 
                        onClick={onPrint} 
                        variant="secondary" 
                        className="w-full justify-center gap-2 py-3 bg-gray-100 text-gray-800 hover:bg-gray-200"
                    >
                        <Printer size={18} />
                        Print Receipt
                    </Button>
                    {/* --- Primary button with a clear, inviting color --- */}
                    <Button 
                        onClick={onNewSale} 
                        className="w-full justify-center gap-2 py-3 bg-blue-600 text-white hover:bg-blue-700"
                    >
                        <ShoppingCart size={18} />
                        Start New Sale
                    </Button>
                </div>
            </div>
        </div>
    );
}