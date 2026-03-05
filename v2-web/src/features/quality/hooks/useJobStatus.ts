import { useState, useEffect } from 'react';
import api from '@/core/api';

export interface JobStatus {
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  progress: number;
  result?: any;
}

export const useJobStatus = (jobId: string | null, onCompleted?: (result: any) => void) => {
  const [status, setStatus] = useState<JobStatus | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const timer = setInterval(async () => {
      try {
        const response = await api.get<{ success: boolean } & JobStatus>(`/quality/sessions/import/status/${jobId}`);
        if (response.data.success) {
          const { state, progress, result } = response.data;
          setStatus({ state, progress, result });

          if (state === 'completed') {
            clearInterval(timer);
            onCompleted?.(result);
          } else if (state === 'failed') {
            clearInterval(timer);
          }
        }
      } catch (e) {
        console.error('Job polling error:', e);
        clearInterval(timer);
      }
    }, 1500); // 1.5s 轮询一次

    return () => clearInterval(timer);
  }, [jobId]);

  return status;
};
