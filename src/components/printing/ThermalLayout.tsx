import React from 'react';
import { Sale } from '../../types/sale';
import { formatCurrency } from '../../utils/formatCurrency';

interface ThermalLayoutProps {
  sale: Sale;
  storeDetails: {
    name: string;
    address: string;
    phone: string;
    logoUrl?: string; // Optional: Add a URL for your store's logo
  };
}

// A simple key-value row component for cleaner code
const DetailRow = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex justify-between">
    <span>{label}:</span>
    <span>{value}</span>
  </div>
);

// Styled with Tailwind CSS for a standard 3-inch (approx. 72-80mm) thermal printer.
// The width w-[288px] (3 inches * 96 DPI) is a good approximation for screen rendering.
export const ThermalLayout = React.forwardRef<HTMLDivElement, ThermalLayoutProps>(({ sale, storeDetails }, ref) => {
  // Handles both Firebase Timestamps and standard JS Date objects
  const soldDate = sale.soldAt instanceof Date ? sale.soldAt : sale.soldAt.toDate();

  return (
    <div
      ref={ref}
      className="w-[288px] bg-white text-black font-mono p-2 text-xs"
      // This ID can be useful for styling specifically for printing
      id="thermal-receipt"
    >
      {/* --- Store Header --- */}
      <div className="text-center mb-2">
        {storeDetails.logoUrl && (
          <img src={storeDetails.logoUrl} alt={`${storeDetails.name} Logo`} className="w-20 h-auto mx-auto mb-1" />
        )}
        <h1 className="font-bold text-sm uppercase">{storeDetails.name}</h1>
        <p className="text-[10px]">{storeDetails.address}</p>
        <p className="text-[10px]">Ph: {storeDetails.phone}</p>
      </div>

      {/* --- Bill Meta Info --- */}
      <div className="border-t border-b border-dashed border-black py-1">
        <DetailRow label="Bill No" value={sale.billNumber} />
        <DetailRow label="Date" value={soldDate.toLocaleDateString()} />
        <DetailRow label="Time" value={soldDate.toLocaleTimeString()} />
        <DetailRow label="Customer" value={sale.customerName || 'Walk-in Customer'} />
      </div>

      {/* --- Items Table --- */}
      <table className="w-full my-2">
        <thead>
          <tr className="border-b border-dashed border-black">
            <th className="text-left font-semibold">Item</th>
            <th className="text-center font-semibold">Qty</th>
            <th className="text-right font-semibold">Price</th>
            <th className="text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item) => (
            <tr key={item.productId}>
              <td className="text-left py-1 break-words w-1/2">{item.productName}</td>
              <td className="text-center py-1">{item.quantity}</td>
              <td className="text-right py-1">{formatCurrency(item.priceAtSale, { showSymbol: false })}</td>
              <td className="text-right py-1">{formatCurrency(item.priceAtSale * item.quantity, { showSymbol: false })}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* --- Totals Section --- */}
      <div className="border-t-2 border-dashed border-black pt-1">
        <DetailRow label="Subtotal" value={formatCurrency(sale.subTotal)} />
        <DetailRow label="Discount" value={`- ${formatCurrency(sale.discount)}`} />
        <div className="flex justify-between font-bold text-sm my-1">
          <span>TOTAL:</span>
          <span>{formatCurrency(sale.totalAmount)}</span>
        </div>
      </div>

      {/* --- Payment Details --- */}
      <div className="border-t border-dashed border-black pt-1 mt-1">
        <DetailRow label="Paid via" value={sale.paymentMode} />
        {sale.paymentMode === 'Cash' && (
          <>
            <DetailRow label="Received" value={formatCurrency(sale.amountReceived ?? 0)} />
            <DetailRow label="Change" value={formatCurrency(sale.changeGiven ?? 0)} />
          </>
        )}
      </div>

      {/* --- Footer --- */}
      <div className="text-center mt-3 pt-2 border-t border-dashed border-black">
        <p className="font-semibold">Thank you for your visit!</p>
        <p className="text-[10px]">Points Earned: {sale.loyaltyPointsEarned}</p>

        {/* Placeholder for a QR code */}
        <div className="w-24 h-24 mx-auto my-2 border border-black flex items-center justify-center">
          <img
            src="https://imgs.search.brave.com/vbl1WQGOv-HSfPWUZEm78FjsNDnerWP9hsynL0TV4BM/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9xcmNv/ZGVzdW5saW1pdGVk/LmNvbS9xci9hc3Nl/dHMvc3R5bGVfMi1i/NWE2NmUwNzNkYWEw/ZDI4YWQwNzc2OTM3/NTgyZGQzOGE1NjQ3/ZGZkZjFjNDMwNzg4/Zjk0MjQwYzdhMjE1/YzMwLndlYnA"
            alt="QR Code"
            className="w-full h-full object-contain"
          />
        </div>



        {/* Placeholder for a barcode */}
        <div className="text-center text-[10px]">
          <p>*{sale.billNumber}*</p>
        </div>
      </div>
    </div>
  );
});