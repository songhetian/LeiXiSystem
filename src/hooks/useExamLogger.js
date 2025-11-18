import { useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { message } from 'antd';

const INACTIVITY_WARNING_TIME = 5 * 60 * 1000; // 5 minutes
const INACTIVITY_SUBMIT_TIME = 10 * 60 * 1000; // 10 minutes

const useExamLogger = (resultId, onInactivitySubmit) => {
  const activityTimerRef = useRef(null);
  const lastActivityTimeRef = useRef(Date.now());
  const onInactivitySubmitRef = useRef(onInactivitySubmit);

  useEffect(() => {
    onInactivitySubmitRef.current = onInactivitySubmit;
  }, [onInactivitySubmit]);

  const sendLog = useCallback(async (eventType, details = {}) => {
    if (!resultId) return;
    try {
      await axios.post('/api/exam-logs', {
        result_id: resultId,
        event_type: eventType,
        timestamp: new Date().toISOString(),
        details: JSON.stringify(details),
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      // console.log(`Logged event: ${eventType}`, details);
    } catch (error) {
      console.error('Failed to send exam log:', error);
    }
  }, [resultId]);

  // Inactivity detection
  const resetActivityTimer = useCallback(() => {
    clearTimeout(activityTimerRef.current);
    lastActivityTimeRef.current = Date.now();
    activityTimerRef.current = setTimeout(() => {
      const inactiveDuration = Date.now() - lastActivityTimeRef.current;
      if (inactiveDuration >= INACTIVITY_SUBMIT_TIME) {
        message.error('长时间未操作，考试已自动提交！', 5);
        sendLog('EXAM_AUTO_SUBMIT_INACTIVITY', { duration: inactiveDuration });
        onInactivitySubmitRef.current();
      } else if (inactiveDuration >= INACTIVITY_WARNING_TIME) {
        message.warning('您已长时间未操作，请尽快继续答题，否则考试将自动提交。', 5);
        sendLog('INACTIVITY_WARNING', { duration: inactiveDuration });
        // Reset timer for the next check (e.g., for auto-submit)
        resetActivityTimer();
      }
    }, INACTIVITY_WARNING_TIME); // Check for warning first
  }, [sendLog]);

  useEffect(() => {
    if (!resultId) return;

    const handleActivity = () => resetActivityTimer();

    document.addEventListener('mousemove', handleActivity);
    document.addEventListener('keydown', handleActivity);
    document.addEventListener('click', handleActivity);
    document.addEventListener('scroll', handleActivity);

    resetActivityTimer(); // Initialize timer

    return () => {
      clearTimeout(activityTimerRef.current);
      document.removeEventListener('mousemove', handleActivity);
      document.removeEventListener('keydown', handleActivity);
      document.removeEventListener('click', handleActivity);
      document.removeEventListener('scroll', handleActivity);
    };
  }, [resultId, resetActivityTimer]);

  // Log exam start
  useEffect(() => {
    if (resultId) {
      sendLog('EXAM_START');
    }
  }, [resultId, sendLog]);

  return { sendLog };
};

export default useExamLogger;
