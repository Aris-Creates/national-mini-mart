// src/components/pos/ProductSearchPanel.tsx
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit, DocumentData, Timestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Product } from '../../types/product';
import { Input } from '../ui/Input';
import { formatCurrency } from '../../utils/formatCurrency';
import { Search, Loader2 } from 'lucide-react';

const docToProduct = (doc: DocumentData): Product => ({
  id: doc.id,
  name: doc.data().name || '',
  barcode: doc.data().barcode || '',
  mrp: doc.data().mrp || 0,
  discountPrice: doc.data().discountPrice,
  stock: doc.data().stock || 0,
  gstRate: doc.data().gstRate, // <-- Fetch gstRate
  createdAt: doc.data().createdAt as Timestamp,
  updatedAt: doc.data().updatedAt as Timestamp,
});

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
      } catch (error) {
        console.error("Error fetching all products:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllProducts();
  }, []);

  useEffect(() => {
    const searchProducts = async () => {
      if (searchTerm.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const lowercasedTerm = searchTerm.toLowerCase();
        const q = query(
          collection(db, "products"),
          where('name', '>=', lowercasedTerm),
          where('name', '<=', lowercasedTerm + '\uf8ff'),
          orderBy('name'),
          limit(10)
        );
        const snapshot = await getDocs(q);
        setSearchResults(snapshot.docs.map(docToProduct));
      } catch (error) {
        console.error("Error searching products:", error);
      } finally {
        setIsSearching(false);
      }
    };
    const debounce = setTimeout(() => searchProducts(), 300);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const renderProductGrid = (products: Product[]) => (
    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {products.map(product => (
            <button key={product.id} onClick={() => onAddToCart(product)} disabled={product.stock <= 0}
              className="bg-slate-700 p-3 rounded-md text-left transition-colors hover:bg-slate-600/80 flex flex-col justify-between h-28 disabled:opacity-40 disabled:cursor-not-allowed">
              <div>
                <p className="font-semibold text-sm line-clamp-2">{product.name}</p>
                {product.discountPrice && product.discountPrice < product.mrp ? (
                    <>
                      <p className="text-xs text-slate-400 line-through">{formatCurrency(product.mrp)}</p>
                      <p className="text-base font-bold text-green-400">{formatCurrency(product.discountPrice)}</p>
                    </>
                ) : ( <p className="text-base font-bold text-slate-200">{formatCurrency(product.mrp)}</p> )}
              </div>
              <p className={`text-xs font-bold ${product.stock > 10 ? 'text-green-500' : product.stock > 0 ? 'text-orange-400' : 'text-red-500'}`}>Stock: {product.stock}</p>
            </button>
        ))}
    </div>
  );

  return (
    <div className="bg-slate-800/50 rounded-lg flex flex-col h-full">
      <div className="p-4 border-b border-slate-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <Input className="pl-10 text-base" placeholder="Search products by name or scan barcode..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>
      <div className="flex-grow overflow-y-auto p-4">
        {searchTerm.length < 2 ? (
          <div>
            <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Browse Products</h3>
            {isLoading ? ( <div className="flex justify-center items-center h-48"><Loader2 className="animate-spin text-slate-500" size={32}/></div> )
             : allProducts.length > 0 ? ( renderProductGrid(allProducts) )
             : ( <p className="text-slate-500 text-center py-4">No products found in your inventory.</p> )}
          </div>
        ) : (
          <div>
            <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Search Results</h3>
            {isSearching && <p className="text-slate-500 text-center py-4">Searching...</p>}
            {!isSearching && searchResults.length === 0 && ( <p className="text-slate-500 text-center py-4">No products found for "{searchTerm}".</p> )}
            {renderProductGrid(searchResults)}
          </div>
        )}
      </div>
    </div>
  );
}