'use client';

import { useState, useEffect } from 'react';

export const BREAKPOINTS = {
  sm: 576,
  md: 768,
  lg: 1024,
  xl: 1280,
  xxl: 1600,
} as const;

export interface ResponsiveState {
  width: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isSmallMobile: boolean;
  isLargeDesktop: boolean;
  breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
}

function getResponsiveState(width: number): ResponsiveState {
  if (typeof window === 'undefined') {
    return {
      width: 1024,
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isSmallMobile: false,
      isLargeDesktop: false,
      breakpoint: 'lg',
    };
  }

  let breakpoint: ResponsiveState['breakpoint'] = 'xs';
  if (width >= BREAKPOINTS.xxl) breakpoint = 'xxl';
  else if (width >= BREAKPOINTS.xl) breakpoint = 'xl';
  else if (width >= BREAKPOINTS.lg) breakpoint = 'lg';
  else if (width >= BREAKPOINTS.md) breakpoint = 'md';
  else if (width >= BREAKPOINTS.sm) breakpoint = 'sm';

  return {
    width,
    isMobile: width < BREAKPOINTS.md,
    isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
    isDesktop: width >= BREAKPOINTS.lg,
    isSmallMobile: width < BREAKPOINTS.sm,
    isLargeDesktop: width >= BREAKPOINTS.xl,
    breakpoint,
  };
}

export function useResponsive(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>(() => {
    if (typeof window === 'undefined') {
      return getResponsiveState(1024);
    }
    return getResponsiveState(window.innerWidth);
  });

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setState(getResponsiveState(window.innerWidth));
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  return state;
}

export default useResponsive;
