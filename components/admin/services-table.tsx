'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2, Tag } from 'lucide-react';
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
import ServiceFormDialog from '@/components/admin/service-form-dialog';
import { setServiceActive } from '@/app/admin/(dashboard)/actions';
import { formatCOP } from '@/lib/format';
import type { Service, ServiceCategory } from '@/lib/supabase/types';

export default function ServicesTable({
  services,
  categories,
}: {
  services: Service[];
  categories: ServiceCategory[];
}) {
  if (services.length === 0) {
    return <EmptyState
        icon={Tag}
        message='Todavía no hay servicios registrados.'
        hint='Usa el botón "Nuevo servicio" para que aparezcan como opción al reservar.'
      />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Categoría</TableHead>
          <TableHead>Duración</TableHead>
          <TableHead>Buffer</TableHead>
          <TableHead>Precio</TableHead>
          <TableHead>Anticipo</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {services.map((service) => (
          <ServiceRow key={service.id} service={service} categories={categories} />
        ))}
      </TableBody>
    </Table>
  );
}

function ServiceRow({
  service,
  categories,
}: {
  service: Service;
  categories: ServiceCategory[];
}) {
  const [isPending, startTransition] = useTransition();
  const categoryName = categories.find((c) => c.id === service.category_id)?.name;

  function toggleActive() {
    startTransition(async () => {
      const result = await setServiceActive(service.id, !service.active);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <TableRow>
      <TableCell className='font-medium text-brand-ink'>{service.name}</TableCell>
      <TableCell className='text-gray-500'>{categoryName ?? '—'}</TableCell>
      <TableCell>{service.duration_min} min</TableCell>
      <TableCell>{service.buffer_min} min</TableCell>
      <TableCell>{service.price != null ? formatCOP(service.price) : '—'}</TableCell>
      <TableCell>
        {service.deposit_amount != null ? formatCOP(service.deposit_amount) : '—'}
      </TableCell>
      <TableCell>
        <Badge variant={service.active ? 'success' : 'secondary'}>
          {service.active ? 'Activo' : 'Inactivo'}
        </Badge>
      </TableCell>
      <TableCell>
        <div className='flex gap-2'>
          <ServiceFormDialog service={service} categories={categories} />
          <Button size='sm' variant='outline' disabled={isPending} onClick={toggleActive}>
            {isPending && <Loader2 className='h-3.5 w-3.5 animate-spin' />}
            {service.active ? 'Desactivar' : 'Activar'}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
