import React from 'react';
import { Sale } from '../../types/sale';
import { formatCurrency } from '../../utils/formatCurrency';

interface ThermalLayoutProps {
  sale: Sale & { roundOff?: number };
  storeDetails: {
    name: string;
    address: string;
    phone: string;
    logoUrl?: string;
  };
}

const LOYALTY_POINT_VALUE = 5;

// --- CONFIGURATION FOR CHARACTER-BASED LAYOUT ---
const LINE_CHAR_COUNT = 42;

// **FIX:** Adjusted column widths to prevent line wrapping.
// The sum of widths + spaces (18 + 4 + 8 + 8 + 3 spaces = 41) is now less than LINE_CHAR_COUNT.
const NAME_WIDTH = 12;
const QTY_WIDTH = 4;
const PRICE_WIDTH = 8;
const TOTAL_WIDTH = 8;

// --- HELPER FUNCTIONS FOR MANUAL STRING PADDING ---

/**
 * Creates a perfectly formatted two-column line for totals and payments.
 */
const formatTotalLine = (label: string, value: string | number): string => {
  const valueStr = String(value);
  const labelStr = String(label);
  const spaces = LINE_CHAR_COUNT - labelStr.length - valueStr.length;
  return labelStr + ' '.repeat(Math.max(0, spaces)) + valueStr;
};

/**
 * Creates a perfectly formatted multi-column data line for a single sale item.
 */
const formatItemLine = (name: string, qty: number, price: number, total: number): string => {
  const formattedName = name.substring(0, NAME_WIDTH).padEnd(NAME_WIDTH);
  const formattedQty = String(qty).padStart(QTY_WIDTH);
  const formattedPrice = formatCurrency(price, { showSymbol: false }).padStart(PRICE_WIDTH);
  const formattedTotal = formatCurrency(total, { showSymbol: false }).padStart(TOTAL_WIDTH);
  
  return `${formattedName} ${formattedQty} ${formattedPrice} ${formattedTotal}`;
};

// This is a simple row for the top meta-data section only.
const MetaRow = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex justify-between">
    <span>{label}</span>
    <span>{value}</span>
  </div>
);

// The Final, Corrected Component
export const ThermalLayout = React.forwardRef<HTMLDivElement, ThermalLayoutProps>(({ sale, storeDetails }, ref) => {
  const soldDate = sale.soldAt instanceof Date ? sale.soldAt : sale.soldAt.toDate();

  const mrpTotal = sale.subTotal + sale.discount;
  const loyaltyDiscount = sale.loyaltyPointsUsed * LOYALTY_POINT_VALUE;
  const totalSaved = sale.discount + loyaltyDiscount;
  const dashedLine = '-'.repeat(LINE_CHAR_COUNT);

  // Create the header line as a separate, correctly formatted string.
  const headerLine = 
    'Item'.padEnd(NAME_WIDTH) + ' ' + 
    'Qty'.padStart(QTY_WIDTH) + ' ' + 
    'Price'.padStart(PRICE_WIDTH) + ' ' + 
    'Total'.padStart(TOTAL_WIDTH);

  return (
    <div
      ref={ref}
      className="w-[288px] bg-white text-black font-mono p-2 text-xs"
      id="thermal-receipt"
    >
      {/* --- Store Header --- */}
      <div className="text-center mb-2">
        <h1 className="font-bold text-sm uppercase">{storeDetails.name}</h1>
        <p className="text-[10px]">{storeDetails.address}</p>
        <p className="text-[10px]">Ph: {storeDetails.phone}</p>
      </div>

      {/* --- Bill Meta Info --- */}
      <div className="border-t border-b border-dashed border-black py-1">
        <MetaRow label="Bill No:" value={sale.billNumber} />
        <MetaRow label="Date:" value={soldDate.toLocaleDateString()} />
        <MetaRow label="Time:" value={soldDate.toLocaleTimeString()} />
        <MetaRow label="Customer:" value={sale.customerName || 'Walk-in Customer'} />
      </div>

      {/* --- Pre-formatted text section for guaranteed alignment --- */}
      <pre className="my-2 whitespace-pre-wrap">
        {/* --- Header --- */}
        {headerLine}
        {'\n'}
        {dashedLine}
        {'\n'}
        
        {/* --- Items --- */}
        {sale.items.map(item =>
          formatItemLine(
            item.productName,
            item.quantity,
            item.priceAtSale,
            item.priceAtSale * item.quantity
          )
        ).join('\n')}
        {'\n'}
        {dashedLine}
        {'\n'}

        {/* --- Totals --- */}
        {formatTotalLine('MRP Total', formatCurrency(mrpTotal))}
        {'\n'}
        {sale.discount > 0 && formatTotalLine('Product Discount', `- ${formatCurrency(sale.discount)}`) + '\n'}
        {formatTotalLine('Subtotal', formatCurrency(sale.subTotal))}
        {'\n'}
        {typeof sale.gst !== 'undefined' && formatTotalLine('GST', formatCurrency(sale.gst)) + '\n'}
        {loyaltyDiscount > 0 && formatTotalLine(`Loyalty (${sale.loyaltyPointsUsed} pts)`, `- ${formatCurrency(loyaltyDiscount)}`) + '\n'}
        {typeof sale.roundOff !== 'undefined' && sale.roundOff.toFixed(2) !== '0.00' && sale.roundOff.toFixed(2) !== '-0.00' && formatTotalLine('Round Off', sale.roundOff.toFixed(2)) + '\n'}
        {dashedLine}
        {'\n'}
        {formatTotalLine('TOTAL', formatCurrency(sale.totalAmount))}
        {'\n'}
        {dashedLine}
        {'\n'}

        {/* --- Payment --- */}
        {formatTotalLine('Paid via', sale.paymentMode)}
        {'\n'}
        {sale.paymentMode === 'Cash' && (
          formatTotalLine('Received', formatCurrency(sale.amountReceived ?? 0)) + '\n' +
          formatTotalLine('Change', formatCurrency(sale.changeGiven ?? 0)) + '\n'
        )}
      </pre>

      {/* --- "You Saved" Banner (optional) --- */}
      {totalSaved > 0 && (
        <div className="text-center font-bold text-xs bg-black text-white p-1 my-1">
          🎉 You Saved {formatCurrency(totalSaved)}! 🎉
        </div>
      )}

      {/* --- Footer --- */}
      <div className="text-center mt-2 pt-2 border-t border-dashed border-black">
        <p className="font-semibold">Thank you for your visit!</p>
        <p className="text-[10px]">Points Earned: {sale.loyaltyPointsEarned}</p>
        {sale.loyaltyPointsUsed > 0 && <p className="text-[10px]">Points Used: {sale.loyaltyPointsUsed}</p>}
      </div>
    </div>
  );
});