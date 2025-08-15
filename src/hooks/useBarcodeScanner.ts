import { useState, useEffect, useCallback, useRef } from 'react';

// Configuration: The max time (in ms) between keystrokes to be considered part of the same scan.
const SCAN_TIMEOUT = 100;
// Configuration: The minimum length of a barcode to be considered valid.
const MIN_BARCODE_LENGTH = 3;

/**
 * A custom React hook that listens for barcode scanner input.
 * Scanners typically emulate a keyboard and send an 'Enter' key press after the code.
 * This hook buffers rapid keystrokes and calls a callback when a scan is complete.
 *
 * @param onScan - The callback function to execute with the scanned barcode string.
 * @param enabled - A boolean to enable or disable the listener. Defaults to true.
 */
export const useBarcodeScanner = (onScan: (barcode: string) => void, enabled: boolean = true) => {
  // We use a ref to hold the buffered keystrokes. This prevents re-renders on every key press.
  const barcodeBuffer = useRef<string>('');
  // Ref to hold the timer ID.
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // If the listener is disabled, or if the event is coming from an input/textarea, ignore it.
    // This prevents the hook from interfering with normal user typing.
    const target = event.target as HTMLElement;
    if (!enabled || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }

    // If the key is 'Enter', we've likely completed a scan.
    if (event.key === 'Enter') {
      // Prevent the default 'Enter' action (e.g., form submission).
      event.preventDefault();
      
      if (barcodeBuffer.current.length >= MIN_BARCODE_LENGTH) {
        onScan(barcodeBuffer.current);
      }
      // Clear the buffer for the next scan.
      barcodeBuffer.current = '';
      return;
    }

    // Ignore non-printable characters (like Shift, Ctrl, etc.).
    if (event.key.length > 1) {
      return;
    }

    // Append the character to our buffer.
    barcodeBuffer.current += event.key;

    // Reset the timeout. If no new key is pressed within SCAN_TIMEOUT, clear the buffer.
    // This handles cases where a user is typing slowly, not scanning.
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      barcodeBuffer.current = '';
    }, SCAN_TIMEOUT);

  }, [onScan, enabled]);

  useEffect(() => {
    // Add the event listener when the component mounts.
    window.addEventListener('keydown', handleKeyDown);

    // Clean up by removing the event listener when the component unmounts.
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [handleKeyDown]); // Re-attach the listener if the handler changes.
};