// src/pages/InventoryPage.tsx
import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, writeBatch, doc, serverTimestamp, increment, orderBy, DocumentData, Timestamp, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../hooks/useAuth';
import { Product } from '../types/product';
import { InventoryLog } from '../types/inventory';

// --- UI Components ---
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
// **FIXED**: Imported the complete set of table components
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { PackagePlus, History, Frown } from 'lucide-react';

// --- Type-Safe Converters ---
// **FIXED**: This function is now up-to-date with the latest Product type
const docToProduct = (doc: DocumentData): Product => {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name || '',
    costPrice: data.costPrice || 0,
    mrp: data.mrp || 0,
    sellingPrice: data.sellingPrice,
    stock_quantity: data.stock_quantity || 0,
    min_stock_level: data.min_stock_level || 0,
    gst_rate: data.gst_rate || 0,
    hsn_code: data.hsn_code || '',
    brand: data.brand || '',
    barcode: data.barcode || '',
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
  const { user } = useAuth();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number | ''>('');
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const productsPromise = getDocs(query(collection(db, "products"), orderBy("name")));
      const logsPromise = getDocs(query(collection(db, "inventoryLogs"), orderBy("addedAt", "desc"), limit(50)));
      const [productsSnapshot, logsSnapshot] = await Promise.all([productsPromise, logsPromise]);
      
      setAllProducts(productsSnapshot.docs.map(docToProduct));
      setLogs(logsSnapshot.docs.map(docToInventoryLog));
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const lowercasedTerm = searchTerm.toLowerCase();
    return allProducts.filter(p => 
      p.name.toLowerCase().includes(lowercasedTerm) || 
      p.barcode?.toLowerCase().includes(lowercasedTerm)
    ).slice(0, 5);
  }, [searchTerm, allProducts]);

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setSearchTerm('');
    setQuantity('');
    setFormMessage(null);
  };

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
      
      const productRef = doc(db, "products", selectedProduct.id);
      batch.update(productRef, { stock_quantity: increment(numericQuantity), updatedAt: serverTimestamp() });
      
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
      setSelectedProduct(prev => prev ? {...prev, stock_quantity: prev.stock_quantity + numericQuantity} : null);
      setQuantity('');
      await fetchData();
      
      setTimeout(() => {
        setFormMessage(null);
        setSelectedProduct(null);
      }, 2000);

    } catch (error) {
      console.error("Error adding stock:", error);
      setFormMessage("Failed to add stock. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-100 text-black min-h-screen p-6 font-sans">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Stock Management</h1>
        <p className="text-gray-500">Add incoming stock for products in your catalog</p>
      </header>
      
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white p-6 border border-gray-200">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-700">
              <PackagePlus size={22} /> Add Stock
            </h2>
            <div className="space-y-4 relative">
              <div>
                <Input
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)} 
                  placeholder="Type name or barcode..."
                />
                {filteredProducts.length > 0 && (
                  <div className="absolute z-10 w-full bg-white mt-1 border border-gray-200 shadow-lg max-h-48 overflow-y-auto">
                    {filteredProducts.map(p => (
                      <div key={p.id} onClick={() => handleSelectProduct(p)} className="p-3 hover:bg-gray-100 cursor-pointer">
                        <p className="font-medium text-gray-800">{p.name}</p>
                        <p className="text-xs text-gray-500">Barcode: {p.barcode || 'N/A'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedProduct && (
                <div className="bg-gray-50 p-4 border border-gray-200 space-y-4 animate-fade-in">
                  <div>
                    <p className="font-semibold text-gray-800">{selectedProduct.name}</p>
                    <p className="text-sm text-gray-500">Current Stock: {selectedProduct.stock_quantity}</p>
                  </div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity to Add</label>
                  <Input
                    type="number"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    placeholder="0"
                    min="1"
                    autoFocus
                  />
                  <Button onClick={handleStockIn} disabled={isSubmitting} className="w-full">
                    {isSubmitting ? 'Saving...' : 'Save Stock'}
                  </Button>
                  {formMessage && <p className={`text-sm mt-2 text-center ${formMessage.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>{formMessage}</p>}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white p-6 border border-gray-200">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-700"><History size={22} /> Stock In History</h2>
            {isLoading ? <p className="text-center text-gray-500 py-8">Loading history...</p> : (
              logs.length > 0 ? (
                <div className="overflow-x-auto max-h-[calc(100vh-250px)]">
                  <Table>
                    {/* **FIXED**: Using semantically correct TableHead component */}
                    <TableHeader><TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Qty Added</TableHead>
                      <TableHead>Added By</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {logs.map(log => (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium">{log.productName}</TableCell>
                          <TableCell className="text-green-600 font-medium">+{log.quantityAdded}</TableCell>
                          <TableCell>{log.addedBy}</TableCell>
                          <TableCell>{log.addedAt ? log.addedAt.toDate().toLocaleString() : 'Processing...'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-10 border-2 border-dashed border-gray-300">
                  <Frown className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-800">No Stock History Found</h3>
                  <p className="mt-1 text-sm text-gray-500">Stock-in events will appear here.</p>
                </div>
              )
            )}
          </div>
        </div>
      </main>
    </div>
  );
}