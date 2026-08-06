import type { LucideIcon } from 'lucide-react';

export default function EmptyState({
  icon: Icon,
  message,
}: {
  icon: LucideIcon;
  message: string;
}) {
  return (
    <div className='flex flex-col items-center justify-center gap-2 py-12 text-gray-400'>
      <Icon className='h-10 w-10' />
      <p className='text-sm'>{message}</p>
    </div>
  );
}
