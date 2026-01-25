'use client';



import { ScrollToTop } from '@/components/ui/scroll-to-top';

export function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-in fade-in zoom-in-95 duration-500">
      {children}
      <ScrollToTop />
    </div>
  );
}
