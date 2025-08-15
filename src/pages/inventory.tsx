import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, writeBatch, doc, serverTimestamp, increment, orderBy, DocumentData, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../hooks/useAuth';
import { Product } from '../types/product';
import { InventoryLog } from '../types/inventory';

// --- UI Components ---
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableRow, TableCell } from '../components/ui/Table';
import { PackagePlus, History, Frown, Search } from 'lucide-react';

// --- Type-Safe Converters ---
const docToProduct = (doc: DocumentData): Product => {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name || '',
    barcode: data.barcode || '',
    mrp: data.mrp || 0,
    stock: data.stock || 0,
    createdAt: data.createdAt as Timestamp,
    updatedAt: data.updatedAt as Timestamp,
  };
};

const docToInventoryLog = (doc: DocumentData): InventoryLog => {
  const data = doc.data();
  return {
    id: doc.id,
    productId: data.productId || '',
    productName: data.productName || '',
    quantityAdded: data.quantityAdded || 0,
    addedBy: data.addedBy || 'Unknown',
    addedAt: data.addedAt as Timestamp,
  };
};

export default function InventoryPage() {
  // --- State Management ---
  const { user } = useAuth();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // --- Form & Search State ---
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number | ''>('');
  const [formMessage, setFormMessage] = useState<string | null>(null);

  // --- Data Fetching ---
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch both products (for searching) and logs (for history)
      const productsPromise = getDocs(query(collection(db, "products"), orderBy("name")));
      const logsPromise = getDocs(query(collection(db, "inventoryLogs"), orderBy("addedAt", "desc")));
      const [productsSnapshot, logsSnapshot] = await Promise.all([productsPromise, logsPromise]);
      
      setAllProducts(productsSnapshot.docs.map(docToProduct));
      setLogs(logsSnapshot.docs.map(docToInventoryLog));
    } catch (error) {
      console.error("Error fetching data:", error);
      // Optionally set an error state to display to the user
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Live Search Dropdown Logic ---
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const lowercasedTerm = searchTerm.toLowerCase();
    return allProducts.filter(p => 
      p.name.toLowerCase().includes(lowercasedTerm) || 
      p.barcode?.toLowerCase().includes(lowercasedTerm)
    ).slice(0, 5); // Show top 5 matches
  }, [searchTerm, allProducts]);

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setSearchTerm(''); // Clear search term to hide the dropdown
    setQuantity(''); // Clear quantity for the new selection
    setFormMessage(null); // Clear any previous messages
  };

  // --- Stock Submission Logic ---
  const handleStockIn = async () => {
    const numericQuantity = Number(quantity);
    if (!selectedProduct || !numericQuantity || numericQuantity <= 0 || !user) {
      setFormMessage("Please select a product and enter a valid quantity.");
      return;
    }
    
    setIsSubmitting(true);
    setFormMessage(null);

    try {
      const batch = writeBatch(db);
      
      // Update the product's stock count
      const productRef = doc(db, "products", selectedProduct.id);
      batch.update(productRef, { stock: increment(numericQuantity), updatedAt: serverTimestamp() });
      
      // Create a new log entry for the history
      const logRef = doc(collection(db, "inventoryLogs"));
      batch.set(logRef, {
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          quantityAdded: numericQuantity,
          addedBy: user.email || user.displayName || 'System',
          addedAt: serverTimestamp()
      });
      
      await batch.commit();
      
      setFormMessage("Stock added successfully!");
      // Optimistically update the UI for instant feedback
      setSelectedProduct(prev => prev ? {...prev, stock: prev.stock + numericQuantity} : null);
      setQuantity('');
      await fetchData(); // Refresh data to show the new log and updated product list
      
      setTimeout(() => {
        setFormMessage(null);
        setSelectedProduct(null); // Clear selection for the next operation
      }, 2000);

    } catch (error) {
      console.error("Error adding stock:", error);
      setFormMessage("Failed to add stock. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900 text-white min-h-screen p-6 font-sans">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Stock Management</h1>
        <p className="text-slate-400">Add incoming stock for products in your catalog</p>
      </header>
      
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* --- Left Column: Add Stock Form --- */}
        <div className="lg:col-span-1">
          <div className="bg-slate-800 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <PackagePlus size={22} /> Add Stock
            </h2>
            <div className="space-y-4 relative">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Search Product</label>
                <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} 
                  placeholder="Type name or barcode..." />
                {filteredProducts.length > 0 && (
                  <div className="absolute z-10 w-full bg-slate-700 mt-1 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredProducts.map(p => (
                      <div key={p.id} onClick={() => handleSelectProduct(p)} className="p-2 hover:bg-slate-600 cursor-pointer">
                        <p>{p.name}</p>
                        <p className="text-xs text-slate-400">Barcode: {p.barcode || 'N/A'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedProduct && (
                <div className="bg-slate-700/50 p-4 rounded-md space-y-4 border border-slate-600 animate-fade-in">
                  <div>
                    <p className="font-semibold text-slate-100">{selectedProduct.name}</p>
                    <p className="text-sm text-slate-400">Current Stock: {selectedProduct.stock}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Quantity to Add</label>
                    <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value === '' ? '' : parseInt(e.target.value, 10))} placeholder="0" min="1" autoFocus/>
                  </div>
                  <Button onClick={handleStockIn} disabled={isSubmitting} className="w-full">
                    {isSubmitting ? 'Saving...' : 'Save Stock'}
                  </Button>
                  {formMessage && <p className={`text-sm mt-2 text-center ${formMessage.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>{formMessage}</p>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* --- Right Column: Stock History --- */}
        <div className="lg:col-span-2">
          <div className="bg-slate-800 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><History size={22} /> Stock In History</h2>
            {isLoading ? <p className="text-center text-slate-400 py-8">Loading history...</p> : (
              logs.length > 0 ? (
                <div className="overflow-x-auto max-h-[calc(100vh-250px)]">
                  <Table>
                    <TableHeader><tr><TableCell>Product</TableCell><TableCell>Qty Added</TableCell><TableCell>Added By</TableCell><TableCell>Date</TableCell></tr></TableHeader>
                    <tbody>
                      {logs.map(log => (
                        <TableRow key={log.id}>
                          <TableCell>{log.productName}</TableCell>
                          <TableCell className="text-green-400 font-medium">+{log.quantityAdded}</TableCell>
                          <TableCell>{log.addedBy}</TableCell>
                          <TableCell>{log.addedAt ? log.addedAt.toDate().toLocaleString() : 'Processing...'}</TableCell>
                        </TableRow>
                      ))}
                    </tbody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-10 border-2 border-dashed border-slate-700 rounded-lg">
                  <Frown className="mx-auto h-12 w-12 text-slate-500" />
                  <h3 className="mt-2 text-sm font-medium text-slate-300">No Stock History Found</h3>
                  <p className="mt-1 text-sm text-slate-500">Stock-in events will appear here.</p>
                </div>
              )
            )}
          </div>
        </div>
      </main>
    </div>
  );
}