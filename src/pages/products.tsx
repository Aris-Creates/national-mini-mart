import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where, DocumentData, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { Product } from '../types/product';

// --- UI Components & Utils ---
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableRow, TableCell } from '../components/ui/Table';
import { formatCurrency } from '../utils/formatCurrency';

// --- Icons ---
import { Edit, Trash2, Plus, Frown, BookOpen } from 'lucide-react';

// --- Type-Safe Converter ---
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

const EMPTY_PRODUCT: Partial<Product> = { name: '', barcode: '', mrp: 0 };

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentProduct, setCurrentProduct] = useState<Partial<Product>>(EMPTY_PRODUCT);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
    const { name, value, type } = e.target;
    const processedValue = type === 'number' ? parseFloat(value) || 0 : value;
    setCurrentProduct(prev => ({ ...prev, [name]: processedValue }));
  };
  
  const handleSelectProduct = (product: Product) => {
    setCurrentProduct(product);
    setFormError(null);
  };
  
  const handleClearForm = () => {
    setCurrentProduct(EMPTY_PRODUCT);
    setFormError(null);
  };

  const handleSaveProduct = async () => {
    if (!currentProduct) return;
    if (!currentProduct.name?.trim()) {
      setFormError("Product name is required.");
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      if (currentProduct.barcode?.trim()) {
        const q = query(collection(db, "products"), where("barcode", "==", currentProduct.barcode.trim()));
        const existing = await getDocs(q);
        if (!existing.empty && existing.docs[0].id !== currentProduct.id) {
          setFormError("A product with this barcode already exists.");
          setIsSaving(false);
          return;
        }
      }

      const productData = {
        name: currentProduct.name.trim(),
        barcode: currentProduct.barcode?.trim() || '',
        mrp: Number(currentProduct.mrp) || 0,
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
        <Button onClick={handleClearForm} className="flex items-center gap-2">
            <Plus size={18} /> New Product
        </Button>
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
                        <Input name="barcode" placeholder="Scan or enter barcode" value={currentProduct.barcode || ''} onChange={handleInputChange} required/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">MRP</label>
                        <Input name="mrp" type="number" placeholder="0.00" value={currentProduct.mrp ?? ''} onChange={handleInputChange} />
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
                                <TableHeader><tr><TableCell>Name</TableCell><TableCell>Barcode</TableCell><TableCell>MRP</TableCell><TableCell>Actions</TableCell></tr></TableHeader>
                                <tbody>
                                    {products.map(product => (
                                        <TableRow key={product.id} className="hover:bg-slate-700/50">
                                            <TableCell>{product.name}</TableCell>
                                            <TableCell>{product.barcode || 'N/A'}</TableCell>
                                            <TableCell>{formatCurrency(product.mrp)}</TableCell>
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