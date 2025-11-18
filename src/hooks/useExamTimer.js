import { useState, useEffect, useCallback, useRef } from 'react';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import axios from 'axios';
import { message, notification } from 'antd';

dayjs.extend(duration);

const useExamTimer = (initialTimeInSeconds, onTimerEnd, resultId) => {
  const [timeLeft, setTimeLeft] = useState(initialTimeInSeconds);
  const [isRunning, setIsRunning] = useState(true);
  const timerRef = useRef(null);
  const onTimerEndRef = useRef(onTimerEnd);
  const resultIdRef = useRef(resultId);

  // Update ref whenever onTimerEnd or resultId changes
  useEffect(() => {
    onTimerEndRef.current = onTimerEnd;
    resultIdRef.current = resultId;
  }, [onTimerEnd, resultId]);

  const formatTime = (seconds) => {
    const dur = dayjs.duration(seconds, 'seconds');
    const hours = String(dur.hours()).padStart(2, '0');
    const minutes = String(dur.minutes()).padStart(2, '0');
    const secs = String(dur.seconds()).padStart(2, '0');
    return `${hours}:${minutes}:${secs}`;
  };

  const syncServerTime = useCallback(async () => {
    try {
      // Assuming a backend endpoint to get current server time
      const response = await axios.get('/api/time/server', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const serverTime = dayjs(response.data.serverTime);
      const localTime = dayjs();
      const timeDifference = localTime.diff(serverTime, 'seconds'); // Local time ahead of server time if positive

      // Adjust timeLeft based on server time if necessary
      // This logic needs to be carefully designed based on how initialTimeInSeconds is set
      // For now, let's just log the difference
      console.log('Server time synced. Local time difference:', timeDifference, 'seconds');
      // If initialTimeInSeconds is derived from server-calculated remaining time,
      // then direct adjustment might not be needed here, but rather in the initial fetch.
    } catch (error) {
      console.error('Failed to sync server time:', error);
    }
  }, []);

  useEffect(() => {
    // Sync server time periodically or at start
    syncServerTime();
    const syncInterval = setInterval(syncServerTime, 5 * 60 * 1000); // Sync every 5 minutes
    return () => clearInterval(syncInterval);
  }, [syncServerTime]);

  useEffect(() => {
    if (!isRunning || timeLeft <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (timeLeft <= 0) onTimerEndRef.current();
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prevTime) => {
        const newTime = prevTime - 1;
        // Time reminders
        if (newTime === 300) { // 5 minutes
          notification.warning({
            message: '考试时间提醒',
            description: '距离考试结束还有5分钟，请尽快检查并提交试卷。',
            duration: 0,
          });
        } else if (newTime === 60) { // 1 minute
          notification.error({
            message: '考试时间警告',
            description: '距离考试结束还有1分钟，系统将自动提交试卷！',
            duration: 0,
          });
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [timeLeft, isRunning]);

  const [pageSwitchCount, setPageSwitchCount] = useState(0);

  // Page visibility handling and anti-cheating measures
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setPageSwitchCount((prevCount) => prevCount + 1);
        message.warning('您已切换页面，请尽快返回考试界面。多次切换可能被记录为作弊行为。', 5);
        // TODO: Log this event to the backend for anti-cheating analysis
      }
    };

    const disableCopyPaste = (e) => {
      message.warning('考试期间禁止复制粘贴！', 2);
      e.preventDefault();
    };

    const disableRightClick = (e) => {
      message.warning('考试期间禁止右键操作！', 2);
      e.preventDefault();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('copy', disableCopyPaste);
    document.addEventListener('cut', disableCopyPaste);
    document.addEventListener('paste', disableCopyPaste);
    document.addEventListener('contextmenu', disableRightClick);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('copy', disableCopyPaste);
      document.removeEventListener('cut', disableCopyPaste);
      document.removeEventListener('paste', disableCopyPaste);
      document.removeEventListener('contextmenu', disableRightClick);
    };
  }, []);

  return { timeLeft, formatTime, setIsRunning, pageSwitchCount };
};

export default useExamTimer;
