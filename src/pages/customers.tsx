import { useState, useEffect, useMemo, ChangeEvent } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where, DocumentData, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { Customer } from '../types/customer';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { 
  UserPlus, 
  Search, 
  Trash2, 
  Edit2, 
  Crown, 
  Phone, 
  Copy, 
  MapPin, 
  Users, 
  Trophy,
  Frown,
  Check
} from 'lucide-react';

// --- Type-Safe Converter ---
const docToCustomer = (doc: DocumentData): Customer => {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name || '',
    phone: data.phone || '',
    address: data.address || '',
    loyaltyPoints: data.loyaltyPoints || 0,
    createdAt: data.createdAt as Timestamp,
    updatedAt: data.updatedAt as Timestamp,
  };
};

export default function CustomersPage() {
  // --- STATE ---
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState<Partial<Customer> | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // UI Feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // --- FIRESTORE LOGIC ---
  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "customers"), orderBy("updatedAt", "desc"));
      const querySnapshot = await getDocs(q);
      const customersList = querySnapshot.docs.map(docToCustomer);
      setCustomers(customersList);
    } catch (err) {
      console.error("Error fetching customers:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // --- COMPUTED DATA ---
  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return customers;
    const lowerTerm = searchTerm.toLowerCase();
    return customers.filter(c => 
      c.name.toLowerCase().includes(lowerTerm) || 
      c.phone.includes(lowerTerm)
    );
  }, [customers, searchTerm]);

  const stats = useMemo(() => {
    const total = customers.length;
    const vips = customers.filter(c => c.loyaltyPoints >= 100).length;
    return { total, vips };
  }, [customers]);

  // --- HANDLERS ---
  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
    setCurrentCustomer(prev => prev ? { ...prev, phone: value } : null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    const processedValue = type === 'number' ? parseFloat(value) : value;
    setCurrentCustomer(prev => (prev ? { ...prev, [name]: processedValue } : null));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id: string) => {
    if(!window.confirm("Are you sure you want to delete this customer? This cannot be undone.")) return;
    
    try {
      await deleteDoc(doc(db, "customers", id));
      setCustomers(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error("Error deleting", err);
      alert("Failed to delete customer.");
    }
  };

  const handleSaveCustomer = async () => {
    if (!currentCustomer?.name || !currentCustomer?.phone) {
      setFormError("Name and Phone are required.");
      return;
    }
    if (currentCustomer.phone.length < 10) {
        setFormError("Phone number must be 10 digits.");
        return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      // Unique phone check (skip if editing same user)
      const q = query(collection(db, "customers"), where("phone", "==", currentCustomer.phone));
      const existingSnapshot = await getDocs(q);
      const isDuplicate = !existingSnapshot.empty && existingSnapshot.docs[0].id !== currentCustomer.id;

      if (isDuplicate) {
        setFormError("Customer with this phone already exists.");
        setIsSaving(false);
        return;
      }

      const customerData: DocumentData = {
        name: currentCustomer.name,
        phone: currentCustomer.phone,
        address: currentCustomer.address || '',
        loyaltyPoints: Number(currentCustomer.loyaltyPoints) || 0,
        updatedAt: serverTimestamp(),
      };

      if (currentCustomer.id) {
        await updateDoc(doc(db, "customers", currentCustomer.id), customerData);
      } else {
        customerData.createdAt = serverTimestamp();
        await addDoc(collection(db, "customers"), customerData);
      }

      await fetchCustomers();
      handleCloseModal();

    } catch (err) {
      console.error("Error saving:", err);
      setFormError("Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenModal = (customer: Customer | null = null) => {
    setFormError(null);
    setCurrentCustomer(customer || { name: '', phone: '', address: '', loyaltyPoints: 0 });
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentCustomer(null);
  };

  return (
    <div className="bg-slate-50 min-h-screen p-6 font-sans text-slate-900">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* --- HEADER & STATS --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
                <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Customer Directory</h1>
                <p className="text-slate-500 mt-1">Manage client details, track loyalty points, and view history.</p>
            </div>
            
            <div className="flex gap-4 md:justify-end">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex-1 text-center">
                    <div className="text-slate-400 mb-1 flex justify-center"><Users size={16}/></div>
                    <div className="text-xl font-bold text-slate-800">{stats.total}</div>
                    <div className="text-xs text-slate-500">Total Clients</div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex-1 text-center">
                    <div className="text-amber-500 mb-1 flex justify-center"><Crown size={16}/></div>
                    <div className="text-xl font-bold text-slate-800">{stats.vips}</div>
                    <div className="text-xs text-slate-500">VIP Members</div>
                </div>
            </div>
        </div>

        {/* --- MAIN CONTENT CARD --- */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            
            {/* Toolbar */}
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
                <div className="relative w-full sm:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <Input 
                        placeholder="Search by name or phone..." 
                        className="pl-10 h-10 border-slate-200 focus:ring-indigo-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button onClick={() => handleOpenModal()} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center justify-center gap-2 h-10">
                    <UserPlus size={18} /> Add Customer
                </Button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                {isLoading ? (
                     <div className="p-12 text-center text-slate-400">Loading customers...</div>
                ) : filteredCustomers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="bg-slate-50 p-4 rounded-full mb-3">
                            <Frown className="h-8 w-8 text-slate-300" />
                        </div>
                        <h3 className="text-slate-900 font-medium">No customers found</h3>
                        <p className="text-slate-500 text-sm mt-1">Try adjusting your search or add a new one.</p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/50 border-b-slate-100">
                                <TableHead className="pl-6 text-slate-500 font-semibold text-sm">Customer Name</TableHead>
                                <TableHead className="text-slate-500 font-semibold text-sm">Phone</TableHead>
                                <TableHead className="text-slate-500 font-semibold text-sm">Location</TableHead>
                                <TableHead className="text-center text-slate-500 font-semibold text-sm">Loyalty</TableHead>
                                <TableHead className="text-right pr-6 text-slate-500 font-semibold text-sm">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredCustomers.map(customer => {
                                const isVip = (customer.loyaltyPoints || 0) >= 100;
                                return (
                                    <TableRow key={customer.id} className="hover:bg-slate-50 border-b-slate-50 transition-colors">
                                        
                                        <TableCell className="pl-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${isVip ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                                    {customer.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-700">{customer.name}</p>
                                                    {isVip && <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1"><Crown size={10}/> VIP Member</span>}
                                                </div>
                                            </div>
                                        </TableCell>

                                        <TableCell>
                                            <div className="flex items-center gap-2 text-slate-600">
                                                <Phone size={14} className="text-slate-300"/>
                                                <span className="font-mono text-sm">{customer.phone}</span>
                                                <button onClick={() => copyToClipboard(customer.phone, customer.id)} className="text-slate-300 hover:text-indigo-500 transition-colors">
                                                    {copiedId === customer.id ? <Check size={14} className="text-green-500"/> : <Copy size={14}/>}
                                                </button>
                                            </div>
                                        </TableCell>

                                        <TableCell>
                                            <div className="flex items-center gap-2 text-slate-500 text-sm max-w-[150px] truncate">
                                                {customer.address ? (
                                                    <><MapPin size={14} className="text-slate-300 flex-shrink-0" /> {customer.address}</>
                                                ) : (
                                                    <span className="text-slate-300 italic text-xs pl-6">No address</span>
                                                )}
                                            </div>
                                        </TableCell>

                                        <TableCell className="text-center">
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200">
                                                <Trophy size={12} className={isVip ? "text-amber-500 fill-amber-500" : "text-slate-400"} />
                                                {customer.loyaltyPoints}
                                            </div>
                                        </TableCell>

                                        {/* Actions: Replaced Custom Button with Native HTML Button for Visibility */}
                                        <TableCell className="text-right pr-6">
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    onClick={() => handleOpenModal(customer)} 
                                                    className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors bg-white shadow-sm"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={15} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(customer.id)}
                                                    className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors bg-white shadow-sm"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                )}
            </div>
        </div>

        {/* --- MODAL --- */}
        <Modal 
            isOpen={isModalOpen} 
            onClose={handleCloseModal} 
            title={currentCustomer?.id ? "Edit Customer Details" : "Register New Customer"}
        >
          <div className="space-y-5 py-2">
            <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Full Name</label>
                <Input 
                    name="name" 
                    placeholder="e.g. John Doe" 
                    value={currentCustomer?.name || ''} 
                    onChange={handleInputChange}
                    autoFocus 
                />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Phone Number</label>
                    <Input
                        name="phone"
                        type="tel"
                        placeholder="10 digits"
                        value={currentCustomer?.phone || ''}
                        onChange={handlePhoneChange}
                        maxLength={10}
                        disabled={!!currentCustomer?.id}
                        className={!!currentCustomer?.id ? "bg-slate-50 text-slate-500" : ""}
                    />
                </div>
                 <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Loyalty Points</label>
                    <Input
                        name="loyaltyPoints"
                        type="number"
                        placeholder="0"
                        value={currentCustomer?.loyaltyPoints || 0}
                        onChange={handleInputChange}
                    />
                </div>
            </div>

            <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Address</label>
                <Input 
                    name="address" 
                    placeholder="House No, Street, City" 
                    value={currentCustomer?.address || ''} 
                    onChange={handleInputChange} 
                />
            </div>

            {formError && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md flex items-center gap-2">
                    <span className="font-bold">Error:</span> {formError}
                </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
                <Button variant="secondary" onClick={handleCloseModal} disabled={isSaving}>Cancel</Button>
                <Button onClick={handleSaveCustomer} className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[100px]" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save"}
                </Button>
            </div>
          </div>
        </Modal>

      </div>
    </div>
  );
}