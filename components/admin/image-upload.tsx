'use client';

import { useRef, useTransition } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uploadSiteMedia } from '@/app/admin/(dashboard)/actions';

type Folder = 'hero' | 'services' | 'gallery' | 'promos' | 'site';

export default function ImageUpload({
  folder,
  value,
  onChange,
}: {
  folder: Folder;
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  function handleFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    startTransition(async () => {
      const result = await uploadSiteMedia(folder, formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onChange(result.url);
    });
  }

  return (
    <div className='space-y-2'>
      {value ? (
        <div className='relative w-full aspect-video rounded-lg overflow-hidden border bg-gray-50'>
          <Image src={value} alt='' fill className='object-cover' />
          <Button
            type='button'
            size='sm'
            variant='outline'
            className='absolute top-2 right-2 bg-white/90'
            onClick={() => onChange('')}
          >
            <X className='h-3.5 w-3.5' />
          </Button>
        </div>
      ) : null}

      <input
        ref={inputRef}
        type='file'
        accept='image/*'
        className='hidden'
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
      <Button
        type='button'
        size='sm'
        variant='outline'
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
      >
        {isPending ? (
          <Loader2 className='h-3.5 w-3.5 animate-spin' />
        ) : (
          <Upload className='h-3.5 w-3.5' />
        )}
        {value ? 'Cambiar imagen' : 'Subir imagen'}
      </Button>
    </div>
  );
}
