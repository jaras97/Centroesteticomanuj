import { PageTitleSkeleton, TableSkeleton } from '@/components/admin/skeletons';

/** Servicios: título + botón "Nuevo servicio" + tabla. */
export default function Loading() {
  return (
    <div>
      <PageTitleSkeleton action />
      <TableSkeleton rows={8} />
    </div>
  );
}
