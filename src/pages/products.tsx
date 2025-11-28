import { useState, useEffect, ChangeEvent, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where, DocumentData, Timestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { Product } from '../types/product';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { formatCurrency } from '../utils/formatCurrency';
import { Edit, Trash2, Plus, ArrowLeft, Save, Search, Frown, Gift, Tag, DollarSign, Archive, X, AlertCircle } from 'lucide-react';

// --- Converters ---
interface Category { id: string; name: string; }
interface Brand { id: string; name: string; }
const docToBrand = (doc: DocumentData): Brand => ({ id: doc.id, name: doc.data().name || '' });
const docToCategory = (doc: DocumentData): Category => ({ id: doc.id, name: doc.data().name || '' });

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

        // Free Item
        hasFreeItem: data.hasFreeItem ?? false,
        freeProductId: data.freeProductId || '',
        freeProductName: data.freeProductName || '',
        freeItemQuantity: data.freeItemQuantity || 1,

        productCode: data.productCode || '',
        hsn_code: data.hsn_code || '',
        barcode: data.barcode || '',
        createdAt: data.createdAt as Timestamp,
        updatedAt: data.updatedAt as Timestamp,
    };
};

const EMPTY_PRODUCT: Partial<Product> = {
    name: '', barcode: '', productCode: '', category: '', sub_category: '', brand: '',
    costPrice: 0, mrp: 0, sellingPrice: 0,
    stock_quantity: 0, min_stock_level: 5,
    gst_rate: 18, is_gst_inclusive: true, hsn_code: '',
    unit_type: 'piece', unit_value: 1,
    hasFreeItem: false, freeProductId: '', freeProductName: '', freeItemQuantity: 1
};

const GST_RATES = [0, 5, 12, 18, 28];

const FormField = ({ label, id, children }: { label: string, id: string, children: React.ReactNode }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        {children}
    </div>
);

export default function ProductsPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState<'form' | 'list'>('list');

    const [products, setProducts] = useState<Product[]>([]);
    const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentProduct, setCurrentProduct] = useState<Partial<Product>>(EMPTY_PRODUCT);
    const [isSaving, setIsSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [listSearchTerm, setListSearchTerm] = useState('');

    // Free Item Search State
    const [freeItemSearchTerm, setFreeItemSearchTerm] = useState('');
    const [freeItemResults, setFreeItemResults] = useState<Product[]>([]);

    const nameInputRef = useRef<HTMLInputElement>(null);

    // --- Fetch Data ---
    const fetchAuxData = async () => {
        try {
            const bQ = query(collection(db, "brands"), orderBy("name"));
            const cQ = query(collection(db, "categories"), orderBy("name"));
            const [bSnap, cSnap] = await Promise.all([getDocs(bQ), getDocs(cQ)]);
            setBrands(bSnap.docs.map(docToBrand));
            setCategories(cSnap.docs.map(docToCategory));
        } catch (err) { console.error("Error fetching aux data:", err); }
    };

    const fetchProducts = async () => {
        try {
            const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
            const docs = (await getDocs(q)).docs.map(docToProduct);
            setProducts(docs);
            setFilteredProducts(docs);
        } catch (err) { console.error("Error fetching products:", err); }
    };

    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            await Promise.all([fetchProducts(), fetchAuxData()]);
            setIsLoading(false);
        }
        init();
    }, []);

    // --- Router Logic ---
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const mode = params.get('mode');
        if (mode === 'add') {
            setViewMode('form');
            handleClearForm();
            setTimeout(() => nameInputRef.current?.focus(), 100);
        } else {
            setViewMode('list');
        }
    }, [location]);

    // --- Free Item Search Logic ---
    useEffect(() => {
        if (freeItemSearchTerm.length < 2) { setFreeItemResults([]); return; }
        const timer = setTimeout(async () => {
            const q = query(collection(db, "products"), where('name', '>=', freeItemSearchTerm), where('name', '<=', freeItemSearchTerm + '\uf8ff'), limit(5));
            const snap = await getDocs(q);
            setFreeItemResults(snap.docs.map(docToProduct));
        }, 300);
        return () => clearTimeout(timer);
    }, [freeItemSearchTerm]);

    // --- Search Logic List ---
    useEffect(() => {
        if (!listSearchTerm.trim()) {
            setFilteredProducts(products);
        } else {
            const lowerTerm = listSearchTerm.toLowerCase();
            setFilteredProducts(products.filter(p =>
                p.name.toLowerCase().includes(lowerTerm) ||
                p.barcode?.toLowerCase().includes(lowerTerm) ||
                p.productCode?.toLowerCase().includes(lowerTerm) ||
                p.brand.toLowerCase().includes(lowerTerm)
            ));
        }
    }, [listSearchTerm, products]);

    // --- Handlers ---
    const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setCurrentProduct(prev => ({ ...prev, [name]: checked }));
            return;
        }
        if (type === 'number') {
            setCurrentProduct(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
            return;
        }
        setCurrentProduct(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectFreeItem = (p: Product) => {
        setCurrentProduct(prev => ({
            ...prev,
            freeProductId: p.id,
            freeProductName: p.name,
        }));
        setFreeItemSearchTerm('');
        setFreeItemResults([]);
    };

    const handleEditClick = (product: Product) => {
        setCurrentProduct(product);
        setFormError(null);
        setViewMode('form');
    };

    const handleClearForm = () => {
        setCurrentProduct(EMPTY_PRODUCT);
        setFormError(null);
    };

    const handleGoBackToList = () => {
        handleClearForm();
        setViewMode('list');
        navigate('/products?mode=edit');
    };

    const handleSaveProduct = async () => {
        // 1. Basic Validation
        if (!currentProduct.category?.trim()) { setFormError("Category is required."); return; }
        if (!currentProduct.brand?.trim()) { setFormError("Brand is required."); return; }
        if (!currentProduct.name?.trim()) { setFormError("Product name is required."); return; }
        if (!currentProduct.mrp || currentProduct.mrp <= 0) { setFormError("MRP must be greater than zero."); return; }

        // Free Item Validation
        if (currentProduct.hasFreeItem) {
            if (!currentProduct.freeProductId) { setFormError("Please select a product from inventory to be free."); return; }
            if (!currentProduct.freeItemQuantity || currentProduct.freeItemQuantity <= 0) { setFormError("Free Item Quantity must be greater than 0."); return; }
        }

        setIsSaving(true);
        setFormError(null);

        const trimmedBrand = currentProduct.brand?.trim() || '';
        const trimmedCategory = currentProduct.category?.trim() || '';

        try {
            // 2. Uniqueness Checks (Barcode & ProductCode)

            // A. Check Barcode
            if (currentProduct.barcode?.trim()) {
                const qBarcode = query(collection(db, "products"), where("barcode", "==", currentProduct.barcode.trim()));
                const existingBarcode = await getDocs(qBarcode);
                if (!existingBarcode.empty && existingBarcode.docs[0].id !== currentProduct.id) {
                    setFormError("Barcode already exists. Please use a unique barcode.");
                    setIsSaving(false); return;
                }
            }

            // B. Check Product Code (New Feature)
            if (currentProduct.productCode?.trim()) {
                const qCode = query(collection(db, "products"), where("productCode", "==", currentProduct.productCode.trim()));
                const existingCode = await getDocs(qCode);

                // If we found a product with this code, and it's NOT the one we are currently editing
                if (!existingCode.empty && existingCode.docs[0].id !== currentProduct.id) {
                    setFormError(`Product Code "${currentProduct.productCode}" is already used by another product.`);
                    setIsSaving(false); return;
                }
            }

            // 3. Save Aux Data (Brand/Category)
            if (trimmedBrand && !brands.some(b => b.name.toLowerCase() === trimmedBrand.toLowerCase())) {
                await addDoc(collection(db, "brands"), { name: trimmedBrand, createdAt: serverTimestamp() });
            }
            if (trimmedCategory && !categories.some(c => c.name.toLowerCase() === trimmedCategory.toLowerCase())) {
                await addDoc(collection(db, "categories"), { name: trimmedCategory, createdAt: serverTimestamp() });
            }

            // 4. Prepare Payload
            const productData = {
                name: currentProduct.name?.trim(),
                category: trimmedCategory,
                sub_category: currentProduct.sub_category?.trim() || '',
                brand: trimmedBrand,
                barcode: currentProduct.barcode?.trim() || '',
                productCode: currentProduct.productCode?.trim() || '',
                hsn_code: currentProduct.hsn_code?.trim() || '',

                costPrice: Number(currentProduct.costPrice),
                mrp: Number(currentProduct.mrp),
                sellingPrice: (currentProduct.sellingPrice && Number(currentProduct.sellingPrice) > 0) ? Number(currentProduct.sellingPrice) : null,
                gst_rate: Number(currentProduct.gst_rate),
                is_gst_inclusive: Boolean(currentProduct.is_gst_inclusive),

                unit_type: currentProduct.unit_type,
                unit_value: Number(currentProduct.unit_value),

                stock_quantity: Number(currentProduct.stock_quantity),
                min_stock_level: Number(currentProduct.min_stock_level),

                // Save Free Item Details (Reference ID)
                hasFreeItem: Boolean(currentProduct.hasFreeItem),
                freeProductId: currentProduct.hasFreeItem ? currentProduct.freeProductId : '',
                freeProductName: currentProduct.hasFreeItem ? currentProduct.freeProductName : '',
                freeItemQuantity: currentProduct.hasFreeItem ? Number(currentProduct.freeItemQuantity) : 1,

                updatedAt: serverTimestamp(),
            };

            // 5. Commit to Firestore
            if (currentProduct.id) {
                await updateDoc(doc(db, "products", currentProduct.id), productData);
            } else {
                await addDoc(collection(db, "products"), { ...productData, createdAt: serverTimestamp() });
            }

            handleClearForm();
            await Promise.all([fetchProducts(), fetchAuxData()]);

            if (currentProduct.id) {
                handleGoBackToList();
            } else {
                nameInputRef.current?.focus();
            }

        } catch (err) {
            console.error("Error saving:", err);
            setFormError("Failed to save. Check console.");
        } finally { setIsSaving(false); }
    };

    const handleDeleteProduct = async (id: string) => {
        if (window.confirm("Delete this product permanently?")) {
            try {
                await deleteDoc(doc(db, "products", id));
                await fetchProducts();
            } catch (err) { alert("Failed to delete."); }
        }
    };

    const getCalculatedCosts = () => {
        const rate = currentProduct.gst_rate || 0;
        const price = currentProduct.costPrice || 0;
        if (currentProduct.is_gst_inclusive) {
            const base = price / (1 + rate / 100);
            const tax = price - base;
            return { base, tax, total: price };
        } else {
            const tax = price * (rate / 100);
            return { base: price, tax, total: price + tax };
        }
    };
    const costs = getCalculatedCosts();
    const getUnitDisplay = (p: Partial<Product>) => p.unit_type === 'weight' ? `${p.unit_value} kg` : `${p.unit_value} pc(s)`;

    // =========================================================================
    // VIEW: FORM
    // =========================================================================
    if (viewMode === 'form') {
        return (
            <div className="max-w-5xl mx-auto space-y-6 pb-20">
                <header className="flex justify-between items-center bg-white p-4 rounded shadow-sm border border-gray-200">
                    <div className="flex items-center gap-3">
                        <button onClick={handleGoBackToList} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><ArrowLeft size={20} /></button>
                        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            {currentProduct.id ? <Edit size={20} /> : <Plus size={20} />}
                            {currentProduct.id ? "Edit Product" : "Add New Product"}
                        </h1>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={handleClearForm}>Reset</Button>
                        <Button onClick={handleSaveProduct} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white flex gap-2">
                            <Save size={18} /> {isSaving ? "Saving..." : "Save Product"}
                        </Button>
                    </div>
                </header>

                {formError && (
                    <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-md flex items-center gap-2 font-medium">
                        <AlertCircle size={20} />
                        {formError}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-6">

                    {/* --- BOX 1: Identification --- */}
                    <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2"><Tag size={18} /> Product Identification</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <FormField label="Category" id="category">
                                <Input id="category" name="category" placeholder="e.g. Grocery" value={currentProduct.category || ''} onChange={handleInputChange} list="categories-list" />
                                <datalist id="categories-list">{categories.map(c => <option key={c.id} value={c.name} />)}</datalist>
                            </FormField>
                            <FormField label="Brand" id="brand">
                                <Input id="brand" name="brand" placeholder="e.g. Tata" value={currentProduct.brand || ''} onChange={handleInputChange} list="brands-list" />
                                <datalist id="brands-list">{brands.map(b => <option key={b.id} value={b.name} />)}</datalist>
                            </FormField>
                            <FormField label="Product Code" id="productCode">
                                <Input id="productCode" name="productCode" placeholder="e.g. PC-101" value={currentProduct.productCode || ''} onChange={handleInputChange} />
                            </FormField>
                            <div className="md:col-span-2">
                                <FormField label="Product Name" id="name">
                                    <Input ref={nameInputRef} id="name" name="name" placeholder="e.g. Sampann Toor Dal" value={currentProduct.name || ''} onChange={handleInputChange} />
                                </FormField>
                            </div>
                            <FormField label="Sub Category" id="sub_category">
                                <Input id="sub_category" name="sub_category" placeholder="e.g. Pulses" value={currentProduct.sub_category || ''} onChange={handleInputChange} />
                            </FormField>
                        </div>
                    </div>

                    {/* --- BOX 2: Unit, Pricing & Free Item --- */}
                    <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2"><DollarSign size={18} /> Unit & Pricing</h3>

                        <div className="bg-blue-50/50 p-4 rounded-md border border-blue-100 mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField label="Unit Type" id="unit_type">
                                <select name="unit_type" value={currentProduct.unit_type} onChange={handleInputChange} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="piece">Pieces (Packet/Item)</option>
                                    <option value="weight">Weight (Kg)</option>
                                </select>
                            </FormField>
                            <FormField label={currentProduct.unit_type === 'weight' ? "Weight (in Kg)" : "Quantity (Count)"} id="unit_value">
                                <Input id="unit_value" name="unit_value" type="number" step={currentProduct.unit_type === 'weight' ? "0.001" : "1"} value={currentProduct.unit_value || ''} onChange={handleInputChange} />
                            </FormField>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                            <div className="flex flex-col gap-1">
                                <FormField label="Cost Price" id="costPrice">
                                    <Input id="costPrice" name="costPrice" type="number" min="0" value={currentProduct.costPrice || ''} onChange={handleInputChange} />
                                </FormField>
                                <label className="flex items-center gap-2 text-xs text-gray-600 mt-1 cursor-pointer">
                                    <input type="checkbox" name="is_gst_inclusive" checked={currentProduct.is_gst_inclusive} onChange={handleInputChange} className="rounded text-blue-600" /> GST Included
                                </label>
                            </div>
                            <FormField label="GST Rate (%)" id="gst_rate">
                                <select name="gst_rate" value={currentProduct.gst_rate} onChange={handleInputChange} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                                </select>
                            </FormField>
                            <div className="bg-gray-100 p-3 rounded text-sm flex flex-col justify-center border border-gray-200">
                                <div className="flex justify-between"><span className="text-gray-500">Total Cost:</span> <span className="font-bold">{formatCurrency(costs.total)}</span></div>
                            </div>
                            <FormField label="MRP" id="mrp">
                                <Input id="mrp" name="mrp" type="number" min="0" value={currentProduct.mrp || ''} onChange={handleInputChange} />
                            </FormField>
                            <FormField label="Selling Price" id="sellingPrice">
                                <Input id="sellingPrice" name="sellingPrice" type="number" min="0" value={currentProduct.sellingPrice || ''} onChange={handleInputChange} placeholder="Leave empty for MRP" />
                            </FormField>
                        </div>

                        {/* Free Item Logic - LINKED TO INVENTORY */}
                        <div className="border-t pt-4">
                            <label className="inline-flex items-center gap-2 cursor-pointer mb-4">
                                <input type="checkbox" name="hasFreeItem" checked={currentProduct.hasFreeItem || false} onChange={handleInputChange} className="rounded w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
                                <span className="font-semibold text-gray-700 flex items-center gap-2"><Gift size={16} className="text-purple-600" /> This product has a Free Item?</span>
                            </label>

                            {currentProduct.hasFreeItem && (
                                <div className="bg-purple-50 p-4 rounded border border-purple-100 animate-in fade-in slide-in-from-top-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* SEARCH FOR FREE ITEM */}
                                        <div className="relative">
                                            <label className="block text-sm font-medium text-purple-900 mb-1">Search & Select Free Product</label>
                                            {currentProduct.freeProductId ? (
                                                <div className="flex items-center justify-between bg-white border border-purple-200 p-2 rounded">
                                                    <span className="text-sm font-bold text-purple-700 truncate">{currentProduct.freeProductName}</span>
                                                    <button onClick={() => setCurrentProduct(prev => ({ ...prev, freeProductId: '', freeProductName: '' }))} className="text-red-500 p-1"><X size={16} /></button>
                                                </div>
                                            ) : (
                                                <>
                                                    <Input
                                                        placeholder="Type product name..."
                                                        value={freeItemSearchTerm}
                                                        onChange={(e) => setFreeItemSearchTerm(e.target.value)}
                                                        className="border-purple-200 focus:border-purple-500 focus:ring-purple-500"
                                                    />
                                                    {freeItemResults.length > 0 && (
                                                        <div className="absolute top-full left-0 w-full bg-white border border-gray-200 shadow-lg mt-1 z-10 max-h-40 overflow-y-auto">
                                                            {freeItemResults.map(p => (
                                                                <div key={p.id} onClick={() => handleSelectFreeItem(p)} className="p-2 hover:bg-purple-50 cursor-pointer text-sm">
                                                                    <div className="font-medium">{p.name}</div>
                                                                    <div className="text-xs text-gray-500">MRP: {p.mrp}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                        <FormField label="Quantity Given" id="freeItemQuantity">
                                            <Input id="freeItemQuantity" name="freeItemQuantity" type="number" min="1" value={currentProduct.freeItemQuantity || ''} onChange={handleInputChange} className="border-purple-200" />
                                        </FormField>
                                    </div>
                                    <p className="text-xs text-purple-600 mt-2">* This product will be added to the bill automatically at 0 price.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* --- BOX 3: Inventory & Meta --- */}
                    <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2"><Archive size={18} /> Inventory & Meta</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField label="Current Stock" id="stock_quantity">
                                <Input id="stock_quantity" name="stock_quantity" type="number" value={currentProduct.stock_quantity || ''} onChange={handleInputChange} />
                            </FormField>
                            <FormField label="Min Stock Level" id="min_stock_level">
                                <Input id="min_stock_level" name="min_stock_level" type="number" value={currentProduct.min_stock_level || ''} onChange={handleInputChange} />
                            </FormField>
                            <FormField label="HSN Code" id="hsn_code">
                                <Input id="hsn_code" name="hsn_code" placeholder="e.g. 0401" value={currentProduct.hsn_code || ''} onChange={handleInputChange} />
                            </FormField>
                            <FormField label="Barcode" id="barcode">
                                <Input id="barcode" name="barcode" placeholder="Scan or enter code" value={currentProduct.barcode || ''} onChange={handleInputChange} />
                            </FormField>
                        </div>
                    </div>

                </div>
            </div>
        );
    }

    // =========================================================================
    // VIEW: LIST
    // =========================================================================
    return (
        <div className="bg-white p-6 border border-gray-200 rounded shadow-sm h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Product List</h1>
                    <p className="text-gray-500 text-sm">Manage existing inventory</p>
                </div>

                <div className="flex gap-4">
                    <div className="relative w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <Input
                            placeholder="Search product, code, barcode..."
                            className="pl-10"
                            value={listSearchTerm}
                            onChange={(e) => setListSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <Button
                        onClick={() => navigate('/products?mode=add')}
                        className="bg-blue-600 text-white flex items-center justify-center"
                    >
                        <Plus size={18} className="mr-2" />
                        Add New
                    </Button>

                </div>
            </div>

            {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-gray-500">Loading inventory...</p>
                </div>
            ) : (
                filteredProducts.length > 0 ? (
                    <div className="flex-1 overflow-auto border border-gray-100 rounded">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50">
                                    <TableHead>Product</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Cost</TableHead>
                                    <TableHead>MRP / Sell</TableHead>
                                    <TableHead>Stock</TableHead>
                                    <TableHead>Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredProducts.map(p => {
                                    let displayCost = p.costPrice;
                                    if (!p.is_gst_inclusive) { displayCost = p.costPrice * (1 + p.gst_rate / 100); }
                                    return (
                                        <TableRow key={p.id} className="hover:bg-gray-50">
                                            <TableCell>
                                                <div className="font-bold text-gray-800">{p.name}</div>
                                                <div className="text-xs text-gray-500">{p.brand}</div>
                                                <div className="flex gap-2 text-[10px] text-gray-400">
                                                    {p.productCode && <span className="text-blue-600 font-medium">{p.productCode}</span>}
                                                    {p.hasFreeItem && <span className="text-purple-600 flex items-center gap-0.5 bg-purple-50 px-1 rounded"><Gift size={10} /> +{p.freeProductName}</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell>{p.category}</TableCell>
                                            <TableCell>
                                                <div className="text-sm">{formatCurrency(displayCost)}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="line-through text-gray-400 text-xs">{formatCurrency(p.mrp)}</div>
                                                <div className="font-bold text-blue-600">{formatCurrency(p.sellingPrice || p.mrp)}</div>
                                            </TableCell>
                                            <TableCell>
                                                <span className={p.stock_quantity <= p.min_stock_level ? 'text-red-600 font-bold' : ''}>
                                                    {p.stock_quantity}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleEditClick(p)} className="text-blue-600 hover:bg-blue-100 p-2 rounded transition-colors" title="Edit"><Edit size={18} /></button>
                                                    <button onClick={() => handleDeleteProduct(p.id)} className="text-red-600 hover:bg-red-100 p-2 rounded transition-colors" title="Delete"><Trash2 size={18} /></button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded">
                        <Frown className="h-12 w-12 text-gray-300 mb-2" />
                        <h3 className="text-gray-800 font-medium">No Products Found</h3>
                    </div>
                )
            )}
        </div>
    );
}