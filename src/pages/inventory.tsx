import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, getDocs, query, writeBatch, doc, serverTimestamp, increment, orderBy, limit, DocumentData, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../hooks/useAuth';
import { Product } from '../types/product';
import { InventoryLog } from '../types/inventory';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { PackagePlus, History, Search, Plus, Archive, AlertCircle, CheckCircle2, Box } from 'lucide-react';

// --- Type-Safe Converters ---
const docToProduct = (doc: DocumentData): Product => {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name || '',
    category: data.category || '',
    sub_category: data.sub_category || '',
    brand: data.brand || '',
    costPrice: data.costPrice || 0,
    mrp: data.mrp || 0,
    sellingPrice: data.sellingPrice,
    is_gst_inclusive: data.is_gst_inclusive ?? true,
    gst_rate: data.gst_rate || 0,
    stock_quantity: data.stock_quantity || 0,
    min_stock_level: data.min_stock_level || 0,
    unit_type: data.unit_type || 'piece',
    unit_value: data.unit_value || 1,
    productCode: data.productCode || '',
    hsn_code: data.hsn_code || '',
    barcode: data.barcode || '',
    hasFreeItem: data.hasFreeItem ?? false,
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

  // Data State
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number | ''>('');
  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Keyboard Navigation State
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  // --- Fetch Data ---
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const productsPromise = getDocs(query(collection(db, "products"), orderBy("name")));
      const logsPromise = getDocs(query(collection(db, "inventoryLogs"), orderBy("addedAt", "desc"), limit(20)));

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

  // --- Search Logic ---
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const lowercasedTerm = searchTerm.toLowerCase();
    return allProducts.filter(p =>
      p.name.toLowerCase().includes(lowercasedTerm) ||
      p.barcode?.toLowerCase().includes(lowercasedTerm) ||
      p.productCode?.toLowerCase().includes(lowercasedTerm)
    ).slice(0, 8);
  }, [searchTerm, allProducts]);

  useEffect(() => {
    setFocusedIndex(-1);
  }, [searchTerm]);

  // --- Handlers ---
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setSearchTerm('');
    setFocusedIndex(-1);
    setQuantity('');
    setFormMessage(null);
    setTimeout(() => qtyInputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredProducts.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => (prev < filteredProducts.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < filteredProducts.length) {
        handleSelectProduct(filteredProducts[focusedIndex]);
      } else if (filteredProducts.length > 0) {
        handleSelectProduct(filteredProducts[0]);
      }
    } else if (e.key === 'Escape') {
      setSearchTerm('');
      setFocusedIndex(-1);
    }
  };

  const handleStockIn = async () => {
    const numericQuantity = Number(quantity);
    if (!selectedProduct || !numericQuantity || numericQuantity <= 0 || !user) {
      setFormMessage({ type: 'error', text: "Please enter a valid quantity." });
      return;
    }

    setIsSubmitting(true);
    setFormMessage(null);

    try {
      const batch = writeBatch(db);

      // Update Product
      const productRef = doc(db, "products", selectedProduct.id);
      batch.update(productRef, {
        stock_quantity: increment(numericQuantity),
        updatedAt: serverTimestamp()
      });

      // Create Log
      const logRef = doc(collection(db, "inventoryLogs"));
      batch.set(logRef, {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        quantityAdded: numericQuantity,
        addedBy: user.email || user.displayName || 'System',
        addedAt: serverTimestamp()
      });

      await batch.commit();

      setFormMessage({ type: 'success', text: "Stock updated successfully!" });

      // Optimistic update
      const updatedProduct = { ...selectedProduct, stock_quantity: selectedProduct.stock_quantity + numericQuantity };
      setAllProducts(prev => prev.map(p => p.id === selectedProduct.id ? updatedProduct : p));
      fetchData();

      // Reset
      setQuantity('');
      setSelectedProduct(null);
      setTimeout(() => {
        setFormMessage(null);
        searchInputRef.current?.focus();
      }, 1500);

    } catch (error) {
      console.error("Error adding stock:", error);
      setFormMessage({ type: 'error', text: "Failed to add stock. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen p-6 font-sans text-slate-900">

      {/* Container for Single Column Layout */}
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Inventory Management</h1>
          <p className="text-slate-500 mt-1">Search for products to add stock and view recent history.</p>
        </div>

        {/* --- SECTION 1: STOCK ENTRY --- */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-visible relative z-20">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
            <h2 className="font-semibold text-slate-700 flex items-center gap-2">
              <PackagePlus className="text-indigo-600" size={20} />
              Stock In Entry
            </h2>
          </div>

          <div className="p-6">

            {/* 1. Search Bar */}
            <div className="relative mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Find Product
              </label>
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                <Input
                  ref={searchInputRef}
                  className="pl-10 h-12 text-lg border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Scan barcode, type name or code..."
                  autoComplete="off"
                />
              </div>

              {/* Search Results Dropdown */}
              {filteredProducts.length > 0 && (
                <div className="absolute z-50 w-full bg-white mt-1 border border-slate-200 shadow-xl rounded-lg max-h-72 overflow-y-auto">
                  {filteredProducts.map((p, index) => (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProduct(p)}
                      className={`
                        p-4 cursor-pointer border-b border-slate-50 last:border-0 transition-colors
                        ${index === focusedIndex ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}
                      `}
                    >
                      <div className="flex justify-between items-center">
                        <span className={`font-medium ${index === focusedIndex ? 'text-indigo-900' : 'text-slate-700'}`}>
                          {p.name}
                        </span>
                        <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded">
                          Stock: {p.stock_quantity}
                        </span>
                      </div>
                      <div className="flex gap-4 text-xs text-slate-400 mt-1">
                        {p.productCode && <span>Code: {p.productCode}</span>}
                        {p.barcode && <span>Bar: {p.barcode}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Action Area (Conditional Render) */}
            <div className={`transition-all duration-300 ease-in-out origin-top ${selectedProduct ? 'opacity-100 scale-100' : 'opacity-0 scale-95 hidden'}`}>
              <div className="bg-indigo-50 rounded-lg p-5 border border-indigo-100">
                <div className="flex flex-col sm:flex-row sm:items-end gap-4">

                  {/* Selected Item Details */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Box size={16} className="text-indigo-600" />
                      <span className="text-xs font-bold uppercase text-indigo-600 tracking-wider">Selected Product</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">{selectedProduct?.name}</h3>
                    <p className="text-sm text-slate-500">
                      Current Stock: <span className="font-mono font-medium text-slate-700">{selectedProduct?.stock_quantity}</span>
                    </p>
                  </div>

                  {/* Quantity & Button */}
                  <div className="flex gap-2 w-full sm:w-auto">
                    <div className="w-24">
                      <label className="block text-xs font-semibold text-indigo-900 mb-1">Add Qty</label>
                      <Input
                        ref={qtyInputRef}
                        type="number"
                        value={quantity}
                        onChange={e => setQuantity(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                        placeholder="0"
                        min="1"
                        className="h-10 border-indigo-200 focus:border-indigo-500 bg-white"
                        onKeyDown={(e) => e.key === 'Enter' && handleStockIn()}
                      />
                    </div>
                    <div className="flex-1 sm:w-32 flex items-end">
                      <Button
                        onClick={handleStockIn}
                        disabled={isSubmitting}
                        className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center justify-center"
                      >
                        {isSubmitting ? 'Saving...' : <>
                          <Plus size={18} className="mr-1" />
                          Add
                        </>}
                      </Button>

                    </div>
                  </div>

                </div>

                {/* Feedback Message */}
                {formMessage && (
                  <div className={`mt-4 flex items-center gap-2 text-sm font-medium animate-in fade-in slide-in-from-top-1
                      ${formMessage.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>
                    {formMessage.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                    {formMessage.text}
                  </div>
                )}
              </div>
            </div>

          </div>
        </section>

        {/* --- SECTION 2: HISTORY --- */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="font-semibold text-slate-700 flex items-center gap-2">
              <History className="text-slate-500" size={20} />
              Recent Transactions
            </h2>
            <span className="text-xs font-medium text-slate-400 bg-white px-3 py-1 rounded border border-slate-200">
              Last 20 entries
            </span>
          </div>

          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-2"></div>
                <p className="text-sm">Loading history...</p>
              </div>
            ) : logs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 border-b-slate-100">
                    <TableHead className="pl-6 text-slate-500">Product</TableHead>
                    <TableHead className="text-center text-slate-500">Qty Added</TableHead>
                    <TableHead className="text-slate-500">User</TableHead>
                    <TableHead className="text-right pr-6 text-slate-500">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-slate-50 border-b-slate-50">
                      <TableCell className="pl-6 font-medium text-slate-700 py-4">
                        {log.productName}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                          +{log.quantityAdded}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {log.addedBy.split('@')[0]}
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm text-right pr-6">
                        {log.addedAt ? log.addedAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : '...'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="bg-slate-50 p-4 rounded-full mb-3">
                  <Archive className="h-8 w-8 text-slate-300" />
                </div>
                <h3 className="text-slate-900 font-medium">No transactions yet</h3>
                <p className="text-slate-500 text-sm mt-1">Start adding stock to see history here.</p>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}