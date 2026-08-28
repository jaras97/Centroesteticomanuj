'use client';

import { useEffect, useState, useTransition } from 'react';
import Image from 'next/image';
import { Reorder, useDragControls } from 'framer-motion';
import { toast } from 'sonner';
import { GripVertical, Loader2, Rows3, Video } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/admin/empty-state';
import SiteSectionFormDialog from '@/components/admin/site-section-form-dialog';
import {
  deleteSiteSection,
  reorderSiteSections,
  setSiteSectionActive,
} from '@/app/admin/(dashboard)/actions';
import type { SiteSection } from '@/lib/supabase/types';

export default function SiteSectionsTable({ sections: sectionsProp }: { sections: SiteSection[] }) {
  const [sections, setSections] = useState(sectionsProp);
  useEffect(() => setSections(sectionsProp), [sectionsProp]);

  if (sections.length === 0) {
    return <EmptyState icon={Rows3} message='Todavía no hay secciones.' />;
  }

  function persistOrder(newOrder: SiteSection[]) {
    reorderSiteSections(newOrder.map((s) => s.id)).then((result) => {
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <Reorder.Group as='ul' axis='y' values={sections} onReorder={setSections} className='space-y-2'>
      {sections.map((section) => (
        <SectionRow key={section.id} section={section} onDragEnd={() => persistOrder(sections)} />
      ))}
    </Reorder.Group>
  );
}

function SectionRow({ section, onDragEnd }: { section: SiteSection; onDragEnd: () => void }) {
  const [isPending, startTransition] = useTransition();
  const dragControls = useDragControls();

  function toggleActive() {
    startTransition(async () => {
      const result = await setSiteSectionActive(section.id, !section.active);
      if (!result.ok) toast.error(result.error);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteSiteSection(section.id);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <Reorder.Item
      as='li'
      value={section}
      dragListener={false}
      dragControls={dragControls}
      onDragEnd={onDragEnd}
      className='flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border bg-white p-3 shadow-sm'
      whileDrag={{ boxShadow: '0 8px 20px rgba(0,0,0,0.12)', scale: 1.01 }}
    >
      <div className='flex items-center gap-3 min-w-0 w-full sm:w-auto'>
        <button
          type='button'
          onPointerDown={(e) => dragControls.start(e)}
          className='shrink-0 cursor-grab touch-none text-gray-300 hover:text-gray-500 active:cursor-grabbing'
          aria-label='Arrastrar para reordenar'
        >
          <GripVertical className='h-5 w-5' />
        </button>

        <div className='relative h-12 w-20 shrink-0 rounded overflow-hidden bg-gray-100 flex items-center justify-center'>
          {section.image_url ? (
            <Image src={section.image_url} alt='' fill className='object-cover' draggable={false} />
          ) : section.media_type === 'video' ? (
            <Video className='h-5 w-5 text-gray-400' />
          ) : null}
        </div>

        <div className='flex-1 min-w-0 font-medium text-brand-ink truncate'>
          {section.title}
          {section.media_type === 'video' && (
            <Badge variant='secondary' className='ml-2 gap-1 align-middle'>
              <Video className='h-3 w-3' />
              Video
            </Badge>
          )}
        </div>

        <Badge variant={section.active ? 'success' : 'secondary'} className='shrink-0'>
          {section.active ? 'Activa' : 'Inactiva'}
        </Badge>
      </div>

      <div className='flex flex-wrap shrink-0 gap-2 sm:ml-auto'>
        <SiteSectionFormDialog section={section} />
        <Button size='sm' variant='outline' disabled={isPending} onClick={toggleActive}>
          {isPending && <Loader2 className='h-3.5 w-3.5 animate-spin' />}
          {section.active ? 'Desactivar' : 'Activar'}
        </Button>
        <Button size='sm' variant='outline' disabled={isPending} onClick={handleDelete}>
          Eliminar
        </Button>
      </div>
    </Reorder.Item>
  );
}
