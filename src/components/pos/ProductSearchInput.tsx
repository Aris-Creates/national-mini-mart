import { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { query, collection, where, orderBy, limit, getDocs, DocumentData, Timestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Product } from '../../types/product';
import { formatCurrency } from '../../utils/formatCurrency';

// Converter
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

interface Props {
    onSelect: (p: Product) => void;
    onArrowDownFromEmpty: () => void;
}

export interface ProductSearchInputHandle {
    focus: () => void;
}

export const ProductSearchInput = forwardRef<ProductSearchInputHandle, Props>(({ onSelect, onArrowDownFromEmpty }, ref) => {
    const [term, setTerm] = useState('');
    const [results, setResults] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [showDropdown, setShowDropdown] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
        focus: () => {
            inputRef.current?.focus();
        }
    }));

    // Search Logic
    useEffect(() => {
        const search = async () => {
            if (term.length < 2) { setResults([]); setShowDropdown(false); return; }
            setLoading(true);
            try {
                // Parallel search: Name, Barcode, ProductCode
                const [ByName, ByCode, ByProductCode] = await Promise.all([
                    getDocs(query(collection(db, "products"), where('name', '>=', term), where('name', '<=', term + '\uf8ff'), orderBy('name'), limit(10))),
                    getDocs(query(collection(db, "products"), where('barcode', '>=', term), where('barcode', '<=', term + '\uf8ff'), orderBy('barcode'), limit(5))),
                    getDocs(query(collection(db, "products"), where('productCode', '>=', term), where('productCode', '<=', term + '\uf8ff'), orderBy('productCode'), limit(5)))
                ]);

                const combined = new Map<string, Product>();
                // Prioritize Exact Codes
                ByProductCode.docs.forEach(d => combined.set(d.id, docToProduct(d)));
                ByCode.docs.forEach(d => combined.set(d.id, docToProduct(d)));
                ByName.docs.forEach(d => combined.set(d.id, docToProduct(d)));

                const list = Array.from(combined.values());
                setResults(list);
                setShowDropdown(list.length > 0);
                setSelectedIndex(0);

                // Auto-Add Exact Barcode
                const exactMatch = list.find(p => p.barcode === term || p.productCode === term);
                if (exactMatch) {
                    onSelect(exactMatch);
                    setTerm('');
                    setShowDropdown(false);
                }
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        const timeout = setTimeout(search, 300);
        return () => clearTimeout(timeout);
    }, [term]);

    const handleInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (results.length > 0 && showDropdown) {
                setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
            } else if (term === '') {
                onArrowDownFromEmpty();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (showDropdown) setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (showDropdown && results[selectedIndex]) {
                onSelect(results[selectedIndex]);
                setTerm('');
                setShowDropdown(false);
            }
        } else if (e.key === 'Escape') {
            setShowDropdown(false);
            setTerm('');
        }
    };

    return (
        <div className="relative w-full">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                    ref={inputRef}
                    type="text"
                    value={term}
                    onChange={e => setTerm(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    placeholder="Search Product, Code, or Scan (F2)"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-blue-100 focus:border-blue-500 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none transition-all shadow-sm font-medium"
                    autoFocus
                />
                {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-500" size={18} />}
            </div>

            {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-96 overflow-y-auto z-50">
                    {results.map((product, index) => {
                        const price = (product.sellingPrice && product.sellingPrice > 0 && product.sellingPrice < product.mrp) ? product.sellingPrice : product.mrp;
                        return (
                            <div
                                key={product.id}
                                onClick={() => { onSelect(product); setTerm(''); setShowDropdown(false); }}
                                className={`p-3 cursor-pointer flex justify-between items-center border-b border-gray-50 last:border-0 ${index === selectedIndex ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50'}`}
                            >
                                <div>
                                    <div className="font-bold text-gray-800">{product.name}</div>
                                    <div className="text-xs text-gray-500">
                                        {product.productCode ? <span className="text-blue-600 font-medium mr-1">{product.productCode}</span> : ''}
                                        {product.brand} | Stock: {product.stock_quantity}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-blue-600">{formatCurrency(price)}</div>
                                    {product.unit_type === 'weight' && <div className="text-[10px] text-gray-400 bg-gray-100 px-1 rounded inline-block">per {product.unit_value}kg</div>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
});