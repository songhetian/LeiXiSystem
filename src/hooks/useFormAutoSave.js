import { useCallback, useEffect, useRef, useState } from 'react';
import { debounce } from '../utils/performanceUtils';

/**
 * Custom hook for form auto-save with debouncing
 * @param {Function} saveFunction - The function to call for saving (should return a Promise)
 * @param {number} debounceDelay - Delay in milliseconds for debouncing (default: 3000ms)
 * @param {boolean} enabled - Whether auto-save is enabled (default: true)
 * @returns {Object} - { triggerSave, isSaving, saveStatus, clearStatus }
 */
export const useFormAutoSave = (saveFunction, debounceDelay = 3000, enabled = true) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'success', 'error', or null
  const saveTimeoutRef = useRef(null);

  // Debounced save function
  const debouncedSave = useCallback(
    debounce(async (data) => {
      if (!enabled) return;

      setIsSaving(true);
      setSaveStatus(null);

      try {
        await saveFunction(data);
        setSaveStatus('success');

        // Clear success status after 2 seconds
        setTimeout(() => {
          setSaveStatus(null);
        }, 2000);
      } catch (error) {
        console.error('Auto-save failed:', error);
        setSaveStatus('error');

        // Clear error status after 3 seconds
        setTimeout(() => {
          setSaveStatus(null);
        }, 3000);
      } finally {
        setIsSaving(false);
      }
    }, debounceDelay),
    [saveFunction, debounceDelay, enabled]
  );

  // Trigger save function
  const triggerSave = useCallback((data) => {
    debouncedSave(data);
  }, [debouncedSave]);

  // Clear status
  const clearStatus = useCallback(() => {
    setSaveStatus(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    triggerSave,
    isSaving,
    saveStatus,
    clearStatus,
  };
};

export default useFormAutoSave;
