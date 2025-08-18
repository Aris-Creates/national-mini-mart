import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, serverTimestamp, query, where, DocumentData, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase'; // Ensure this path is correct
import { Customer } from '../types/customer'; // Ensure this path is correct

// Assuming your UI components are in this path
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableRow, TableCell } from '../components/ui/Table';

import { Edit, UserPlus, Frown } from 'lucide-react';

// ENHANCEMENT: Type-safe converter from Firestore doc to Customer object
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
  // --- STATE MANAGEMENT ---
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState<Partial<Customer> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // --- FIRESTORE LOGIC ---
  const fetchCustomers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const querySnapshot = await getDocs(collection(db, "customers"));
      // ENHANCEMENT: Use the type-safe converter
      const customersList = querySnapshot.docs.map(docToCustomer);
      setCustomers(customersList);
    } catch (err) {
      console.error("Error fetching customers:", err);
      setError("Failed to load customer data. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSaveCustomer = async () => {
    if (!currentCustomer || !currentCustomer.name || !currentCustomer.phone) {
      setModalError("Customer name and phone number are required.");
      return;
    }

    setIsSaving(true);
    setModalError(null);

    try {
      // Check for unique phone number, but exclude the current customer if editing
      const q = query(collection(db, "customers"), where("phone", "==", currentCustomer.phone));
      const existingSnapshot = await getDocs(q);
      const isDuplicate = !existingSnapshot.empty && existingSnapshot.docs[0].id !== currentCustomer.id;

      if (isDuplicate) {
        setModalError("A customer with this phone number already exists.");
        setIsSaving(false); // FIX: Stop execution and reset saving state
        return;
      }
      
      const customerData: DocumentData = {
        name: currentCustomer.name,
        phone: currentCustomer.phone,
        address: currentCustomer.address || '',
        // FIX: Ensure loyaltyPoints is a number, defaulting to 0
        loyaltyPoints: Number(currentCustomer.loyaltyPoints) || 0,
        updatedAt: serverTimestamp(), // ENHANCEMENT: Always update the 'updatedAt' timestamp
      };

      if (currentCustomer.id) {
        // Update existing customer
        const customerRef = doc(db, "customers", currentCustomer.id);
        await updateDoc(customerRef, customerData);
      } else {
        // Add new customer
        customerData.createdAt = serverTimestamp();
        await addDoc(collection(db, "customers"), customerData);
      }
      
      await fetchCustomers(); // Re-fetch the list to show updated data
      handleCloseModal();

    } catch (err) {
      console.error("Error saving customer:", err);
      setModalError("Failed to save customer. Please try again later.");
    } finally {
      setIsSaving(false);
    }
  };
  
  // --- EVENT HANDLERS ---
  const handleOpenModal = (customer: Customer | null = null) => {
    setModalError(null); // Clear previous errors
    // If no customer, set a clean slate for a new entry
    setCurrentCustomer(customer || { name: '', phone: '', address: '', loyaltyPoints: 0 });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentCustomer(null);
    setModalError(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    // FIX: Handle number inputs correctly by parsing them
    const processedValue = type === 'number' ? parseFloat(value) : value;
    setCurrentCustomer(prev => (prev ? { ...prev, [name]: processedValue } : null));
  };

  // --- RENDER LOGIC ---
  const renderContent = () => {
    if (isLoading) {
      return <p className="text-center text-gray-400">Loading customers...</p>;
    }

    if (error) {
      return <p className="text-center text-red-500">{error}</p>;
    }

    if (customers.length === 0) {
      return (
        <div className="text-center py-10 border-2 border-dashed rounded-lg">
          <Frown className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-300">No Customers Found</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by adding a new customer.</p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <tr>
            <TableCell>Name</TableCell>
            <TableCell>Phone</TableCell>
            <TableCell>Address</TableCell>
            <TableCell>Loyalty Points</TableCell>
            <TableCell>Actions</TableCell>
          </tr>
        </TableHeader>
        <tbody>
          {customers.map(customer => (
            <TableRow key={customer.id}>
              <TableCell>{customer.name}</TableCell>
              <TableCell>{customer.phone}</TableCell>
              <TableCell>{customer.address || 'N/A'}</TableCell>
              <TableCell>{customer.loyaltyPoints}</TableCell>
              <TableCell>
                <button 
                  onClick={() => handleOpenModal(customer)} 
                  className="text-blue-400 hover:text-blue-300 p-1 rounded-md transition-colors"
                  title="Edit Customer"
                >
                  <Edit size={18} />
                </button>
              </TableCell>
            </TableRow>
          ))}
        </tbody>
      </Table>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Customer Management</h1>
        <Button onClick={() => handleOpenModal()} className="flex items-center gap-2">
          <UserPlus size={18} />
          Add Customer
        </Button>
      </div>

      <div className="bg-zinc-300 p-4 shadow-md">
        {renderContent()}
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={currentCustomer?.id ? "Edit Customer" : "Add New Customer"}>
        <div className="space-y-4">
          <Input name="name" placeholder="Full Name" value={currentCustomer?.name || ''} onChange={handleInputChange} />
          <Input name="phone" placeholder="Phone Number" value={currentCustomer?.phone || ''} onChange={handleInputChange} disabled={!!currentCustomer?.id} />
          <Input name="address" placeholder="Address (optional)" value={currentCustomer?.address || ''} onChange={handleInputChange} />
          {/* FIX: Added missing input for loyalty points */}
          <Input 
            name="loyaltyPoints" 
            type="number" // Important for correct input behavior and parsing
            placeholder="Loyalty Points" 
            value={currentCustomer?.loyaltyPoints || 0} 
            onChange={handleInputChange} 
          />
          
          {modalError && <p className="text-red-400 text-sm">{modalError}</p>}

          <div className="flex justify-end pt-2">
            <Button onClick={handleSaveCustomer} className="w-full" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Customer"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}