// src/components/printing/ThermalLayout.tsx
import React from 'react';
import { Sale } from '../../types/sale';
import { formatCurrency } from '../../utils/formatCurrency';

interface ThermalLayoutProps {
  sale: Sale;
  storeDetails: {
    name: string;
    address: string;
    phone: string;
  };
}

// --- CONFIGURATION FOR CHARACTER-BASED LAYOUT ---
// This is the total number of characters available on a standard 80mm receipt line.
const LINE_CHAR_COUNT = 42;

// Column widths are precisely defined. The sum of widths + spaces between them must be <= LINE_CHAR_COUNT.
// 18 (Name) + 1 + 4 (Qty) + 1 + 8 (Price) + 1 + 8 (Total) = 41 characters. This fits perfectly.
const NAME_WIDTH = 18;
const QTY_WIDTH = 4;
const PRICE_WIDTH = 8;
const TOTAL_WIDTH = 8;

// --- HELPER FUNCTIONS FOR PERFECT STRING PADDING ---

/**
 * Creates a perfectly formatted two-column line with right-aligned values.
 * e.g., "Total         ₹1,000.00"
 */
const formatTotalLine = (label: string, value: string | number): string => {
  const valueStr = String(value);
  const labelStr = String(label);
  const spaces = LINE_CHAR_COUNT - labelStr.length - valueStr.length;
  // Ensures there are always spaces, preventing overflow.
  return labelStr + ' '.repeat(Math.max(1, spaces)) + valueStr;
};

/**
 * Creates a perfectly formatted multi-column data line for a single sale item.
 * Ensures each column aligns perfectly by padding strings to an exact length.
 */
const formatItemLine = (name: string, qty: number, price: number, total: number): string => {
  // Truncate name if too long and pad to ensure consistent length
  const formattedName = name.substring(0, NAME_WIDTH).padEnd(NAME_WIDTH);
  // Pad numbers from the left to right-align them
  const formattedQty = String(qty).padStart(QTY_WIDTH);
  const formattedPrice = formatCurrency(price, { showSymbol: false }).padStart(PRICE_WIDTH);
  const formattedTotal = formatCurrency(total, { showSymbol: false }).padStart(TOTAL_WIDTH);

  // Combine all parts with single spaces as separators
  return `${formattedName} ${formattedQty} ${formattedPrice} ${formattedTotal}`;
};

// Simple component for the top meta-data section. Flexbox is fine here.
const MetaRow = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex justify-between">
    <span>{label}</span>
    <span className="text-right">{value}</span>
  </div>
);

export const ThermalLayout = React.forwardRef<HTMLDivElement, ThermalLayoutProps>(({ sale, storeDetails }, ref) => {
  const soldDate = sale.soldAt.toDate();
  const dashedLine = '-'.repeat(LINE_CHAR_COUNT);

  // --- ACCURATE FINANCIAL CALCULATIONS ---
  const mrpTotal = sale.items.reduce((acc, item) => acc + item.mrp * item.quantity, 0);
  const productSavings = sale.items.reduce((acc, item) => acc + (item.mrp - item.priceAtSale) * item.quantity, 0);
  const additionalDiscount = sale.additionalDiscount?.amount || 0;
  const loyaltyDiscount = sale.loyaltyPointsUsed * 5; // Assuming 1 point = 5 currency
  const totalSaved = productSavings + additionalDiscount + loyaltyDiscount;

  // --- BUILD THE ENTIRE RECEIPT BODY AS A SINGLE STRING ---
  // This is the key to perfect alignment. We construct each line and join with newlines.
  const receiptBodyLines = [];

  // Header Line
  receiptBodyLines.push(
    'Item'.padEnd(NAME_WIDTH) + ' ' +
    'Qty'.padStart(QTY_WIDTH) + ' ' +
    'Price'.padStart(PRICE_WIDTH) + ' ' +
    'Total'.padStart(TOTAL_WIDTH)
  );
  receiptBodyLines.push(dashedLine);

  // Item Lines
  sale.items.forEach(item => {
    receiptBodyLines.push(formatItemLine(
      item.productName,
      item.quantity,
      item.priceAtSale,
      item.priceAtSale * item.quantity
    ));
  });
  receiptBodyLines.push(dashedLine);

  // Totals Section
  receiptBodyLines.push(formatTotalLine('MRP Total', formatCurrency(mrpTotal)));
  if (productSavings > 0) receiptBodyLines.push(formatTotalLine('Item Savings', `- ${formatCurrency(productSavings)}`));
  if (additionalDiscount > 0) receiptBodyLines.push(formatTotalLine('Cart Discount', `- ${formatCurrency(additionalDiscount)}`));
  if (loyaltyDiscount > 0) receiptBodyLines.push(formatTotalLine(`Loyalty (${sale.loyaltyPointsUsed} pts)`, `- ${formatCurrency(loyaltyDiscount)}`));

  // Subtotal before tax
  const subTotalBeforeTax = sale.totalAmount - sale.roundOff - sale.gst;
  receiptBodyLines.push(formatTotalLine('Subtotal', formatCurrency(subTotalBeforeTax)));

  if (sale.gst > 0) receiptBodyLines.push(formatTotalLine('GST', formatCurrency(sale.gst)));
  if (sale.roundOff.toFixed(2) !== '0.00' && sale.roundOff.toFixed(2) !== '-0.00') {
    receiptBodyLines.push(formatTotalLine('Round Off', sale.roundOff.toFixed(2)));
  }
  receiptBodyLines.push(dashedLine);

  // Final Total
  receiptBodyLines.push(formatTotalLine('TOTAL', formatCurrency(sale.totalAmount)));
  receiptBodyLines.push(dashedLine);

  // Payment Section
  receiptBodyLines.push(formatTotalLine('Paid via', sale.paymentMode));
  if (sale.paymentMode === 'Cash') {
    receiptBodyLines.push(formatTotalLine('Received', formatCurrency(sale.amountReceived ?? 0)));
    receiptBodyLines.push(formatTotalLine('Change', formatCurrency(sale.changeGiven ?? 0)));
  }

  // Join all lines into a single string for the <pre> tag
  const receiptContent = receiptBodyLines.join('\n');

  return (
    <div
      ref={ref}
      className="w-[288px] bg-white text-black font-mono p-2 text-xs"
      id="thermal-receipt"
    >
      {/* --- Store Header --- */}
      <div className="text-center mb-2">
        <h1 className="font-bold text-sm uppercase">National Mini Mart</h1>
        <p className="text-[10px]">140/115, Hospital Road</p>
        <p className="text-[10px]">Ooty, 643091</p>
        <p className="text-[10px]">Ph: 0423 2446089</p>
        <p className="text-[10px]">Mob: 9092484510</p>
        <p className="text-[10px]">GST No: 33AUBPM5493L1ZA</p>
      </div>


      {/* --- Bill Meta Info --- */}
      <div className="border-t border-b border-dashed border-black py-1 text-[11px]">
        <MetaRow label="Bill No:" value={sale.billNumber} />
        <MetaRow label="Date:" value={soldDate.toLocaleDateString()} />
        <MetaRow label="Time:" value={soldDate.toLocaleTimeString()} />
        <MetaRow label="Customer:" value={sale.customerName || 'Walk-in'} />
      </div>

      {/* --- Pre-formatted text section for guaranteed alignment --- */}
      <pre className="my-2 whitespace-pre-wrap text-[11px] leading-snug">
        {receiptContent}
      </pre>

      {/* --- "You Saved" Banner --- */}
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