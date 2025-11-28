import React from 'react';
import { Sale } from '../../types/sale';
import { formatCurrency } from '../../utils/formatCurrency';

interface ThermalLayoutProps {
  sale: Sale;
  storeDetails: {
    name: string;
    address: string;
    phone: string;
    mobile: string;
    gst: string;
  };
}

// Thermal Printer Config (Adjust width if needed, standard is usually 32-42 chars)
const LINE_CHAR_COUNT = 42;
const NAME_WIDTH = 18;
const QTY_WIDTH = 4;
const PRICE_WIDTH = 8;
const TOTAL_WIDTH = 8;

// --- Helper Functions ---

const formatTotalLine = (label: string, value: string | number): string => {
  const valueStr = String(value);
  const labelStr = String(label);
  const spaces = LINE_CHAR_COUNT - labelStr.length - valueStr.length;
  // Ensure at least one space, but don't overflow
  return labelStr + ' '.repeat(Math.max(1, spaces)) + valueStr;
};

const formatItemLine = (name: string, qty: number, price: number, total: number): string => {
  // Truncate name if too long
  const formattedName = name.substring(0, NAME_WIDTH).padEnd(NAME_WIDTH);
  const formattedQty = String(qty).padStart(QTY_WIDTH);
  const formattedPrice = formatCurrency(price, { showSymbol: false }).padStart(PRICE_WIDTH);
  const formattedTotal = formatCurrency(total, { showSymbol: false }).padStart(TOTAL_WIDTH);
  return `${formattedName} ${formattedQty} ${formattedPrice} ${formattedTotal}`;
};

const MetaRow = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex justify-between">
    <span>{label}</span>
    <span className="text-right">{value}</span>
  </div>
);

export const ThermalLayout = React.forwardRef<HTMLDivElement, ThermalLayoutProps>(
  ({ sale, storeDetails }, ref) => {
    const soldDate = sale.soldAt.toDate();
    const dashedLine = '-'.repeat(LINE_CHAR_COUNT);

    // --- Calculations ---
    const mrpTotal = sale.items.reduce((acc, item) => acc + item.mrp * item.quantity, 0);
    const productSavings = sale.items.reduce(
      (acc, item) => acc + (item.mrp - item.priceAtSale) * item.quantity,
      0
    );
    const additionalDiscount = sale.additionalDiscount?.amount || 0;
    const loyaltyDiscount = sale.loyaltyPointsUsed * 1; // Assuming 1 point = 1 unit of currency based on your code (100 pts = 100 Rs discount? adjust if needed, your previous code said -5 but context suggests 1:1)
    
    // NOTE: In your ActiveBillView, you used `loyaltyPointsUsed` directly as currency amount in some places or `* 1`. 
    // If your logic is 1 Point = 1 Rupee, then `sale.loyaltyDiscount` field holds the currency value.
    // I will use `sale.loyaltyDiscount` directly.

    const totalSaved = productSavings + additionalDiscount + (sale.loyaltyDiscount || 0);

    // GST Split
    const cgst = sale.gst / 2;
    const sgst = sale.gst / 2;

    const receiptBodyLines: string[] = [];

    // --- Header ---
    receiptBodyLines.push(
      'Item'.padEnd(NAME_WIDTH) +
        ' ' +
        'Qty'.padStart(QTY_WIDTH) +
        ' ' +
        'Price'.padStart(PRICE_WIDTH) +
        ' ' +
        'Total'.padStart(TOTAL_WIDTH)
    );
    receiptBodyLines.push(dashedLine);

    // --- Items ---
    sale.items.forEach(item => {
      receiptBodyLines.push(
        formatItemLine(
          item.productName,
          item.quantity,
          item.priceAtSale,
          item.priceAtSale * item.quantity
        )
      );
    });

    receiptBodyLines.push(dashedLine);

    // --- Totals ---
    receiptBodyLines.push(formatTotalLine('MRP Total', formatCurrency(mrpTotal)));
    
    if (productSavings > 0)
      receiptBodyLines.push(formatTotalLine('Item Savings', `- ${formatCurrency(productSavings)}`));
    
    if (additionalDiscount > 0)
      receiptBodyLines.push(formatTotalLine('Cart Discount', `- ${formatCurrency(additionalDiscount)}`));
    
    if ((sale.loyaltyDiscount || 0) > 0)
      receiptBodyLines.push(
        formatTotalLine(`Loyalty (${sale.loyaltyPointsUsed} pts)`, `- ${formatCurrency(sale.loyaltyDiscount || 0)}`)
      );

    // Subtotal (Taxable Value + Tax usually, or just Taxable depending on region. Here it is Net - Tax)
    // Based on ActiveBillView: totalAmount = subTotalForDb + gst - discounts.
    // Let's print a "Subtotal" line that represents the value before tax but after discounts for clarity, 
    // or just list Taxable Value. 
    // Standard retail often just shows Net Total, then Tax Breakup below.
    
    const subTotal = sale.subTotal; // This is usually without tax in DB if gstForDb is separate
    // receiptBodyLines.push(formatTotalLine('Subtotal', formatCurrency(subTotal)));

    // --- Tax Breakup ---
    if (sale.gst > 0) {
        // Option A: Single Line
        // receiptBodyLines.push(formatTotalLine('GST (Included)', formatCurrency(sale.gst)));
        
        // Option B: Split (Requested)
        receiptBodyLines.push(formatTotalLine('CGST (2.5%)', formatCurrency(cgst)));
        receiptBodyLines.push(formatTotalLine('SGST (2.5%)', formatCurrency(sgst)));
    }

    if (sale.roundOff !== 0) {
      receiptBodyLines.push(formatTotalLine('Round Off', sale.roundOff.toFixed(2)));
    }

    receiptBodyLines.push(dashedLine);

    // --- GRAND TOTAL ---
    const totalLine = formatTotalLine('TOTAL', formatCurrency(sale.totalAmount));
    receiptBodyLines.push(totalLine);

    receiptBodyLines.push(dashedLine);

    // --- Payment ---
    receiptBodyLines.push(formatTotalLine('Paid via', sale.paymentMode));
    if (sale.paymentMode === 'Cash') {
      receiptBodyLines.push(formatTotalLine('Received', formatCurrency(sale.amountReceived ?? 0)));
      receiptBodyLines.push(formatTotalLine('Change', formatCurrency(sale.changeGiven ?? 0)));
    }

    return (
      <div
        ref={ref}
        className="w-[288px] bg-white text-black font-mono p-2 text-xs"
        id="thermal-receipt"
      >
        {/* Store Header */}
        <div className="text-center mb-2">
          <h1 className="font-bold text-sm uppercase">{storeDetails.name}</h1>
          <p className="text-[10px]">{storeDetails.address}</p>
          <p className="text-[10px]">Ph: {storeDetails.phone}</p>
          <p className="text-[10px]">Mob: {storeDetails.mobile}</p>
          <p className="text-[10px]">GSTIN: {storeDetails.gst}</p>
        </div>

        {/* Bill Meta Info */}
        <div className="border-t border-b border-dashed border-black py-1 text-[13px]">
          <MetaRow label="Bill No:" value={sale.billNumber} />
          <MetaRow label="Date:" value={soldDate.toLocaleDateString()} />
          <MetaRow label="Time:" value={soldDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} />
          <MetaRow label="Customer:" value={sale.customerName || 'Walk-in'} />
        </div>

        {/* Preformatted receipt body */}
        <div className="flex justify-center">
          <pre className="my-2 whitespace-pre-wrap text-[11px] leading-snug w-[42ch] font-mono">
            {receiptBodyLines.map((line, idx) => {
              if (line === totalLine) {
                return <span key={idx} className="font-bold text-[14px]">{line}{'\n'}</span>;
              }
              return line + '\n';
            })}
          </pre>
        </div>

        {/* Savings Banner */}
        {totalSaved > 0 && (
          <div className="text-center font-bold text-sm text-gray-800 p-1 my-1 border border-black rounded">
            You Saved {formatCurrency(totalSaved)}!
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-2 pt-2 border-t border-dashed border-black">
          <p className="font-semibold">Thank you! Visit Again.</p>
          {sale.loyaltyPointsEarned > 0 && <p className="text-[10px] mt-1">Points Earned on this bill: {sale.loyaltyPointsEarned}</p>}
        </div>
      </div>
    );
  }
);