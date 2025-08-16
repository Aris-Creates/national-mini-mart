import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit, DocumentData, Timestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Product } from '../../types/product';
import { Input } from '../ui/Input';
import { formatCurrency } from '../../utils/formatCurrency';

const docToProduct = (doc: DocumentData): Product => ({
  id: doc.id,
  name: doc.data().name || '',
  barcode: doc.data().barcode || '',
  mrp: doc.data().mrp || 0,
  discountPrice: doc.data().discountPrice, // ADDED: Ensure discount price is fetched
  stock: doc.data().stock || 0,
  createdAt: doc.data().createdAt as Timestamp,
  updatedAt: doc.data().updatedAt as Timestamp,
});

interface ProductSearchProps {
  onAddToCart: (product: Product) => void;
}

export function ProductSearch({ onAddToCart }: ProductSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const searchProducts = async () => {
      if (searchTerm.trim().length < 2) {
        setResults([]);
        return;
      }
      
      setIsLoading(true);
      try {
        const lowercasedTerm = searchTerm.toLowerCase();

        const nameQuery = query(
          collection(db, "products"),
          where('name', '>=', lowercasedTerm),
          where('name', '<=', lowercasedTerm + '\uf8ff'),
          orderBy('name'),
          limit(10)
        );

        const barcodeQuery = query(
          collection(db, "products"),
          where('barcode', '>=', searchTerm),
          where('barcode', '<=', searchTerm + '\uf8ff'),
          orderBy('barcode'),
          limit(10)
        );

        const [nameSnapshot, barcodeSnapshot] = await Promise.all([
          getDocs(nameQuery),
          getDocs(barcodeQuery)
        ]);

        const productsMap = new Map<string, Product>();

        nameSnapshot.docs.forEach(doc => {
            const product = docToProduct(doc);
            productsMap.set(product.id, product);
        });

        barcodeSnapshot.docs.forEach(doc => {
            const product = docToProduct(doc);
            productsMap.set(product.id, product);
        });
        
        setResults(Array.from(productsMap.values()));

      } catch (error) {
        console.error("Error searching products:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    const debounce = setTimeout(() => searchProducts(), 300);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  return (
    <div className="lg:col-span-2 bg-slate-800 p-4 rounded-lg">
      <h2 className="text-xl font-bold mb-4">Products</h2>
      <div className="flex gap-4 mb-4">
        <Input
          className="flex-grow"
          placeholder="Search by name or barcode..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select className="bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-slate-100">
          <option>All Brands</option>
        </select>
      </div>
      <div className="overflow-y-auto max-h-[calc(100vh-250px)] pr-2 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {isLoading && <p className="text-slate-500 col-span-full text-center py-4">Searching...</p>}
        {!isLoading && results.length === 0 && (
          <p className="text-slate-500 col-span-full text-center py-4">
            {searchTerm.length > 1 ? 'No products found' : 'Start typing to search for products.'}
          </p>
        )}
        {results.map(product => (
          <button key={product.id} onClick={() => onAddToCart(product)} disabled={product.stock <= 0}
            className="bg-slate-700 p-3 rounded-md text-left transition-transform hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed flex flex-col justify-between h-28">
            <div>
              <p className="font-semibold text-sm truncate">{product.name}</p>
              {product.discountPrice && product.discountPrice < product.mrp ? (
                 <div>
                    <p className="text-xs text-slate-400 line-through">{formatCurrency(product.mrp)}</p>
                    <p className="text-sm font-bold text-green-400">{formatCurrency(product.discountPrice)}</p>
                 </div>
              ) : (
                <p className="text-sm text-slate-300 font-bold">{formatCurrency(product.mrp)}</p>
              )}
            </div>
            <div>
              <p className={`text-xs font-bold ${product.stock > 10 ? 'text-green-400' : product.stock > 0 ? 'text-orange-400' : 'text-red-400'}`}>
                Stock: {product.stock}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}