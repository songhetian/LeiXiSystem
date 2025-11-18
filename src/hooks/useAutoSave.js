import { useState, useEffect, useCallback, useRef } from 'react';
import debounce from 'lodash.debounce';
import axios from 'axios';
import { message } from 'antd';

const useAutoSave = (saveFunction, resultId, delay = 3000, syncInterval = 30000) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const saveFunctionRef = useRef(saveFunction);
  const resultIdRef = useRef(resultId);
  const lastSavedDataRef = useRef(null); // To track last successfully saved data

  useEffect(() => {
    saveFunctionRef.current = saveFunction;
    resultIdRef.current = resultId;
  }, [saveFunction, resultId]);

  // Debounced function for immediate saves (e.g., on input change)
  const debouncedSave = useCallback(
    debounce(async (dataToSave) => {
      if (!resultIdRef.current) return;
      setIsSaving(true);
      setSaveError(null);
      try {
        await saveFunctionRef.current(resultIdRef.current, dataToSave);
        lastSavedDataRef.current = dataToSave; // Update last saved data
        message.success('答案已自动保存', 1);
      } catch (error) {
        setSaveError(error);
        message.error('自动保存失败');
        console.error('Auto-save failed:', error);
      } finally {
        setIsSaving(false);
      }
    }, delay),
    [delay]
  );

  // LocalStorage Caching
  const getLocalStorageKey = useCallback(() => `exam_answers_${resultIdRef.current}`, []);

  const saveToLocalStorage = useCallback((data) => {
    if (resultIdRef.current) {
      localStorage.setItem(getLocalStorageKey(), JSON.stringify(data));
    }
  }, [getLocalStorageKey]);

  const loadFromLocalStorage = useCallback(() => {
    if (resultIdRef.current) {
      const saved = localStorage.getItem(getLocalStorageKey());
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  }, [getLocalStorageKey]);

  const clearLocalStorage = useCallback(() => {
    if (resultIdRef.current) {
      localStorage.removeItem(getLocalStorageKey());
    }
  }, [getLocalStorageKey]);

  // Timed Server Sync
  useEffect(() => {
    if (!resultIdRef.current) return;

    const interval = setInterval(() => {
      // Only sync if there are changes since last successful save
      const currentData = loadFromLocalStorage();
      if (currentData && JSON.stringify(currentData) !== JSON.stringify(lastSavedDataRef.current)) {
        debouncedSave(currentData); // Use debounced save for periodic sync too
      }
    }, syncInterval);

    return () => clearInterval(interval);
  }, [debouncedSave, loadFromLocalStorage, syncInterval]);

  // Network status detection (basic)
  useEffect(() => {
    const handleOnline = () => message.success('网络已恢复，答案将继续自动保存。');
    const handleOffline = () => message.warning('网络连接已断开，请检查您的网络。答案将暂时保存到本地。');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { debouncedSave, isSaving, saveError, saveToLocalStorage, loadFromLocalStorage, clearLocalStorage };
};

export default useAutoSave;