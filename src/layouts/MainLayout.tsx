import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Box, rem } from '@mantine/core';
import { Sidebar } from './components/Sidebar';
import { TopNavbar } from './components/TopNavbar';
import { useAuthStore } from '@/core/store/auth';

export const MainLayout = () => {
  const { isLoggedIn } = useAuthStore();
  const [sidebarOpened, setSidebarOpened] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(100);

  // 身份校验拦截
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Box
      style={{
        display: 'flex',
        height: '100vh',
        background: 'var(--leixi-shell-bg)',
      }}
    >
      <Sidebar 
        opened={sidebarOpened} 
      />
      
      <Box 
        component="main" 
        style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'hidden'
        }}
      >
        <TopNavbar 
          sidebarOpened={sidebarOpened}
          onToggleSidebar={() => setSidebarOpened(!sidebarOpened)}
          zoomLevel={zoomLevel}
          onZoomChange={setZoomLevel}
        />
        
        <Box 
          p="lg" 
          style={{ 
            flex: 1, 
            overflowY: 'auto',
            zoom: zoomLevel / 100,
            background: 'transparent',
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};
