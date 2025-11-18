import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-toastify';
import debounce from 'lodash.debounce'; // Assuming lodash is available or will be installed

const useAutoSave = (examId, resultId, userAnswers, onSaveSuccess, onSaveError) => {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const userAnswersRef = useRef(userAnswers); // Use ref to get latest answers in debounced function

  // Update ref whenever userAnswers changes
  useEffect(() => {
    userAnswersRef.current = userAnswers;
  }, [userAnswers]);

  // Function to save answers to local storage
  const saveToLocalStorage = useCallback((answers) => {
    if (examId && resultId) {
      localStorage.setItem(`exam-${examId}-${resultId}-answers`, JSON.stringify(answers));
    }
  }, [examId, resultId]);

  // Function to load answers from local storage
  const loadFromLocalStorage = useCallback(() => {
    if (examId && resultId) {
      const savedAnswers = localStorage.getItem(`exam-${examId}-${resultId}-answers`);
      return savedAnswers ? JSON.parse(savedAnswers) : {};
    }
    return {};
  }, [examId, resultId]);

  // Function to clear answers from local storage
  const clearLocalStorage = useCallback(() => {
    if (examId && resultId) {
      localStorage.removeItem(`exam-${examId}-${resultId}-answers`);
    }
  }, [examId, resultId]);

  // Debounced function to save answers to server
  const saveToServer = useCallback(
    debounce(async (answers) => {
      if (!examId || !resultId) return;

      setIsSaving(true);
      try {
        // TODO: Call API to save answers
        // await api.put(`/assessment-results/${resultId}/answer`, { answers });
        console.log('Answers saved to server:', answers); // Placeholder for actual API call
        setLastSaved(new Date());
        onSaveSuccess && onSaveSuccess();
      } catch (error) {
        console.error('Failed to auto-save answers:', error);
        toast.error('答案自动保存失败！');
        onSaveError && onSaveError(error);
      } finally {
        setIsSaving(false);
      }
    }, 3000), // Debounce for 3 seconds
    [examId, resultId, onSaveSuccess, onSaveError]
  );

  // Effect to trigger auto-save when userAnswers change
  useEffect(() => {
    if (Object.keys(userAnswers).length > 0) { // Only save if there are answers
      saveToLocalStorage(userAnswers);
      saveToServer(userAnswers);
    }
  }, [userAnswers, saveToLocalStorage, saveToServer]);

  // Effect to periodically sync to server (e.g., every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      if (Object.keys(userAnswersRef.current).length > 0 && !isSaving) {
        saveToServer(userAnswersRef.current);
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [saveToServer, isSaving]);

  return { isSaving, lastSaved, loadFromLocalStorage, clearLocalStorage };
};

export default useAutoSave;
