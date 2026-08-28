'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { Cake, Loader2, Megaphone } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/admin/empty-state';
import PromotionFormDialog from '@/components/admin/promotion-form-dialog';
import {
  deletePromotion,
  setPromotionActive,
} from '@/app/admin/(dashboard)/actions';
import { formatDateStr, formatDateStrHuman, toBogotaWallClock } from '@/lib/booking/timezone';
import type { Promotion } from '@/lib/supabase/types';

export default function PromotionsTable({ promotions }: { promotions: Promotion[] }) {
  if (promotions.length === 0) {
    return <EmptyState icon={Megaphone} message='Todavía no hay promociones.' />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Título</TableHead>
          <TableHead>Vigencia</TableHead>
          <TableHead>Cumpleaños</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {promotions.map((promotion) => (
          <PromotionRow key={promotion.id} promotion={promotion} />
        ))}
      </TableBody>
    </Table>
  );
}

function PromotionRow({ promotion }: { promotion: Promotion }) {
  const [isPending, startTransition] = useTransition();

  function toggleActive() {
    startTransition(async () => {
      const result = await setPromotionActive(promotion.id, !promotion.active);
      if (!result.ok) toast.error(result.error);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deletePromotion(promotion.id);
      if (!result.ok) toast.error(result.error);
    });
  }

  // starts_at/ends_at se guardan en UTC (00:00 y 23:59 hora Bogotá
  // respectivamente, ver promotionDbFields en actions.ts) — hay que
  // reconvertir a hora de pared de Bogotá antes de formatear, si no el
  // día mostrado puede quedar corrido por el cruce de zona horaria.
  const isoToLocalDateStr = (iso: string) => formatDateStr(toBogotaWallClock(new Date(iso)));

  const vigencia =
    promotion.starts_at || promotion.ends_at
      ? [
          promotion.starts_at ? formatDateStrHuman(isoToLocalDateStr(promotion.starts_at)) : '—',
          promotion.ends_at ? formatDateStrHuman(isoToLocalDateStr(promotion.ends_at)) : '—',
        ].join(' a ')
      : 'Sin vencimiento';

  return (
    <TableRow>
      <TableCell className='font-medium text-brand-ink'>{promotion.title}</TableCell>
      <TableCell className='text-gray-500 text-sm'>{vigencia}</TableCell>
      <TableCell>
        {promotion.requires_birthday ? (
          <Badge variant='secondary' className='gap-1'>
            <Cake className='h-3 w-3' />
            Sí
          </Badge>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell>
        <Badge variant={promotion.active ? 'success' : 'secondary'}>
          {promotion.active ? 'Activa' : 'Inactiva'}
        </Badge>
      </TableCell>
      <TableCell>
        <div className='flex gap-2'>
          <PromotionFormDialog promotion={promotion} />
          <Button size='sm' variant='outline' disabled={isPending} onClick={toggleActive}>
            {isPending && <Loader2 className='h-3.5 w-3.5 animate-spin' />}
            {promotion.active ? 'Desactivar' : 'Activar'}
          </Button>
          <Button size='sm' variant='outline' disabled={isPending} onClick={handleDelete}>
            Eliminar
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
