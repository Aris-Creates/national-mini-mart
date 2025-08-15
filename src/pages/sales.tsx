import { useState, useRef, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, DocumentData, Timestamp, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { Sale } from '../types/sale';

// --- UI Components & Utils ---
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableRow, TableCell } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';
import { ThermalLayout } from '../components/printing/ThermalLayout';
import { formatCurrency } from '../utils/formatCurrency';

// --- Printing & PDF Library ---
import { printThermalReceipt, downloadPdfReceipt } from '../lib/printing';

// --- Icons ---
import { Frown, Search, Printer, Download, XCircle } from 'lucide-react';

// --- Type-Safe Converter (Made more robust) ---
const docToSale = (doc: DocumentData): Sale | null => {
  const data = doc.data();
  if (!data || !data.billNumber || !data.soldAt) {
    console.warn("Skipping malformed sale document:", doc.id);
    return null;
  }
  return {
    id: doc.id,
    billNumber: data.billNumber,
    customerName: data.customerName || 'Walk-in Customer',
    customerId: data.customerId,
    items: data.items || [],
    subTotal: data.subTotal || 0,
    discount: data.discount || 0,
    gst: data.gst,
    totalAmount: data.totalAmount || 0,
    paymentMode: data.paymentMode || 'Other',
    amountReceived: data.amountReceived,
    changeGiven: data.changeGiven,
    loyaltyPointsEarned: data.loyaltyPointsEarned || 0,
    loyaltyPointsUsed: data.loyaltyPointsUsed || 0,
    soldAt: data.soldAt as Timestamp,
    soldBy: data.soldBy || 'N/A',
  };
};

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  // State for Live Search Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'billNumber' | 'customerPhone' | 'customerName'>('billNumber');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [viewTitle, setViewTitle] = useState('Recent Sales');
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

  // useEffect for both initial load and live searching
  useEffect(() => {
    const fetchRecentSales = async () => {
      setIsLoading(true);
      setViewTitle('Recent Sales');
      try {
        const q = query(collection(db, "sales"), orderBy("soldAt", "desc"), limit(20));
        const snapshot = await getDocs(q);
        setSales(snapshot.docs.map(docToSale).filter(Boolean) as Sale[]);
      } catch (err) {
        console.error("Error fetching recent sales:", err);
        setSearchMessage("Could not load recent sales.");
      } finally {
        setIsLoading(false);
      }
    };

    const performSearch = async () => {
      setIsLoading(true);
      setViewTitle('Search Results');
      setSearchMessage(null);
      try {
        let q = query(collection(db, "sales"));

        if (startDate) q = query(q, where("soldAt", ">=", Timestamp.fromDate(new Date(startDate))));
        if (endDate) {
          const endOfDay = new Date(endDate);
          endOfDay.setHours(23, 59, 59, 999);
          q = query(q, where("soldAt", "<=", Timestamp.fromDate(endOfDay)));
        }

        if (searchTerm.trim()) {
          const term = searchTerm.trim();
          if (searchType === 'customerPhone' || searchType === 'customerName') {
            const field = searchType === 'customerPhone' ? 'phone' : 'name';
            const customerQuery = query(collection(db, "customers"), where(field, ">=", term), where(field, "<=", term + '\uf8ff'));
            const customerSnapshot = await getDocs(customerQuery);
            if (customerSnapshot.empty) {
              setSearchMessage(`No customer found for this ${field}.`);
              setSales([]);
              return;
            }
            const customerIds = customerSnapshot.docs.map(doc => doc.id);
            q = query(q, where("customerId", "in", customerIds));
          } else if (searchType === 'billNumber') {
            q = query(q, where("billNumber", ">=", term), where("billNumber", "<=", term + '\uf8ff'));
          }
        }

        const finalQuery = query(q, orderBy("soldAt", "desc"));
        const querySnapshot = await getDocs(finalQuery);

        if (querySnapshot.empty) setSearchMessage("No sales records found matching your criteria.");

        setSales(querySnapshot.docs.map(docToSale).filter(Boolean) as Sale[]);
      } catch (err) {
        console.error("Error searching sales:", err);
        setSearchMessage("An error occurred during the search.");
      } finally {
        setIsLoading(false);
      }
    };

    const isFilterActive = searchTerm.trim() || startDate || endDate;

    const handler = setTimeout(() => {
      if (isFilterActive) {
        performSearch();
      } else {
        fetchRecentSales();
      }
    }, 500); // Debounce time

    return () => clearTimeout(handler);
  }, [searchTerm, searchType, startDate, endDate]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setSearchMessage(null);
  };

  const handlePrint = () => { if (receiptRef.current) printThermalReceipt(receiptRef.current); };
  const handleDownloadPdf = () => { if (receiptRef.current && selectedSale) downloadPdfReceipt(receiptRef.current, `receipt-${selectedSale.billNumber}.pdf`); };

  const renderContent = () => {
    if (isLoading) return <p className="text-center text-slate-400 py-8">Loading...</p>;
    if (sales.length > 0) {
      return (
        <div className="overflow-x-auto max-h-[calc(100vh-250px)]">
          <Table>
            <TableHeader><tr><TableCell>Bill #</TableCell><TableCell>Customer</TableCell><TableCell>Amount</TableCell><TableCell>Date</TableCell><TableCell>Actions</TableCell></tr></TableHeader>
            <tbody>
              {sales.map(sale => (
                <TableRow key={sale.id} className="hover:bg-slate-700/50">
                  <TableCell>{sale.billNumber}</TableCell><TableCell>{sale.customerName}</TableCell><TableCell>{formatCurrency(sale.totalAmount)}</TableCell><TableCell>{sale.soldAt ? sale.soldAt.toDate().toLocaleString() : 'N/A'}</TableCell>
                  <TableCell><Button variant="secondary" onClick={() => setSelectedSale(sale)}>View / Reprint</Button></TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        </div>
      );
    }
    return (
      <div className="text-center py-10 border-2 border-dashed border-slate-700 rounded-lg">
        <Frown className="mx-auto h-12 w-12 text-slate-500" />
        <h3 className="mt-2 text-sm font-medium text-slate-300">{searchMessage || 'No Sales Found'}</h3>
        <p className="mt-1 text-sm text-slate-500">{viewTitle === 'Search Results' ? 'Try adjusting your search criteria.' : 'Transactions will appear here once they are made.'}</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 text-white min-h-screen p-6 font-sans">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Sales History</h1>
        <p className="text-slate-400">Search and review past transaction records</p>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-slate-800 p-6 rounded-lg shadow-md space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2"><Search size={22} /> Filter Sales</h2>
              <Button variant="secondary" onClick={handleClearFilters} className="flex items-center gap-1 text-slate-400 hover:text-white">
                <XCircle size={14} /> Clear
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Start Date</label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">End Date</label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Search By</label>
              <select value={searchType} onChange={e => setSearchType(e.target.value as any)} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-slate-100">
                <option value="billNumber">Bill Number</option>
                <option value="customerPhone">Customer Phone</option>
                <option value="customerName">Customer Name</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Search Term (Live)</label>
              <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Start typing..." />
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-slate-800 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">{viewTitle}</h2>
            {renderContent()}
          </div>
        </div>
      </main>

      <Modal isOpen={!!selectedSale} onClose={() => setSelectedSale(null)} title={`Bill Details: ${selectedSale?.billNumber}`}>
        {selectedSale && (
          <div className="space-y-4">
            <div className="bg-white text-black p-2 overflow-auto max-h-[60vh] rounded">
              <ThermalLayout ref={receiptRef} sale={selectedSale} storeDetails={{ name: "National Mini Mart", address: "123 Main St", phone: "555-123-4567" }} />
            </div>
            <div className="flex justify-center">
              <Button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2">
                <Printer size={18} />
                Print Receipt
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}