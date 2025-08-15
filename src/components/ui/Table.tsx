import React from 'react';

export function Table({ children, className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto bg-surface rounded-lg border border-border">
      <table className={`w-full text-left ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children, className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={`bg-secondary text-text-primary uppercase text-sm ${className}`} {...props}>
      {children}
    </thead>
  );
}

export function TableRow({ children, className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
    return <tr className={`border-b border-border last:border-0 hover:bg-secondary/50 ${className}`} {...props}>{children}</tr>;
}

export function TableCell({ children, className, ...props }: React.HTMLAttributes<HTMLTableCellElement>) {
    return <td className={`px-6 py-4 ${className}`} {...props}>{children}</td>;
}