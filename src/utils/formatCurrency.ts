/**
 * A memoized, robust, and flexible currency formatter for INR.
 * It avoids creating a new Intl.NumberFormat instance on every call for better performance.
 */

// Create formatter instances once and reuse them.
const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
});

// A separate formatter for when we only want the number, not the currency symbol.
const numberFormatter = new Intl.NumberFormat('en-IN', {
  style: 'decimal',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats a number as an Indian Rupee (INR) string.
 *
 * @param amount - The number to format. Handles null/undefined gracefully.
 * @param options - Configuration options for formatting.
 * @param options.showSymbol - If true, includes the '₹' currency symbol. Defaults to true.
 * @returns The formatted currency string (e.g., "₹1,250.00" or "1,250.00").
 */
export function formatCurrency(
  amount: number | null | undefined,
  options: { showSymbol?: boolean } = {}
): string {
  const { showSymbol = true } = options;

  // Gracefully handle null, undefined, or non-numeric inputs.
  if (typeof amount !== 'number' || isNaN(amount)) {
    return showSymbol ? currencyFormatter.format(0) : numberFormatter.format(0);
  }

  // Use the appropriate pre-created formatter.
  if (showSymbol) {
    return currencyFormatter.format(amount);
  } else {
    return numberFormatter.format(amount);
  }
}