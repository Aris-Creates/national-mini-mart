// src/components/pos/SaleEditModal.tsx (Updated)
import { useState, useEffect } from 'react';
import { Sale } from '../../types/sale';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useSaleCalculations } from '../../hooks/useSaleCalculations';
import { formatCurrency } from '../../utils/formatCurrency';
import { Trash2, Save, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '../ui/Table';

interface SaleEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  onSave: (originalSale: Sale, updatedSale: Sale) => Promise<void>;
}

export function SaleEditModal({ isOpen, onClose, sale, onSave }: SaleEditModalProps) {
  const [editableSale, setEditableSale] = useState<Sale | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (sale && isOpen) {
      const saleCopy = JSON.parse(JSON.stringify(sale));
      saleCopy.soldAt = sale.soldAt;
      setEditableSale(saleCopy);
    }
  }, [sale, isOpen]);

  const {
    displaySubtotal,
    additionalDiscountAmount,
    totalAmount,
    subTotalForDb,
    gstForDb,
    roundOffAmount,
  } = useSaleCalculations({
    items: editableSale?.items || [],
    discountType: editableSale?.additionalDiscount?.type || 'fixed',
    discountValue: editableSale?.additionalDiscount?.value || '',
    loyaltyPointsToUse: 0,
    customer: null,
  });

  if (!editableSale) return null;

  const handleFieldChange = (field: keyof Sale, value: any) => {
    setEditableSale(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleDiscountChange = (field: 'type' | 'value', value: any) => {
    const newDiscount = {
      ...(editableSale.additionalDiscount!),
      [field]: field === 'type' ? value : (parseFloat(value) || 0)
    };
    setEditableSale({ ...editableSale, additionalDiscount: newDiscount });
  };

  const handleItemChange = (productId: string, field: 'quantity' | 'mrp', value: number) => {
    const updatedItems = editableSale.items.map(item =>
      item.productId === productId ? { ...item, [field]: value } : item
    ).filter(item => item.quantity > 0);
    handleFieldChange('items', updatedItems);
  };

  const handleSaveChanges = async () => {
    if (!sale) return;
    setIsSaving(true);
    const finalSaleObject: Sale = {
      ...editableSale,
      subTotal: subTotalForDb,
      gst: gstForDb,
      additionalDiscount: {
        ...(editableSale.additionalDiscount!),
        amount: additionalDiscountAmount,
      },
      totalAmount: totalAmount,
      roundOff: roundOffAmount,
      changeGiven: editableSale.paymentMode === 'Cash' ? Math.max(0, Number(editableSale.amountReceived) - totalAmount) : 0,
    };
    try {
      await onSave(sale, finalSaleObject);
    } catch (error) {
      console.error("Save failed, modal received error.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Bill #${sale?.billNumber}`} size="5xl">
      <div className="space-y-6 max-h-[80vh] overflow-y-auto p-4">

        {/* Customer Information */}
        <div className="bg-white p-4 border border-gray-200 rounded-md">
          <h3 className="text-lg font-bold text-gray-700 mb-3">Customer Information</h3>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label htmlFor="customer-name" className="text-sm font-medium text-gray-600">Customer Name</label>
              <Input id="customer-name" value={editableSale.customerName} onChange={(e) => handleFieldChange('customerName', e.target.value)} className="mt-1" />
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-white p-4 border border-gray-200 rounded-md">
          <h3 className="text-lg font-bold text-gray-700 mb-3">Items</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell>Item</TableCell><TableCell>Qty</TableCell><TableCell>Unit Price</TableCell><TableCell>Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {editableSale.items.map(item => (
                  <TableRow key={item.productId}>
                    <TableCell className="font-medium min-w-[200px]">{item.productName}</TableCell>
                    <TableCell><Input type="number" value={item.quantity} onChange={e => handleItemChange(item.productId, 'quantity', parseInt(e.target.value) || 0)} className="w-20 h-9 text-center" /></TableCell>
                    <TableCell><Input type="number" value={item.mrp} onChange={e => handleItemChange(item.productId, 'mrp', parseFloat(e.target.value) || 0)} className="w-24 h-9" /></TableCell>
                    <TableCell><Button variant="secondary" onClick={() => handleItemChange(item.productId, 'quantity', 0)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Payment & Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-4 border border-gray-200 rounded-md space-y-4">
            <h3 className="text-lg font-bold text-gray-700">Payment</h3>
            <div>
              <label className="text-sm font-medium">Payment Method</label>
              <select
                value={editableSale.paymentMode}
                onChange={e => handleFieldChange('paymentMode', e.target.value as Sale['paymentMode'])}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-10 px-3 bg-white"
              >
                <option value="Cash">Cash</option><option value="Card">Card</option><option value="UPI">UPI</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Cash Received</label>
              <Input type="number" value={editableSale.amountReceived} onChange={e => handleFieldChange('amountReceived', Number(e.target.value))} className="mt-1" />
            </div>
          </div>
          <div className="bg-white p-4 border border-gray-200 rounded-md space-y-2">
            <h3 className="text-lg font-bold text-gray-700 mb-3">Summary</h3>
            <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatCurrency(displaySubtotal)}</span></div>
            <div className="flex justify-between items-center text-sm">
              <span>Discount Value</span>
              <Input type="number" value={editableSale.additionalDiscount?.value || ''} onChange={e => handleDiscountChange('value', e.target.value)} className="w-24 h-9" />
            </div>
            <div className="flex justify-between text-sm text-green-600"><span>Discount Applied</span><span>- {formatCurrency(additionalDiscountAmount)}</span></div>
            <div className="flex justify-between text-lg font-bold mt-2 border-t pt-2"><span>New Total</span><span>{formatCurrency(totalAmount)}</span></div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-3 pt-4 border-t mt-4">
          <Button variant="secondary" onClick={onClose} className="bg-black text-white hover:bg-gray-800">Cancel</Button>
          <Button
            onClick={handleSaveChanges}
            disabled={isSaving}
            className="bg-black text-white hover:bg-gray-800"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}