// src/components/ui/Select.tsx
import React, { createContext, useContext, useState, useMemo, useRef, useEffect } from 'react';
import {
  useFloating,
  useClick,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
  offset,
  flip,
  shift,
} from '@floating-ui/react';
import { Check, ChevronDown } from 'lucide-react';

// --- 1. Define Context ---
interface SelectContextProps {
  isOpen: boolean;
  toggleOpen: () => void;
  selectedValue: string | null;
  setSelectedValue: (value: string) => void;
  getLabelForValue: (value: string) => React.ReactNode;
  registerOption: (value: string, label: React.ReactNode) => void;
  refs: ReturnType<typeof useFloating>['refs'];
  floatingStyles: React.CSSProperties;
  getFloatingProps: (props?: React.HTMLProps<HTMLElement> | undefined) => Record<string, unknown>;
  getReferenceProps: (props?: React.HTMLProps<HTMLElement> | undefined) => Record<string, unknown>;
}

const SelectContext = createContext<SelectContextProps | null>(null);

const useSelectContext = () => {
  const context = useContext(SelectContext);
  if (!context) {
    throw new Error('Select components must be used within a <Select> provider');
  }
  return context;
};

// --- 2. Main Select Wrapper Component ---
interface SelectProps {
  children: React.ReactNode;
  value: string | null;
  onValueChange: (value: string) => void;
}

export const Select = ({ children, value, onValueChange }: SelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const optionsMapRef = useRef<Map<string, React.ReactNode>>(new Map());

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: 'bottom-start',
    middleware: [offset(5), flip(), shift({ padding: 5 })],
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'listbox' });
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role]);

  const toggleOpen = () => setIsOpen(prev => !prev);

  const registerOption = (value: string, label: React.ReactNode) => {
    optionsMapRef.current.set(value, label);
  };
  
  const getLabelForValue = (val: string) => {
    return optionsMapRef.current.get(val);
  };

  const contextValue = useMemo(() => ({
    isOpen,
    toggleOpen,
    selectedValue: value,
    setSelectedValue: onValueChange,
    refs,
    floatingStyles, // Pass styles through context
    getFloatingProps,
    getReferenceProps,
    registerOption,
    getLabelForValue,
  }), [isOpen, value, onValueChange, floatingStyles]);

  return (
    <SelectContext.Provider value={contextValue}>
      {children}
    </SelectContext.Provider>
  );
};

// --- 3. Select Trigger ---
export const SelectTrigger = React.forwardRef<HTMLButtonElement, { children: React.ReactNode, className?: string }>(
  ({ children, className = '' }, ref) => {
    const { refs, getReferenceProps } = useSelectContext();
    return (
      <button
        ref={node => {
          refs.setReference(node);
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        {...getReferenceProps()}
        className={`flex items-center justify-between w-full px-3 py-2 text-left bg-white border border-gray-300 shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 transition-colors ${className}`}
      >
        {children}
        <ChevronDown size={16} className="text-gray-400 ml-2" />
      </button>
    );
  }
);

// --- 4. Select Value ---
export const SelectValue = ({ placeholder }: { placeholder?: string }) => {
  const { selectedValue, getLabelForValue } = useSelectContext();
  const label = selectedValue ? getLabelForValue(selectedValue) : null;

  if (!label) {
    return <span className="text-gray-500">{placeholder}</span>;
  }
  return <span className="text-gray-900">{label}</span>;
};

// --- 5. Select Content ---
export const SelectContent = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => {
  const { refs, getFloatingProps, isOpen, floatingStyles } = useSelectContext(); // Get styles from context

  if (!isOpen) return null;

  return (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        style={floatingStyles}
        {...getFloatingProps()}
        className={`z-50 w-[var(--radix-select-trigger-width)] bg-white border border-gray-200 shadow-lg p-1 ${className}`}
      >
        {children}
      </div>
    </FloatingPortal>
  );
};

// --- 6. Select Item ---
export const SelectItem = ({ children, value, className = '' }: { children: React.ReactNode, value: string, className?: string }) => {
  const { setSelectedValue, toggleOpen, selectedValue, registerOption } = useSelectContext();
  const isSelected = selectedValue === value;
  
  useEffect(() => {
    registerOption(value, children);
  }, [value, children, registerOption]);

  const handleClick = () => {
    setSelectedValue(value);
    toggleOpen();
  };

  return (
    <div
      onClick={handleClick}
      role="option"
      aria-selected={isSelected}
      className={`flex items-center justify-between px-3 py-2 text-sm text-gray-800 cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:outline-none transition-colors ${className} ${isSelected ? 'font-semibold bg-gray-100' : ''}`}
    >
      <span>{children}</span>
      {isSelected && <Check size={16} className="text-blue-600" />}
    </div>
  );
};