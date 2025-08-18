// src/components/pos/ProductSearchPanel.tsx
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit, DocumentData, Timestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Product } from '../../types/product';
import { Input } from '../ui/Input';
import { formatCurrency } from '../../utils/formatCurrency';
import { Search, Loader2 } from 'lucide-react';

// **FIXED**: The converter now correctly reads the new pricing fields.
const docToProduct = (doc: DocumentData): Product => {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name || '',
    costPrice: data.costPrice || 0,
    mrp: data.mrp || 0,
    sellingPrice: data.sellingPrice, // Can be undefined or null
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

// **NEW**: A helper to determine the actual price the customer pays.
const getEffectivePrice = (product: Product): number => {
    // Use sellingPrice if it's a valid, lower price; otherwise, use MRP.
    return (product.sellingPrice && product.sellingPrice > 0 && product.sellingPrice < product.mrp)
        ? product.sellingPrice
        : product.mrp;
};

interface ProductSearchPanelProps {
  onAddToCart: (product: Product) => void;
}

export function ProductSearchPanel({ onAddToCart }: ProductSearchPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAllProducts = async () => {
      setIsLoading(true);
      try {
        const productsQuery = query(collection(db, "products"), orderBy("name"), limit(100));
        const productsSnapshot = await getDocs(productsQuery);
        setAllProducts(productsSnapshot.docs.map(docToProduct));
      } catch (error) { console.error("Error fetching products:", error); }
      finally { setIsLoading(false); }
    };
    fetchAllProducts();
  }, []);

  useEffect(() => {
    const searchProducts = async () => {
      if (searchTerm.trim().length < 2) { setSearchResults([]); return; }
      setIsSearching(true);
      try {
        const lowercasedTerm = searchTerm.toLowerCase();
        // Note: Firestore search is case-sensitive. This query finds names that start with the term.
        const q = query(
          collection(db, "products"),
          where('name', '>=', lowercasedTerm),
          where('name', '<=', lowercasedTerm + '\uf8ff'),
          orderBy('name'),
          limit(10)
        );
        const snapshot = await getDocs(q);
        setSearchResults(snapshot.docs.map(docToProduct));
      } catch (error) { console.error("Error searching products:", error); }
      finally { setIsSearching(false); }
    };
    const debounce = setTimeout(() => searchProducts(), 300);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const renderProductGrid = (products: Product[]) => (
    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {products.map(product => {
            // **FIXED**: Use the new helper to get the correct price and check for discounts.
            const effectivePrice = getEffectivePrice(product);
            const hasDiscount = effectivePrice < product.mrp;

            return (
                <button key={product.id} onClick={() => onAddToCart(product)} disabled={product.stock_quantity <= 0}
                  className="bg-white border border-gray-300 p-3 text-left transition-colors hover:bg-gray-100 flex flex-col justify-between h-32 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-gray-100">
                  <div>
                    <p className="font-semibold text-sm text-gray-800 line-clamp-2">{product.name}</p>
                    <p className="text-xs text-gray-500">{product.brand}</p>
                  </div>
                  
                  {/* **FIXED**: New rendering logic to show savings */}
                  <div>
                    {hasDiscount && (
                        <p className="text-xs text-gray-400 line-through">{formatCurrency(product.mrp)}</p>
                    )}
                    <p className={`text-base font-bold ${hasDiscount ? 'text-green-600' : 'text-blue-700'}`}>
                        {formatCurrency(effectivePrice)}
                    </p>
                  </div>
                  
                  <p className={`text-xs font-bold ${product.stock_quantity > product.min_stock_level ? 'text-green-600' : product.stock_quantity > 0 ? 'text-orange-500' : 'text-red-600'}`}>
                      Stock: {product.stock_quantity}
                  </p>
                </button>
            )
        })}
    </div>
  );

  return (
    <div className="bg-gray-100 border border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <Input className="pl-10 text-base" placeholder="Search products by name or scan barcode..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>
      <div className="flex-grow overflow-y-auto p-4">
        {searchTerm.length < 2 ? (
          <div>
            <h3 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider">Browse Products</h3>
            {isLoading ? ( <div className="flex justify-center items-center h-48"><Loader2 className="animate-spin text-gray-400" size={32}/></div> )
             : allProducts.length > 0 ? ( renderProductGrid(allProducts) )
             : ( <p className="text-gray-500 text-center py-4">No products found in your inventory.</p> )}
          </div>
        ) : (
          <div>
            <h3 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider">Search Results</h3>
            {isSearching && <p className="text-gray-500 text-center py-4">Searching...</p>}
            {!isSearching && searchResults.length === 0 && ( <p className="text-gray-500 text-center py-4">No products found for "{searchTerm}".</p> )}
            {renderProductGrid(searchResults)}
          </div>
        )}
      </div>
    </div>
  );
}