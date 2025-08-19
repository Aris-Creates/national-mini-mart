// src/pages/ProductsPage.tsx
import { useState, useEffect, ChangeEvent } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where, DocumentData, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { Product } from '../types/product';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { formatCurrency } from '../utils/formatCurrency';
import { Edit, Trash2, BookOpen, Frown } from 'lucide-react';

// --- Helper Types & Functions ---

interface Brand {
  id: string;
  name: string;
}

const docToBrand = (doc: DocumentData): Brand => ({
  id: doc.id,
  name: doc.data().name || '',
});

const docToProduct = (doc: DocumentData): Product => {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name || '',
    costPrice: data.costPrice || 0,
    mrp: data.mrp || 0,
    sellingPrice: data.sellingPrice, // Can be null, so no default
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

const EMPTY_PRODUCT: Partial<Product> = {
  name: '', barcode: '', costPrice: 0, mrp: 0, sellingPrice: 0, stock_quantity: 0,
  min_stock_level: 10, gst_rate: 18, hsn_code: '', brand: ''
};

// --- Reusable FormField Component ---
const FormField = ({ label, id, children }: { label: string, id: string, children: React.ReactNode }) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
);


export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentProduct, setCurrentProduct] = useState<Partial<Product>>(EMPTY_PRODUCT);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchBrands = async () => {
    try {
      const q = query(collection(db, "brands"), orderBy("name"));
      setBrands((await getDocs(q)).docs.map(docToBrand));
    } catch (err) { console.error("Error fetching brands:", err); }
  };

  const fetchProducts = async () => {
    try {
      const q = query(collection(db, "products"), orderBy("name", "asc"));
      setProducts((await getDocs(q)).docs.map(docToProduct));
    } catch (err) { console.error("Error fetching products:", err); }
  };

  useEffect(() => {
    const fetchData = async () => {
        setIsLoading(true);
        await Promise.all([fetchProducts(), fetchBrands()]);
        setIsLoading(false);
    }
    fetchData();
  }, []);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setCurrentProduct(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
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
    if (!currentProduct.name?.trim()) { setFormError("Product name is required."); return; }
    if (!currentProduct.mrp || currentProduct.mrp <= 0) { setFormError("MRP must be greater than zero."); return; }
    if (currentProduct.costPrice! > currentProduct.mrp) { setFormError("Cost Price cannot be greater than MRP."); return; }

    setIsSaving(true);
    setFormError(null);
    const trimmedBrandName = currentProduct.brand?.trim();

    try {
      if (currentProduct.barcode?.trim()) {
        const q = query(collection(db, "products"), where("barcode", "==", currentProduct.barcode.trim()));
        const existing = await getDocs(q);
        if (!existing.empty && existing.docs[0].id !== currentProduct.id) {
          setFormError("A product with this barcode already exists.");
          setIsSaving(false); return;
        }
      }

      // Check for and create new brand if it doesn't exist
      if (trimmedBrandName) {
        const brandExists = brands.some(b => b.name.toLowerCase() === trimmedBrandName.toLowerCase());
        if (!brandExists) {
          await addDoc(collection(db, "brands"), { name: trimmedBrandName, createdAt: serverTimestamp() });
        }
      }

      const productData = {
        name: currentProduct.name.trim(),
        brand: trimmedBrandName || '',
        barcode: currentProduct.barcode?.trim() || '',
        hsn_code: currentProduct.hsn_code?.trim() || '',
        costPrice: Number(currentProduct.costPrice),
        mrp: Number(currentProduct.mrp),
        sellingPrice: (currentProduct.sellingPrice && Number(currentProduct.sellingPrice) > 0) ? Number(currentProduct.sellingPrice) : null,
        stock_quantity: Number(currentProduct.stock_quantity),
        min_stock_level: Number(currentProduct.min_stock_level),
        gst_rate: Number(currentProduct.gst_rate),
        updatedAt: serverTimestamp(),
      };

      if (currentProduct.id) {
        await updateDoc(doc(db, "products", currentProduct.id), productData);
      } else {
        await addDoc(collection(db, "products"), { ...productData, createdAt: serverTimestamp() });
      }

      handleClearForm();
      await Promise.all([fetchProducts(), fetchBrands()]); // Refetch both lists
    } catch (err) {
      console.error("Error saving product:", err);
      setFormError("Failed to save product. Please try again.");
    } finally { setIsSaving(false); }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (window.confirm("Are you sure you want to delete this product? This action cannot be undone.")) {
      try {
        await deleteDoc(doc(db, "products", productId));
        if (currentProduct.id === productId) handleClearForm();
        await fetchProducts();
      } catch (err) { alert("Failed to delete product."); }
    }
  };

  return (
    <div className="bg-white text-black min-h-screen p-6 font-sans">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Product Catalog</h1>
        <p className="text-gray-500">Add, edit, and manage product details and pricing</p>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-gray-50 p-6 border border-gray-200">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-700">
              <BookOpen size={22} />
              {currentProduct.id ? "Edit Product" : "Add New Product"}
            </h2>
            <div className="space-y-4">
              <FormField label="Product Name" id="name">
                  <Input id="name" name="name" placeholder="e.g., Amul Gold Milk" value={currentProduct.name || ''} onChange={handleInputChange} />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Brand" id="brand">
                    <Input id="brand" name="brand" placeholder="e.g., Amul" value={currentProduct.brand || ''} onChange={handleInputChange} list="brands-list" />
                    <datalist id="brands-list">
                        {brands.map(brand => <option key={brand.id} value={brand.name} />)}
                    </datalist>
                </FormField>
                <FormField label="Barcode" id="barcode">
                    <Input id="barcode" name="barcode" placeholder="Scan or enter code" value={currentProduct.barcode || ''} onChange={handleInputChange} />
                </FormField>
              </div>

              <div className="border border-gray-200 p-3 space-y-3 bg-white">
                <h4 className="font-semibold text-gray-700">Pricing & Tax</h4>
                <div className="grid grid-cols-2 gap-4">
                    <FormField label="Cost Price" id="costPrice">
                        <Input id="costPrice" name="costPrice" type="number" min="0" value={currentProduct.costPrice || ''} onChange={handleInputChange} />
                    </FormField>
                    <FormField label="MRP" id="mrp">
                        <Input id="mrp" name="mrp" type="number" min="0" value={currentProduct.mrp || ''} onChange={handleInputChange} />
                    </FormField>
                </div>
                <FormField label="Selling Price (Optional)" id="sellingPrice">
                    <Input id="sellingPrice" name="sellingPrice" type="number" min="0" value={currentProduct.sellingPrice || ''} onChange={handleInputChange} placeholder="Leave empty to use MRP" />
                </FormField>
                 <div className="grid grid-cols-2 gap-4">
                    <FormField label="GST Rate (%)" id="gst_rate">
                        <Input id="gst_rate" name="gst_rate" type="number" min="0" value={currentProduct.gst_rate || ''} onChange={handleInputChange} />
                    </FormField>
                    <FormField label="HSN Code" id="hsn_code">
                        <Input id="hsn_code" name="hsn_code" placeholder="e.g., 0401" value={currentProduct.hsn_code || ''} onChange={handleInputChange} />
                    </FormField>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Initial Stock" id="stock_quantity">
                    <Input id="stock_quantity" name="stock_quantity" type="number" min="0" value={currentProduct.stock_quantity || ''} onChange={handleInputChange} disabled={!!currentProduct.id} />
                </FormField>
                <FormField label="Min. Stock Level" id="min_stock_level">
                    <Input id="min_stock_level" name="min_stock_level" type="number" min="0" value={currentProduct.min_stock_level || ''} onChange={handleInputChange} />
                </FormField>
              </div>

              {formError && <p className="text-red-600 text-sm text-center">{formError}</p>}
              <div className="flex gap-2">
                <Button onClick={handleSaveProduct} variant = "secondary" className="w-full" disabled={isSaving}>{isSaving ? "Saving..." : "Save Product"}</Button>
                <Button onClick={handleClearForm} variant="secondary" className="w-full">Cancel</Button>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-gray-50 p-6 border border-gray-200">
            <h2 className="text-xl font-bold mb-4 text-gray-700">Product List</h2>
            {isLoading ? <p className="text-center text-gray-500 py-8">Loading products...</p> : (
              products.length > 0 ? (
                <div className="overflow-x-auto max-h-[calc(100vh-250px)]">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Cost Price</TableHead>
                      <TableHead>MRP</TableHead>
                      <TableHead>Selling Price</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {products.map(product => (
                        <TableRow key={product.id} className="hover:bg-gray-100">
                          <TableCell className="font-medium">{product.name} <span className="text-gray-500 text-sm">({product.brand})</span></TableCell>
                          <TableCell>{formatCurrency(product.costPrice)}</TableCell>
                          <TableCell>{formatCurrency(product.mrp)}</TableCell>
                          <TableCell className="font-semibold text-blue-600">{product.sellingPrice ? formatCurrency(product.sellingPrice) : '—'}</TableCell>
                          <TableCell className={product.stock_quantity <= product.min_stock_level ? 'text-red-600 font-bold' : ''}>{product.stock_quantity}</TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                                <button onClick={() => handleSelectProduct(product)} className="text-blue-600 hover:text-blue-800 p-1" title="Edit"><Edit size={18} /></button>
                                <button onClick={() => handleDeleteProduct(product.id)} className="text-red-600 hover:text-red-800 p-1" title="Delete"><Trash2 size={18} /></button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-10 border-2 border-dashed border-gray-300">
                  <Frown className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-800">No Products Found</h3>
                  <p className="mt-1 text-sm text-gray-500">Get started by adding a new product.</p>
                </div>
              )
            )}
          </div>
        </div>
      </main>
    </div>
  );
}