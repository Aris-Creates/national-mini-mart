import { useState, useEffect } from 'react';
import { Plus, X, History, UserCircle, Keyboard } from 'lucide-react';
import { ActiveBill, createEmptyBill } from '../types/pos';
import { ActiveBillView } from '../components/pos/ActiveBillView';
import { PastBillsModal } from '../components/pos/PastBillsModal';
import { useAuth } from '../hooks/useAuth';
import { Sale } from '../types/sale';

export default function PosPage() {
  const { profile } = useAuth();
  const [bills, setBills] = useState<ActiveBill[]>([createEmptyBill(1)]);
  const [activeTabId, setActiveTabId] = useState<number>(1);
  const [showHistory, setShowHistory] = useState(false);
  const [nextBillId, setNextBillId] = useState(2);

  // Keyboard Shortcuts (Same logic as before)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Ctrl + Alt + Number: Switch to Tab
      if (e.ctrlKey && e.altKey) {
          const key = parseInt(e.key);
          if (!isNaN(key) && key > 0 && key <= bills.length) {
              e.preventDefault();
              setActiveTabId(bills[key - 1].id); 
              return;
          }
      }

      // Alt + N: New Tab
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleAddTab();
      }
      // Alt + H: History
      if (e.altKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setShowHistory(true);
      }
      // Escape: Close History
      if (e.key === 'Escape' && showHistory) {
        setShowHistory(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bills, activeTabId, showHistory]);

  const handleAddTab = () => {
    const newBill = createEmptyBill(nextBillId);
    setBills(prev => [...prev, newBill]);
    setActiveTabId(nextBillId);
    setNextBillId(prev => prev + 1);
  };

  const handleCloseTab = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (bills.length === 1) {
      const resetBill = createEmptyBill(nextBillId);
      setBills([resetBill]);
      setActiveTabId(nextBillId);
      setNextBillId(prev => prev + 1);
      return;
    }
    
    const newBills = bills.filter(b => b.id !== id);
    setBills(newBills);
    if (activeTabId === id) {
      setActiveTabId(newBills[newBills.length - 1].id);
    }
  };

  const updateActiveBill = (updates: Partial<ActiveBill>) => {
    setBills(prev => prev.map(b => b.id === activeTabId ? { ...b, ...updates } : b));
  };

  const handleLoadPastBill = (sale: Sale) => {
      const loadedBill: Partial<ActiveBill> = {
          cart: sale.items,
          customer: sale.customerId ? { 
              id: sale.customerId, 
              name: sale.customerName, 
              loyaltyPoints: 0, phone: '', address: '', createdAt: {} as any, updatedAt: {} as any
          } : null,
          walkInName: sale.customerId ? '' : sale.customerName,
          paymentMode: sale.paymentMode as any,
          amountReceived: sale.amountReceived,
          discountType: sale.additionalDiscount?.type || 'percentage',
          discountValue: sale.additionalDiscount?.value || '',
          loyaltyPointsToUse: sale.loyaltyPointsUsed || 0,
          existingSaleId: sale.id, 
          billNumber: sale.billNumber,
          label: `Edit ${sale.billNumber}`
      };
      updateActiveBill(loadedBill);
      setShowHistory(false);
  };

  const activeBill = bills.find(b => b.id === activeTabId) || bills[0];

  return (
    <div className="h-screen w-full flex flex-col bg-slate-100 font-sans overflow-hidden text-slate-900">
      
      {/* --- TOP NAVIGATION & TAB STRIP --- */}
      <div className="bg-slate-200 border-b border-slate-300 pt-2 px-2 flex justify-between items-end shrink-0 select-none">
        
        {/* Left: Tab List */}
        <div className="flex items-end gap-1 overflow-x-auto no-scrollbar max-w-[70%]">
          {bills.map((bill, index) => {
            const isActive = activeTabId === bill.id;
            return (
              <div
                key={bill.id}
                onClick={() => setActiveTabId(bill.id)}
                className={`
                  relative group flex items-center gap-2 pl-3 pr-2 py-2 rounded-t-lg cursor-pointer transition-all min-w-[120px] max-w-[200px] border-t border-x
                  ${isActive 
                    ? 'bg-white text-blue-700 border-t-2 border-t-blue-600 border-x-slate-300 shadow-sm z-10' 
                    : 'bg-slate-100 text-slate-500 border-transparent hover:bg-slate-50 hover:text-slate-700'
                  }
                `}
              >
                {/* Tab Number / Shortcut Hint */}
                <span className={`text-[10px] font-mono border px-1 rounded ${isActive ? 'border-blue-200 text-blue-400' : 'border-slate-300 text-slate-400'}`}>
                    {index + 1}
                </span>

                <span className="truncate text-sm font-medium flex-grow">
                  {bill.label}
                </span>

                {/* Cart Badge */}
                {bill.cart.length > 0 && (
                   <span className={`text-[10px] px-1.5 rounded-full font-bold ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'}`}>
                      {bill.cart.length}
                   </span>
                )}

                {/* Close Button */}
                <button 
                  onClick={(e) => handleCloseTab(e, bill.id)}
                  className={`
                    p-0.5 rounded-md transition-opacity 
                    ${isActive ? 'hover:bg-red-100 hover:text-red-600' : 'opacity-0 group-hover:opacity-100 hover:bg-slate-300'}
                  `}
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}

          {/* New Tab Button */}
          <button 
            onClick={handleAddTab} 
            className="ml-1 mb-1.5 p-1.5 text-slate-500 hover:bg-white hover:text-blue-600 rounded-md transition-colors" 
            title="New Bill (Alt+N)"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Right: Actions & User Info */}
        <div className="flex items-center gap-3 mb-1.5 pb-1">
            <button 
                onClick={() => setShowHistory(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 shadow-sm transition-all"
                title="View Past Bills (Alt+H)"
            >
                <History size={16} /> 
                <span className="hidden md:inline">History</span>
            </button>

            <div className="h-6 w-px bg-slate-300 mx-1"></div>

            <div className="flex items-center gap-2 text-right px-2">
                <div className="hidden md:block">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Operator</p>
                    <p className="text-sm font-bold text-slate-800 leading-none">{profile?.email?.split('@')[0]}</p>
                </div>
                <div className="bg-slate-300 p-1.5 rounded-full text-white">
                     <UserCircle size={20} className="text-slate-600" />
                </div>
            </div>
        </div>
      </div>

      {/* --- ACTIVE BILL WORKSPACE --- */}
      <div className="flex-grow overflow-hidden relative bg-white shadow-inner">
        <ActiveBillView 
          key={activeBill.id} 
          bill={activeBill}
          onUpdate={updateActiveBill}
          onBillCompleted={() => {
              const empty = createEmptyBill(activeBill.id);
              updateActiveBill({ ...empty, id: activeBill.id }); 
          }}
        />
        
        {/* Helper Footer (Optional) */}
        <div className="absolute bottom-1 right-4 opacity-50 text-[10px] text-slate-400 pointer-events-none flex gap-3">
            <span className="flex items-center gap-1"><Keyboard size={10}/> Shortcuts:</span>
            <span><b>F2</b> Search</span>
            <span><b>Ctrl+P</b> Print</span>
            <span><b>Alt+N</b> New Tab</span>
            <span><b>Alt+1-9</b> Switch Tab</span>
        </div>
      </div>

      {/* --- HISTORY MODAL --- */}
      {showHistory && (
        <PastBillsModal 
            onClose={() => setShowHistory(false)} 
            onEdit={handleLoadPastBill} 
        />
      )}
    </div>
  );
}