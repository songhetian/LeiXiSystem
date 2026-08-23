'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

// 使用 dynamic + ssr: false 避免 Open-File-Viewer 在服务端渲染时报错
const Viewer = dynamic(() => import('./viewer'), {
  ssr: false,
  loading: () => <div style={{ padding: 24, textAlign: 'center' }}>加载中...</div>,
});

export default function PreviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [file, setFile] = useState<Blob | null>(null);
  const [fileName, setFileName] = useState('文件');
  const [mimeType, setMimeType] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const id = params.id;

    fetch(`/api/v1/knowledge/attachments/${id}/download?token=${token}`)
      .then((res) => {
        if (!res.ok) throw new Error('加载失败');
        const cd = res.headers.get('content-disposition');
        if (cd) {
          const match = cd.match(/filename="?(.+?)"?(?:;|$)/);
          if (match) {
            try {
              setFileName(decodeURIComponent(match[1]));
            } catch {
              setFileName(match[1]);
            }
          }
        }
        const ct = res.headers.get('content-type');
        if (ct) setMimeType(ct);
        return res.blob();
      })
      .then((blob) => {
        setFile(blob);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || '加载失败');
        setLoading(false);
      });
  }, [params.id, token]);

  if (loading) return <div style={{ padding: 24, textAlign: 'center' }}>加载中...</div>;
  if (error) return <div style={{ padding: 24, textAlign: 'center', color: '#f53f3f' }}>{error}</div>;
  if (!file) return <div style={{ padding: 24, textAlign: 'center' }}>文件不存在</div>;

  return <Viewer file={file} fileName={fileName} mimeType={mimeType} />;
}
