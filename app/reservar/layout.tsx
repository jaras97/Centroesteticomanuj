import type { ReactNode } from 'react';
import ReservarHeader from '@/components/reservar/reservar-header';
import Footer from '@/components/footer';

export default function ReservarLayout({ children }: { children: ReactNode }) {
  return (
    <div className='min-h-screen bg-gradient-to-br from-brand-sand/10 to-white flex flex-col'>
      <ReservarHeader />
      <main className='flex-1'>{children}</main>
      <Footer />
    </div>
  );
}
