'use client';

import { useEffect } from 'react';
import { initAnalytics } from '@/lib/posthog';

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void initAnalytics();
  }, []);

  return <>{children}</>;
}
