import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * Estado vacío del panel. `hint` y `action` son opcionales para que el vacío
 * no sea solo texto muerto: idealmente dice qué hacer a continuación.
 */
export default function EmptyState({
  icon: Icon,
  message,
  hint,
  action,
}: {
  icon: LucideIcon;
  message: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className='flex flex-col items-center justify-center gap-2 py-12 text-gray-400'>
      <Icon className='h-10 w-10' />
      <p className='text-sm'>{message}</p>
      {hint && <p className='max-w-xs text-center text-xs text-gray-400'>{hint}</p>}
      {action && <div className='mt-2'>{action}</div>}
    </div>
  );
}
