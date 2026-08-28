import { Building2, GalleryHorizontal, ImageIcon, Megaphone, Rows3, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import HeroSlidesTable from '@/components/admin/hero-slides-table';
import HeroSlideFormDialog from '@/components/admin/hero-slide-form-dialog';
import ServiceCategoriesTable from '@/components/admin/service-categories-table';
import ServiceCategoryFormDialog from '@/components/admin/service-category-form-dialog';
import GalleryImagesTable from '@/components/admin/gallery-images-table';
import GalleryImageFormDialog from '@/components/admin/gallery-image-form-dialog';
import PromotionsTable from '@/components/admin/promotions-table';
import PromotionFormDialog from '@/components/admin/promotion-form-dialog';
import SiteSectionsTable from '@/components/admin/site-sections-table';
import SiteSectionFormDialog from '@/components/admin/site-section-form-dialog';
import SiteSettingsForm from '@/components/admin/site-settings-form';

export default async function ContenidoPage() {
  const supabase = await createClient();

  const [
    { data: heroSlides },
    { data: categories },
    { data: galleryImages },
    { data: promotions },
    { data: sections },
    { data: settings },
  ] = await Promise.all([
    supabase.from('hero_slides').select('*').order('display_order'),
    supabase.from('service_categories').select('*').order('display_order'),
    supabase.from('gallery_images').select('*').order('display_order'),
    supabase.from('promotions').select('*').order('created_at', { ascending: false }),
    supabase.from('site_sections').select('*').order('display_order'),
    supabase.from('site_settings').select('*').eq('id', true).single(),
  ]);

  const existingCategories = Array.from(
    new Set((galleryImages ?? []).map((i) => i.category)),
  ).sort();

  return (
    <div>
      <h1 className='text-2xl font-bold text-brand-ink mb-6'>Contenido del sitio</h1>

      <Tabs defaultValue='carrusel'>
        <TabsList>
          <TabsTrigger value='carrusel' className='gap-1.5'>
            <GalleryHorizontal className='h-4 w-4' />
            Carrusel
          </TabsTrigger>
          <TabsTrigger value='servicios' className='gap-1.5'>
            <Sparkles className='h-4 w-4' />
            Servicios
          </TabsTrigger>
          <TabsTrigger value='galeria' className='gap-1.5'>
            <ImageIcon className='h-4 w-4' />
            Galería
          </TabsTrigger>
          <TabsTrigger value='promociones' className='gap-1.5'>
            <Megaphone className='h-4 w-4' />
            Promociones
          </TabsTrigger>
          <TabsTrigger value='secciones' className='gap-1.5'>
            <Rows3 className='h-4 w-4' />
            Secciones
          </TabsTrigger>
          <TabsTrigger value='sitio' className='gap-1.5'>
            <Building2 className='h-4 w-4' />
            Sitio
          </TabsTrigger>
        </TabsList>

        <TabsContent value='carrusel' className='space-y-4'>
          <div className='flex justify-end'>
            <HeroSlideFormDialog />
          </div>
          <HeroSlidesTable slides={heroSlides ?? []} />
        </TabsContent>

        <TabsContent value='servicios' className='space-y-4'>
          <p className='text-sm text-gray-500'>
            Estas categorías son lo que se ve en la sección "Servicios" del sitio. Cada una puede
            agrupar varios servicios agendables (duración/precio se administran en
            /admin/servicios).
          </p>
          <div className='flex justify-end'>
            <ServiceCategoryFormDialog />
          </div>
          <ServiceCategoriesTable categories={categories ?? []} />
        </TabsContent>

        <TabsContent value='galeria' className='space-y-4'>
          <div className='flex justify-end'>
            <GalleryImageFormDialog existingCategories={existingCategories} />
          </div>
          <GalleryImagesTable images={galleryImages ?? []} />
        </TabsContent>

        <TabsContent value='promociones' className='space-y-4'>
          <p className='text-sm text-gray-500'>
            El modal aparece una vez al entrar a la página de inicio (no reaparece hasta 7 días
            después de cerrarlo, o antes si publicas una promoción distinta). Solo puede haber una
            promoción activa a la vez — activar una desactiva automáticamente cualquier otra.
          </p>
          <div className='flex justify-end'>
            <PromotionFormDialog />
          </div>
          <PromotionsTable promotions={promotions ?? []} />
        </TabsContent>

        <TabsContent value='secciones' className='space-y-4'>
          <p className='text-sm text-gray-500'>
            El orden de la lista es el orden real en la home — arrastra para reorganizar. Incluye
            "Servicios", "Sobre nosotros", "Misión y visión" y "Galería" (se editan en sus propias
            pestañas, acá solo se mueven o se apagan) junto con tus secciones de foto/video/color.
          </p>
          <div className='flex justify-end'>
            <SiteSectionFormDialog />
          </div>
          <SiteSectionsTable sections={sections ?? []} />
        </TabsContent>

        <TabsContent value='sitio' className='space-y-4'>
          {settings ? (
            <SiteSettingsForm settings={settings} />
          ) : (
            <p className='text-sm text-destructive'>
              No se encontró la configuración del sitio — falta correr la migración
              0009_site_settings.sql.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
