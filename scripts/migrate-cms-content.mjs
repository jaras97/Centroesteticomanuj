// Script de un solo uso: descarga las imágenes actualmente hardcodeadas
// (hoy en Cloudinary) y las sube a Supabase Storage (bucket "site-media"),
// luego siembra hero_slides / service_categories / gallery_images con las
// URLs resultantes, y enlaza los servicios agendables existentes a su
// categoría de marketing por nombre.
//
// Requiere que la migración 0006_cms_contenido.sql ya se haya corrido
// (bucket + tablas deben existir).
//
// Uso:
//   node scripts/migrate-cms-content.mjs
//
// Lee NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de .env.local
// (no depende de dotenv para no agregar una dependencia nueva al proyecto).

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnvLocal() {
  const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (value && !process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ------------------------------------------------------------------
// Contenido actual, copiado de los componentes antes de reemplazarlos
// por lectura de base de datos (ver docs/PRD-cms-contenido-y-promociones.md).
// ------------------------------------------------------------------

const HERO_SLIDES = [
  {
    cloudinaryUrl:
      'https://res.cloudinary.com/dcuethtco/image/upload/v1785888046/social11_s8n04p.jpg',
    title: 'Maquillaje Profesional',
    description:
      'Servicio de maquillaje profesional para eventos especiales, bodas, grados, cumpleaños, sesiones fotográficas, etc.',
    ctaLabel: 'Reservar Cita',
    ctaHref: '/reservar',
  },
  {
    cloudinaryUrl:
      'https://res.cloudinary.com/dcuethtco/image/upload/v1754769880/labios_nilxgu.jpg',
    title: 'HIDRALIPS',
    description: 'Regenera, repara y revitaliza tus labios con Hidralips.',
    ctaLabel: 'Reservar Cita',
    ctaHref: '/reservar',
  },
  {
    cloudinaryUrl:
      'https://res.cloudinary.com/dcuethtco/image/upload/v1754770398/cosme_v48p1n.jpg',
    title: 'Tratamientos faciales',
    description:
      'Cuidan y mejoran la piel del rostro, limpiando, hidratando y rejuveneciendo su apariencia.',
    ctaLabel: 'Reservar Cita',
    ctaHref: '/reservar',
  },
];

// "serviceName" enlaza con public.services.name (seed de 0001) para setear
// category_id en los servicios agendables existentes. Si el nombre no
// coincide con ningún servicio real, simplemente no se enlaza nada — no
// falla el script.
const SERVICE_CATEGORIES = [
  {
    cloudinaryUrl:
      'https://res.cloudinary.com/dcuethtco/image/upload/v1754769880/maquillaje_kv4dw8.jpg',
    name: 'Maquillaje social',
    serviceName: 'Maquillaje social',
    description:
      'Perfecto para eventos, fiestas y ocasiones especiales. Adaptamos el look a tu estilo y personalidad',
    features: [
      'Maquillaje personalizado',
      'Productos de alta calidad',
      'Maquillaje de alta duración',
    ],
  },
  {
    cloudinaryUrl:
      'https://res.cloudinary.com/dcuethtco/image/upload/v1754769848/maquillaje2_ivxmhw.jpg',
    name: 'Maquillaje artístico',
    serviceName: 'Maquillaje artístico',
    description: 'Ideal para crear personajes, expresar emociones o destacar en eventos especiales.',
    features: ['Productos de alta calidad', 'Asesoramiento'],
  },
  {
    cloudinaryUrl:
      'https://res.cloudinary.com/dcuethtco/image/upload/v1785881648/cosme_v48p1n.jpg',
    name: 'Tratamientos faciales personalizados',
    serviceName: 'Tratamientos faciales personalizados',
    description:
      'Se adaptan a las necesidades específicas de cada piel para mejorar su salud y apariencia.',
    features: ['Valoración', 'Productos de alta calidad', 'Uso de aparatología'],
  },
  {
    cloudinaryUrl:
      'https://res.cloudinary.com/dcuethtco/image/upload/v1785888013/lifting_xmoouf.jpg',
    name: 'Lifting de pestañas',
    serviceName: 'Lifting de pestañas',
    description:
      'Tratamiento que eleva y curva las pestañas desde la raíz, creando efecto de mayor longitud y volumen sin rímel.',
    features: ['Duración hasta 8 semanas', 'Productos de alta calidad'],
  },
  {
    cloudinaryUrl:
      'https://res.cloudinary.com/dcuethtco/image/upload/v1754769847/laminado_i3ainq.jpg',
    name: 'Laminado de cejas',
    serviceName: 'Laminado de cejas',
    description:
      'Peina, alinea y fija el vello en una misma dirección para cejas más definidas y simétricas.',
    features: ['Duración de 4-6 semanas', 'Productos de alta calidad', 'Depilación y henna'],
  },
  {
    cloudinaryUrl:
      'https://res.cloudinary.com/dcuethtco/image/upload/v1754769880/labios_nilxgu.jpg',
    name: 'Hidralips',
    serviceName: 'Hidralips',
    description: 'Hidrata y nutre profundamente los labios, mejorando suavidad, volumen y color natural.',
    features: ['Duración de 1 mes', 'Uso de dr-pen', 'Aplicación de color (opcional)'],
  },
];

const GALLERY_IMAGES = [
  { cloudinaryUrl: 'https://res.cloudinary.com/dcuethtco/image/upload/v1754769847/galeria3_vagqj1.jpg', alt: 'Maquillaje de novia elegante', category: 'Social' },
  { cloudinaryUrl: 'https://res.cloudinary.com/dcuethtco/image/upload/v1754769847/galeria4_qiqko7.jpg', alt: 'Maquillaje artístico colorido', category: 'Artístico' },
  { cloudinaryUrl: 'https://res.cloudinary.com/dcuethtco/image/upload/v1754769846/galeria5_aggvgv.jpg', alt: 'Maquillaje profesional para fotografía', category: 'Profesional' },
  { cloudinaryUrl: 'https://res.cloudinary.com/dcuethtco/image/upload/v1754769846/galeria6_vacudn.jpg', alt: 'Maquillaje glamoroso para fiestas', category: 'Artístico' },
  { cloudinaryUrl: 'https://res.cloudinary.com/dcuethtco/image/upload/v1754769847/galeria7_ae0i6p.jpg', alt: 'Maquillaje vintage estilo retro', category: 'Artístico' },
  { cloudinaryUrl: 'https://res.cloudinary.com/dcuethtco/image/upload/v1754769847/galeria8_h64mbo.jpg', alt: 'Maquillaje editorial para moda', category: 'Artístico' },
  { cloudinaryUrl: 'https://res.cloudinary.com/dcuethtco/image/upload/v1754769846/galeria10_e7brvm.jpg', alt: 'Maquillaje editorial para moda', category: 'Editorial' },
  { cloudinaryUrl: 'https://res.cloudinary.com/dcuethtco/image/upload/v1754769846/galeria12_i7kf0i.jpg', alt: 'Maquillaje social con brillo', category: 'Social' },
  { cloudinaryUrl: 'https://res.cloudinary.com/dcuethtco/image/upload/v1756580828/social1_vndugm.jpg', alt: 'Maquillaje social para evento', category: 'Social' },
  { cloudinaryUrl: 'https://res.cloudinary.com/dcuethtco/image/upload/v1785888013/editorial3_gxlk5n.jpg', alt: 'Maquillaje social con brillo', category: 'Editorial' },
  { cloudinaryUrl: 'https://res.cloudinary.com/dcuethtco/image/upload/v1785888012/artistico11_t1mtdu.jpg', alt: 'Maquillaje Artístico', category: 'Artístico' },
  { cloudinaryUrl: 'https://res.cloudinary.com/dcuethtco/image/upload/v1785888013/artistico10_wryxnq.jpg', alt: 'Maquillaje Artístico', category: 'Artístico' },
  { cloudinaryUrl: 'https://res.cloudinary.com/dcuethtco/image/upload/v1785888014/social20_wkfluv.jpg', alt: 'Maquillaje social para evento', category: 'Social' },
  { cloudinaryUrl: 'https://res.cloudinary.com/dcuethtco/image/upload/v1785888013/social10_g51u5k.jpg', alt: 'Maquillaje social para evento', category: 'Social' },
  { cloudinaryUrl: 'https://res.cloudinary.com/dcuethtco/image/upload/v1785888046/social11_s8n04p.jpg', alt: 'Maquillaje social para evento', category: 'Social' },
];

// ------------------------------------------------------------------

async function uploadToStorage(folder, cloudinaryUrl) {
  const response = await fetch(cloudinaryUrl);
  if (!response.ok) {
    throw new Error(`No se pudo descargar ${cloudinaryUrl}: HTTP ${response.status}`);
  }
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await response.arrayBuffer());
  const ext = cloudinaryUrl.split('.').pop().split('?')[0] || 'jpg';
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from('site-media')
    .upload(path, buffer, { contentType, upsert: false });
  if (error) throw new Error(`No se pudo subir ${cloudinaryUrl} a Storage: ${error.message}`);

  const { data } = supabase.storage.from('site-media').getPublicUrl(path);
  return data.publicUrl;
}

async function main() {
  console.log(`Subiendo ${HERO_SLIDES.length} slides del carrusel...`);
  for (const [i, slide] of HERO_SLIDES.entries()) {
    const imageUrl = await uploadToStorage('hero', slide.cloudinaryUrl);
    const { error } = await supabase.from('hero_slides').insert({
      image_url: imageUrl,
      title: slide.title,
      description: slide.description,
      cta_label: slide.ctaLabel,
      cta_href: slide.ctaHref,
      display_order: i,
    });
    if (error) throw new Error(`Insert hero_slides falló: ${error.message}`);
    console.log(`  ✓ ${slide.title}`);
  }

  console.log(`\nSubiendo ${SERVICE_CATEGORIES.length} categorías de servicio...`);
  for (const [i, category] of SERVICE_CATEGORIES.entries()) {
    const imageUrl = await uploadToStorage('services', category.cloudinaryUrl);
    const { data: inserted, error } = await supabase
      .from('service_categories')
      .insert({
        name: category.name,
        description: category.description,
        image_url: imageUrl,
        features: category.features,
        display_order: i,
      })
      .select('id')
      .single();
    if (error) throw new Error(`Insert service_categories falló: ${error.message}`);
    console.log(`  ✓ ${category.name}`);

    const { error: linkError } = await supabase
      .from('services')
      .update({ category_id: inserted.id })
      .eq('name', category.serviceName);
    if (linkError) {
      console.warn(`  ⚠ No se pudo enlazar "${category.serviceName}" a su categoría: ${linkError.message}`);
    }
  }

  console.log(`\nSubiendo ${GALLERY_IMAGES.length} imágenes de galería...`);
  for (const [i, image] of GALLERY_IMAGES.entries()) {
    const imageUrl = await uploadToStorage('gallery', image.cloudinaryUrl);
    const { error } = await supabase.from('gallery_images').insert({
      image_url: imageUrl,
      alt_text: image.alt,
      category: image.category,
      display_order: i,
    });
    if (error) throw new Error(`Insert gallery_images falló: ${error.message}`);
    console.log(`  ✓ ${image.alt}`);
  }

  console.log('\nListo. Verifica /admin/contenido y la home antes de retirar Cloudinary.');
}

main().catch((err) => {
  console.error('\nEl script falló:', err.message);
  process.exit(1);
});
