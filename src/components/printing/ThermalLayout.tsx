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

const LINE_CHAR_COUNT = 42;
const NAME_WIDTH = 18;
const QTY_WIDTH = 4;
const PRICE_WIDTH = 8;
const TOTAL_WIDTH = 8;

const formatTotalLine = (label: string, value: string | number): string => {
  const valueStr = String(value);
  const labelStr = String(label);
  const spaces = LINE_CHAR_COUNT - labelStr.length - valueStr.length;
  return labelStr + ' '.repeat(Math.max(1, spaces)) + valueStr;
};

const formatItemLine = (name: string, qty: number, price: number, total: number): string => {
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

    const mrpTotal = sale.items.reduce((acc, item) => acc + item.mrp * item.quantity, 0);
    const productSavings = sale.items.reduce(
      (acc, item) => acc + (item.mrp - item.priceAtSale) * item.quantity,
      0
    );
    const additionalDiscount = sale.additionalDiscount?.amount || 0;
    const loyaltyDiscount = sale.loyaltyPointsUsed * 5;
    const totalSaved = productSavings + additionalDiscount + loyaltyDiscount;

    const receiptBodyLines: string[] = [];

    // Header
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

    // Items
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

    // Totals
    receiptBodyLines.push(formatTotalLine('MRP Total', formatCurrency(mrpTotal)));
    if (productSavings > 0)
      receiptBodyLines.push(formatTotalLine('Item Savings', `- ${formatCurrency(productSavings)}`));
    if (additionalDiscount > 0)
      receiptBodyLines.push(formatTotalLine('Cart Discount', `- ${formatCurrency(additionalDiscount)}`));
    if (loyaltyDiscount > 0)
      receiptBodyLines.push(
        formatTotalLine(`Loyalty (${sale.loyaltyPointsUsed} pts)`, `- ${formatCurrency(loyaltyDiscount)}`)
      );

    const subTotalBeforeTax = sale.totalAmount - sale.roundOff - sale.gst;
    receiptBodyLines.push(formatTotalLine('Subtotal', formatCurrency(subTotalBeforeTax)));

    if (sale.gst > 0) receiptBodyLines.push(formatTotalLine('GST', formatCurrency(sale.gst)));
    if (sale.roundOff.toFixed(2) !== '0.00' && sale.roundOff.toFixed(2) !== '-0.00') {
      receiptBodyLines.push(formatTotalLine('Round Off', sale.roundOff.toFixed(2)));
    }

    receiptBodyLines.push(dashedLine);

    // TOTAL line (inside <pre>, bold)
    const totalLine = formatTotalLine('TOTAL', formatCurrency(sale.totalAmount));
    receiptBodyLines.push(totalLine);

    receiptBodyLines.push(dashedLine);

    // Payment
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
          {/* Include full address, mobile and GST number */}
          <p className="text-[10px]">{storeDetails.address}</p>
          <p className="text-[10px]">Ph: {storeDetails.phone}</p>
          <p className="text-[10px]">Mob: {storeDetails.mobile}</p>
          <p className="text-[10px]">GST No: {storeDetails.gst}</p>
        </div>

        {/* Bill Meta Info */}
        <div className="border-t border-b border-dashed border-black py-1 text-[13px]">
          <MetaRow label="Bill No:" value={sale.billNumber} />
          <MetaRow label="Date:" value={soldDate.toLocaleDateString()} />
          <MetaRow label="Time:" value={soldDate.toLocaleTimeString()} />
          <MetaRow label="Customer:" value={sale.customerName || 'Walk-in'} />
        </div>

        {/* Preformatted receipt */}
        <div className="flex justify-center">
          <pre className="my-2 whitespace-pre-wrap text-[11px] leading-snug w-[42ch]">
            {receiptBodyLines.map((line, idx) => {
              // Bold the TOTAL line
              if (line === totalLine) {
                return <span key={idx} className="font-bold">{line}{'\n'}</span>;
              }
              return line + '\n';
            })}
          </pre>
        </div>

        {/* You Saved Banner */}
        {totalSaved > 0 && (
          <div className="text-center font-bold text-sm text-gray-800 p-1 my-1">
            🎉 You Saved {formatCurrency(totalSaved)}! 🎉
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-2 pt-2 border-t border-dashed border-black">
          <p className="font-semibold">Thank you for your visit!</p>
          <p className="text-[12px]">Points Earned: {sale.loyaltyPointsEarned}</p>
          {sale.loyaltyPointsUsed > 0 && <p className="text-[10px]">Points Used: {sale.loyaltyPointsUsed}</p>}
        </div>
      </div>
    );
  }
);
