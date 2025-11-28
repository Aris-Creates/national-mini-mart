import { useState, useEffect } from 'react';
import { User, UserPlus, X } from 'lucide-react';
import { query, collection, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Customer } from '../../types/customer';

// Helper
const docToCustomer = (doc: any): Customer => ({ id: doc.id, ...doc.data() });

interface Props {
    selectedCustomer: Customer | null;
    walkInName: string;
    onSelect: (c: Customer | null) => void;
    onWalkInChange: (name: string) => void;
}

export function CustomerSelect({ selectedCustomer, walkInName, onSelect, onWalkInChange }: Props) {
    const [term, setTerm] = useState('');
    const [results, setResults] = useState<Customer[]>([]);
    
    useEffect(() => {
        if (term.length < 3) { setResults([]); return; }
        const fetch = async () => {
            const q = query(collection(db, "customers"), where('phone', '>=', term), where('phone', '<=', term + '\uf8ff'), limit(5));
            const snap = await getDocs(q);
            setResults(snap.docs.map(docToCustomer));
        };
        const t = setTimeout(fetch, 300);
        return () => clearTimeout(t);
    }, [term]);

    if (selectedCustomer) {
        return (
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded px-3 py-2">
                <div>
                    <div className="text-sm font-bold text-blue-800">{selectedCustomer.name}</div>
                    <div className="text-xs text-blue-600">{selectedCustomer.phone} | Pts: {selectedCustomer.loyaltyPoints}</div>
                </div>
                <button onClick={() => onSelect(null)} className="text-blue-400 hover:text-blue-600"><X size={16} /></button>
            </div>
        );
    }

    return (
        <div className="relative">
             <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                    type="text"
                    value={walkInName || term}
                    onChange={(e) => {
                        const val = e.target.value;
                        setTerm(val);
                        onWalkInChange(val); // Default to Walk-in name until selected
                    }}
                    placeholder="Customer Phone or Name"
                    className="w-full pl-9 pr-3 py-2.5 bg-gray-100 border border-gray-200 rounded text-sm focus:outline-none focus:bg-white focus:border-blue-400"
                />
            </div>
            {results.length > 0 && (
                <div className="absolute top-full left-0 w-full bg-white border shadow-lg z-50 mt-1 max-h-48 overflow-y-auto">
                    {results.map(c => (
                        <div 
                            key={c.id} 
                            onClick={() => { onSelect(c); setTerm(''); setResults([]); }}
                            className="p-2 hover:bg-gray-100 cursor-pointer text-sm"
                        >
                            <span className="font-bold">{c.name}</span> <span className="text-gray-500">({c.phone})</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}