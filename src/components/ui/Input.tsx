// src/components/ui/Input.tsx
import React from 'react';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((
  { className, ...props }, 
  ref
) => {
  return (
    <input
      className={`w-full bg-white border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 ${className}`}
      ref={ref}
      {...props}
    />
  );
});