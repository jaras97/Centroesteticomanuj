'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { signOut } from '@/app/admin/(dashboard)/actions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/admin', label: 'Bandeja' },
  { href: '/admin/agenda', label: 'Agenda' },
  { href: '/admin/reservar', label: 'Nueva cita' },
  { href: '/admin/horarios', label: 'Horarios' },
  { href: '/admin/clientes', label: 'Clientes' },
];

export default function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className='bg-white border-b'>
      <div className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4'>
        <nav className='flex items-center gap-1 overflow-x-auto'>
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                pathname === link.href
                  ? 'bg-brand-teal/10 text-brand-teal'
                  : 'text-gray-500 hover:text-brand-ink',
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className='flex items-center gap-4 shrink-0'>
          <span className='text-sm text-gray-400 hidden sm:inline'>{email}</span>
          <Button
            variant='ghost'
            size='sm'
            onClick={async () => {
              await signOut();
              router.push('/admin/login');
              router.refresh();
            }}
          >
            <LogOut className='h-4 w-4' />
            Salir
          </Button>
        </div>
      </div>
    </header>
  );
}
