// src/pages/ProductsPage.tsx
import { useState, useEffect, useMemo } from 'react'; // Import useMemo
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where, DocumentData, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { Product } from '../types/product';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableRow, TableCell } from '../components/ui/Table';
import { formatCurrency } from '../utils/formatCurrency';
import { Edit, Trash2, Plus, Frown, BookOpen } from 'lucide-react';

// --- Updated Type-Safe Converter ---
const docToProduct = (doc: DocumentData): Product => {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name || '',
    barcode: data.barcode || '',
    mrp: data.mrp || 0,
    stock: data.stock || 0,
    gstRate: data.gstRate, // <-- ADDED
    createdAt: data.createdAt as Timestamp,
    updatedAt: data.updatedAt as Timestamp,
  };
};

const EMPTY_PRODUCT: Partial<Product> = { name: '', barcode: '', mrp: 0, gstRate: 0 };

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentProduct, setCurrentProduct] = useState<Partial<Product>>(EMPTY_PRODUCT);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // --- NEW STATE for Price & GST Calculation ---
  const [priceInputType, setPriceInputType] = useState<'withGst' | 'withoutGst'>('withGst');
  const [priceInputValue, setPriceInputValue] = useState<number>();
  const [gstRateInput, setGstRateInput] = useState<number>(18); // Default to 18%

  // --- NEW: Calculate Final MRP in real-time ---
  const finalMrp = useMemo(() => {
    if (priceInputType === 'withGst') {
      return priceInputValue;
    }
    if (priceInputType === 'withoutGst') {
      const taxAmount = (priceInputValue ?? 0) * (gstRateInput / 100);
      // Round to 2 decimal places to avoid floating point issues
      return Math.round(((priceInputValue ?? 0) + taxAmount) * 100) / 100;
    }
    return 0;
  }, [priceInputType, priceInputValue, gstRateInput]);


  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
      setProducts((await getDocs(q)).docs.map(docToProduct));
    } catch (err) {
      console.error("Error fetching products:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCurrentProduct(prev => ({ ...prev, [name]: value }));
  };
  
  // --- UPDATED: Populate all form fields when selecting a product ---
  const handleSelectProduct = (product: Product) => {
    setCurrentProduct(product);
    setPriceInputType('withGst'); // Default to showing the final MRP
    setPriceInputValue(product.mrp || 0);
    setGstRateInput(product.gstRate || 18); // Use saved rate or default
    setFormError(null);
  };
  
  // --- UPDATED: Clear all form state ---
  const handleClearForm = () => {
    setCurrentProduct(EMPTY_PRODUCT);
    setPriceInputType('withGst');
    setPriceInputValue(0);
    setGstRateInput(18);
    setFormError(null);
  };

  // --- UPDATED: Save logic with GST calculation ---
  const handleSaveProduct = async () => {
    if (!currentProduct.name?.trim()) {
      setFormError("Product name is required.");
      return;
    }
    if ((finalMrp ?? 0) <= 0) {
      setFormError("Final MRP must be greater than zero.");
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      // Barcode validation remains the same
      if (currentProduct.barcode?.trim()) {
        const q = query(collection(db, "products"), where("barcode", "==", currentProduct.barcode.trim()));
        const existing = await getDocs(q);
        if (!existing.empty && existing.docs[0].id !== currentProduct.id) {
          setFormError("A product with this barcode already exists.");
          setIsSaving(false);
          return;
        }
      }

      // Prepare data for Firestore, using the calculated final MRP
      const productData = {
        name: currentProduct.name.trim(),
        barcode: currentProduct.barcode?.trim() || '',
        mrp: finalMrp, // <-- Use calculated MRP
        gstRate: priceInputType === 'withoutGst' ? gstRateInput : 0, // <-- Save GST rate
        updatedAt: serverTimestamp(),
      };

      if (currentProduct.id) {
        await updateDoc(doc(db, "products", currentProduct.id), productData);
      } else {
        await addDoc(collection(db, "products"), { ...productData, stock: 0, createdAt: serverTimestamp() });
      }
      
      handleClearForm();
      await fetchProducts();

    } catch (err) {
      console.error("Error saving product:", err);
      setFormError("Failed to save product. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDeleteProduct = async (productId: string) => {
    if (window.confirm("Are you sure you want to delete this product from the catalog?")) {
      try {
        await deleteDoc(doc(db, "products", productId));
        if (currentProduct.id === productId) handleClearForm();
        await fetchProducts();
      } catch (err) {
        alert("Failed to delete product.");
      }
    }
  };

  return (
    <div className="bg-slate-900 text-white min-h-screen p-6 font-sans">
      <header className="mb-6 flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold">Product Catalog</h1>
            <p className="text-slate-400">Add, edit, and manage core product details</p>
        </div>
      </header>
      
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
            <div className="bg-slate-800 p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <BookOpen size={22} />
                    {currentProduct.id ? "Edit Product Info" : "Add to Catalog"}
                </h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Product Name</label>
                        <Input name="name" placeholder="e.g., Classic T-Shirt" value={currentProduct.name || ''} onChange={handleInputChange} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Barcode</label>
                        <Input name="barcode" placeholder="Scan or enter barcode" value={currentProduct.barcode || ''} onChange={handleInputChange} />
                    </div>

                    {/* --- NEW Price & GST Section --- */}
                    <div className="border border-slate-700 rounded-lg p-3 space-y-3 bg-slate-900/30">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Price Type</label>
                            <select 
                                value={priceInputType}
                                onChange={(e) => setPriceInputType(e.target.value as 'withGst' | 'withoutGst')}
                                className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-slate-100"
                            >
                                <option value="withGst">Price includes GST (Final MRP)</option>
                                <option value="withoutGst">Price excludes GST</option>
                            </select>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">
                                {priceInputType === 'withGst' ? 'Final MRP' : 'Base Price (before tax)'}
                            </label>
                            <Input name="mrp" type="number" min="0" placeholder="0.00" value={priceInputValue} onChange={(e) => setPriceInputValue(parseFloat(e.target.value) || 0)} />
                        </div>

                        {priceInputType === 'withoutGst' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">GST Rate (%)</label>
                                <Input type="number" min="0" placeholder="e.g., 18" value={gstRateInput} onChange={(e) => setGstRateInput(parseFloat(e.target.value) || 0)} />
                            </div>
                        )}

                        <div className="border-t border-slate-700 pt-3">
                            <label className="block text-sm font-medium text-slate-400 mb-1">Calculated Final MRP</label>
                            <Input value={formatCurrency(finalMrp)} readOnly className="bg-slate-800 font-bold text-green-400" />
                        </div>
                    </div>

                    {formError && <p className="text-red-400 text-sm text-center">{formError}</p>}
                    <Button onClick={handleSaveProduct} className="w-full" disabled={isSaving}>
                        {isSaving ? "Saving..." : "Save Product"}
                    </Button>
                </div>
            </div>
        </div>

        <div className="lg:col-span-2">
            <div className="bg-slate-800 p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-bold mb-4">Product List</h2>
                {isLoading ? <p className="text-center text-slate-400 py-8">Loading products...</p> : (
                    products.length > 0 ? (
                        <div className="overflow-x-auto max-h-[calc(100vh-250px)]">
                            <Table>
                                {/* --- UPDATED Table Header --- */}
                                <TableHeader><tr><TableCell>Name</TableCell><TableCell>Barcode</TableCell><TableCell>GST</TableCell><TableCell>Final MRP</TableCell><TableCell>Actions</TableCell></tr></TableHeader>
                                <tbody>
                                    {products.map(product => (
                                        <TableRow key={product.id} className="hover:bg-slate-700/50">
                                            <TableCell>{product.name}</TableCell>
                                            <TableCell>{product.barcode || 'N/A'}</TableCell>
                                            {/* --- ADDED GST Rate column --- */}
                                            <TableCell>{product.gstRate ? `${product.gstRate}%` : 'Inc.'}</TableCell>
                                            <TableCell className="font-semibold">{formatCurrency(product.mrp)}</TableCell>
                                            <TableCell>
                                                <div className="flex space-x-2">
                                                    <button onClick={() => handleSelectProduct(product)} className="text-blue-400 hover:text-blue-300 p-1" title="Edit"><Edit size={18} /></button>
                                                    <button onClick={() => handleDeleteProduct(product.id)} className="text-red-400 hover:text-red-300 p-1" title="Delete"><Trash2 size={18} /></button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    ) : (
                        <div className="text-center py-10 border-2 border-dashed border-slate-700 rounded-lg">
                            <Frown className="mx-auto h-12 w-12 text-slate-500" />
                            <h3 className="mt-2 text-sm font-medium text-slate-300">No Products Found</h3>
                            <p className="mt-1 text-sm text-slate-500">Get started by adding a new product to the catalog.</p>
                        </div>
                    )
                )}
            </div>
        </div>
      </main>
    </div>
  );
}