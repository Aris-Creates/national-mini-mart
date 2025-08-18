// src/pages/SalesPage.tsx
import { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, DocumentData, Timestamp, limit, writeBatch, doc, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '../../firebase';
import { Sale } from '../types/sale';
import { Button } from '../components/ui/Button';
import { Table, TableHeader, TableRow, TableCell, TableBody } from '../components/ui/Table';
import { formatCurrency } from '../utils/formatCurrency';
import { Frown, Edit } from 'lucide-react';
import { SaleEditModal } from '../components/pos/SaleEditModal';

const docToSale = (doc: DocumentData): Sale => {
  const data = doc.data();
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
    soldAt: data.soldAt as Timestamp,
    soldBy: data.soldBy || '',
  };
};

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  useEffect(() => {
    const fetchSales = async () => {
      setIsLoading(true);
      try {
        let q = query(collection(db, "sales"), orderBy("soldAt", "desc"), limit(50));
        const snapshot = await getDocs(q);
        setSales(snapshot.docs.map(docToSale));
      } catch (err) { console.error("Error fetching sales:", err); }
      finally { setIsLoading(false); }
    };
    fetchSales();
  }, []);

  const handleOpenEditModal = (sale: Sale) => {
    setSelectedSale(sale);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setSelectedSale(null);
    setIsEditModalOpen(false);
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

      setSales(sales.map(s => s.id === updatedSale.id ? updatedSale : s));
      handleCloseEditModal();
      alert('Sale updated successfully!');

    } catch (error) {
      console.error("Failed to update sale:", error);
      alert("Error: Could not update the sale. Please check the console for details.");
      throw error;
    }
  };

  return (
    <div className="bg-white text-black min-h-screen p-6 font-sans">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Sales History</h1>
        <p className="text-gray-500">Review and edit past transactions</p>
      </header>
      <main className="bg-gray-50 p-6 border border-gray-200">
        <h2 className="text-xl font-bold mb-4 text-gray-700">All Sales</h2>
        {isLoading ? (<p className="text-center text-gray-500 py-8">Loading...</p>) : (
          <div className="overflow-x-auto max-h-[calc(100vh-250px)] border border-gray-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell>Bill #</TableCell><TableCell>Customer</TableCell><TableCell>Amount</TableCell><TableCell>Date</TableCell><TableCell>Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map(sale => (
                  <TableRow key={sale.id} className="hover:bg-gray-100">
                    <TableCell className="font-medium">{sale.billNumber}</TableCell>
                    <TableCell>{sale.customerName}</TableCell>
                    <TableCell>{formatCurrency(sale.totalAmount)}</TableCell>
                    <TableCell>
                      {
                        sale.soldAt instanceof Date
                          ? sale.soldAt.toLocaleString()
                          : (sale.soldAt && typeof sale.soldAt.toDate === 'function'
                              ? sale.soldAt.toDate().toLocaleString()
                              : '')
                      }
                    </TableCell>
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
        )}
      </main>
      <SaleEditModal isOpen={isEditModalOpen} onClose={handleCloseEditModal} sale={selectedSale} onSave={handleUpdateSale} />
    </div>
  );
}