// src/components/ui/Table.tsx
import React from 'react';

// The main table container, handles responsive overflow.
export function Table({ children, className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto border border-gray-200 bg-white">
      <table className={`w-full text-left text-sm ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
}

// The table header section (<thead>).
export function TableHeader({ children, className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={`bg-gray-50 ${className}`} {...props}>
      {children}
    </thead>
  );
}

// The table body section (<tbody>).
export function TableBody({ children, className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={`bg-white divide-y divide-gray-200 ${className}`} {...props}>
      {children}
    </tbody>
  );
}

// A table row (<tr>). Styling is neutral to work in both header and body.
export function TableRow({ children, className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
    return (
      <tr className={`transition-colors hover:bg-gray-50 ${className}`} {...props}>
        {children}
      </tr>
    );
}

// A table header cell (<th>). Semantically correct for headers.
export function TableHead({ children, className, ...props }: React.HTMLAttributes<HTMLTableCellElement>) {
    return (
      <th scope="col" className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${className}`} {...props}>
        {children}
      </th>
    );
}

// A standard table cell (<td>) for the body.
export function TableCell({ children, className, ...props }: React.HTMLAttributes<HTMLTableCellElement>) {
    return (
      <td className={`px-6 py-4 whitespace-nowrap text-gray-800 ${className}`} {...props}>
        {children}
      </td>
    );
}