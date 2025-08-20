// src/pages/SalesPage.tsx
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, DocumentData, Timestamp, limit, writeBatch, doc, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '../../firebase';
import { Sale } from '../types/sale';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { formatCurrency } from '../utils/formatCurrency';
import { Frown, Edit, Search, XCircle } from 'lucide-react';
import { SaleEditModal } from '../components/pos/SaleEditModal';

type SaleWithDate = Omit<Sale, 'soldAt'> & { soldAt: Date };

// **THE FIX IS HERE**
const docToSale = (doc: DocumentData): SaleWithDate => {
  const data = doc.data();
  // Get the raw value from Firestore first
  const soldAtTimestamp = data.soldAt;

  // **Perform a runtime check.** This is the crucial fix.
  // It checks if soldAtTimestamp exists AND has a .toDate method that is a function.
  const soldAtDate = (soldAtTimestamp && typeof soldAtTimestamp.toDate === 'function')
    ? soldAtTimestamp.toDate() // If it's a valid Timestamp, convert it.
    : new Date(); // Otherwise, use a safe default (like now) to prevent crashing.

  return {
    id: doc.id,
    billNumber: data.billNumber || '',
    items: data.items || [],
    customerName: data.customerName || '',
    customerId: data.customerId,
    subTotal: data.subTotal || 0,
    discount: data.discount || 0,
    additionalDiscount: data.additionalDiscount,
    gst: data.gst || 0,
    roundOff: data.roundOff || 0,
    totalAmount: data.totalAmount || 0,
    paymentMode: data.paymentMode || 'Cash',
    amountReceived: data.amountReceived || 0,
    changeGiven: data.changeGiven || 0,
    loyaltyPointsEarned: data.loyaltyPointsEarned || 0,
    loyaltyPointsUsed: data.loyaltyPointsUsed || 0,
    soldAt: soldAtDate,
    soldBy: data.soldBy || '',
  };
};

export default function SalesPage() {
  const [sales, setSales] = useState<SaleWithDate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleWithDate | null>(null);

  const [searchType, setSearchType] = useState<'billNumber' | 'customerPhone'>('billNumber');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewTitle, setViewTitle] = useState('Recent Sales');
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecentSales = async () => {
      setIsLoading(true);
      setViewTitle('Recent Sales');
      setSearchMessage(null);
      try {
        const q = query(collection(db, "sales"), orderBy("soldAt", "desc"), limit(50));
        const snapshot = await getDocs(q);
        setSales(snapshot.docs.map(docToSale));
      } catch (err) {
        console.error("Error fetching recent sales:", err);
        setSearchMessage("Could not load recent sales.");
      } finally {
        setIsLoading(false);
      }
    };

    const performSearch = async () => {
      if (searchTerm.trim().length < 2) return;
      setIsLoading(true);
      setViewTitle('Search Results');
      setSearchMessage(null);
      setSales([]);

      try {
        let q: any;
        const term = searchTerm.trim();

        if (searchType === 'customerPhone') {
          const customerQuery = query(collection(db, "customers"), where('phone', '>=', term), where('phone', '<=', term + '\uf8ff'));
          const customerSnapshot = await getDocs(customerQuery);

          if (customerSnapshot.empty) {
            setSearchMessage(`No customer found with phone starting with "${term}".`);
            return;
          }
          const customerIds = customerSnapshot.docs.map(doc => doc.id);
          q = query(collection(db, "sales"), where("customerId", "in", customerIds), orderBy("soldAt", "desc"));
        } else {
          q = query(collection(db, "sales"), where("billNumber", ">=", term), where("billNumber", "<=", term + '\uf8ff'), orderBy("soldAt", "desc"));
        }

        const salesSnapshot = await getDocs(q);
        if (salesSnapshot.empty) {
          setSearchMessage("No sales records found matching your criteria.");
        }
        setSales(salesSnapshot.docs.map(docToSale));
      } catch (err) {
        console.error("Error searching sales:", err);
        setSearchMessage("An error occurred during the search.");
      } finally {
        setIsLoading(false);
      }
    };

    const handler = setTimeout(() => {
      if (searchTerm.trim()) {
        performSearch();
      } else {
        fetchRecentSales();
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [searchTerm, searchType]);

  const handleOpenEditModal = (sale: SaleWithDate) => {
    setSelectedSale(sale);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setSelectedSale(null);
    setIsEditModalOpen(false);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSearchType('billNumber');
  };

  const handleUpdateSale = async (originalSale: Sale, updatedSale: Sale) => {
    try {
      const batch = writeBatch(db);
      const originalItemsMap = new Map(originalSale.items.map(i => [i.productId, i.quantity]));
      const updatedItemsMap = new Map(updatedSale.items.map(i => [i.productId, i.quantity]));
      const allProductIds = new Set([...originalItemsMap.keys(), ...updatedItemsMap.keys()]);

      allProductIds.forEach(productId => {
        const originalQty = originalItemsMap.get(productId) || 0;
        const newQty = updatedItemsMap.get(productId) || 0;
        const quantityDiff = originalQty - newQty;

        if (quantityDiff !== 0) {
          const productRef = doc(db, "products", productId);
          batch.update(productRef, { stock_quantity: increment(quantityDiff) });
        }
      });

      const saleRef = doc(db, "sales", originalSale.id);
      const { id, ...saleDataForUpdate } = updatedSale;
      batch.update(saleRef, { ...saleDataForUpdate, updatedAt: serverTimestamp() });

      await batch.commit();

      const newlyUpdatedSale = { ...updatedSale, soldAt: (updatedSale.soldAt as Timestamp).toDate() };
      setSales(sales.map(s => s.id === updatedSale.id ? newlyUpdatedSale : s));
      handleCloseEditModal();
      alert('Sale updated successfully!');

    } catch (error) {
      console.error("Failed to update sale:", error);
      alert("Error: Could not update the sale. Please check the console for details.");
      throw error;
    }
  };

  return (
    <div className="bg-gray-100 text-black min-h-screen p-6 font-sans">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Sales History</h1>
        <p className="text-gray-500">Search, review, and edit past transactions</p>
      </header>
      
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white p-6 border border-gray-200 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-700 flex items-center gap-2"><Search size={22} /> Filter Sales</h2>
              <Button variant="secondary" onClick={handleClearFilters} className="flex items-center gap-1">
                <XCircle size={14} /> Clear
              </Button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Search By</label>
              <select value={searchType} onChange={e => setSearchType(e.target.value as any)} className="w-full bg-white border border-gray-300 p-2">
                <option value="billNumber">Bill Number</option>
                <option value="customerPhone">Customer Phone</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Search Term</label>
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder={searchType === 'billNumber' ? 'Type bill number...' : 'Type phone number...'}
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white p-6 border border-gray-200">
            <h2 className="text-xl font-bold mb-4 text-gray-700">{viewTitle}</h2>
            {isLoading ? (
              <p className="text-center text-gray-500 py-8">Loading...</p>
            ) : sales.length > 0 ? (
              <div className="overflow-x-auto max-h-[calc(100vh-350px)]">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Bill #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {sales.map(sale => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-medium">{sale.billNumber}</TableCell>
                        <TableCell>{sale.customerName}</TableCell>
                        <TableCell>{formatCurrency(sale.totalAmount)}</TableCell>
                        <TableCell>{sale.soldAt.toLocaleString()}</TableCell>
                        <TableCell>
                          <Button variant="secondary" onClick={() => handleOpenEditModal(sale)} className="flex items-center gap-1">
                            <Edit size={14} /> Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-10 border-2 border-dashed border-gray-300">
                <Frown className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-800">{searchMessage || 'No Sales Found'}</h3>
                <p className="mt-1 text-sm text-gray-500">{searchTerm ? 'Try adjusting your search criteria.' : 'Transactions will appear here once they are made.'}</p>
              </div>
            )}
          </div>
        </div>
      </main>
      
      <SaleEditModal 
        isOpen={isEditModalOpen} 
        onClose={handleCloseEditModal} 
        sale={selectedSale ? { ...selectedSale, soldAt: Timestamp.fromDate(selectedSale.soldAt) } : null} 
        onSave={handleUpdateSale} 
      />
    </div>
  );
}