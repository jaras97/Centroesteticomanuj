-- Fase CMS 3 — configuración del sitio: marca (logo, contacto, redes) y
-- contenido "Sobre nosotros" / Misión-Visión. Aditiva. Ver
-- docs/PRD-cms-contenido-y-promociones.md.
-- Pegar y correr completo en el SQL Editor de Supabase Studio.

-- Tabla singleton: "id boolean primary key default true" + check(id) es el
-- truco estándar de Postgres para garantizar que solo pueda existir UNA fila
-- (id solo puede ser true, y true es la PK, así que un segundo insert
-- choca contra la PK). No hay "cuál fila" que elegir — siempre es la misma.
create table if not exists public.site_settings (
  id                   boolean primary key default true,
  logo_url             text,
  phone_display        text,
  whatsapp_number      text,
  email                text,
  address              text,
  instagram_url        text,
  facebook_url         text,
  footer_tagline       text,
  about_intro          text,
  founder_name         text,
  founder_bio          text,
  founder_roles        jsonb not null default '[]',
  founder_image_url_1  text,
  founder_image_url_2  text,
  mission_text         text,
  vision_text          text,
  updated_at           timestamptz not null default now(),
  constraint site_settings_singleton check (id)
);

alter table public.site_settings enable row level security;

-- Lectura pública sin condición (a diferencia de hero_slides/gallery_images,
-- no hay noción de "activo" — es la única fila y siempre aplica).
create policy "public_read" on public.site_settings
  for select to anon, authenticated using (true);
create policy "admin_full_access" on public.site_settings
  for all to authenticated using (true) with check (true);

drop trigger if exists set_updated_at on public.site_settings;
create trigger set_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();

-- Seed con el contenido actualmente hardcodeado (evita que el sitio quede
-- en blanco al cambiar los componentes a leer de esta tabla). Las imágenes
-- siguen en Cloudinary por ahora — Manu las puede reemplazar cuando quiera
-- desde /admin/contenido, que sí sube a Supabase Storage.
insert into public.site_settings (
  id, logo_url, phone_display, whatsapp_number, email, address,
  instagram_url, facebook_url, footer_tagline, about_intro,
  founder_name, founder_bio, founder_roles,
  founder_image_url_1, founder_image_url_2,
  mission_text, vision_text
) values (
  true,
  'https://res.cloudinary.com/dcuethtco/image/upload/v1754769881/isologo_dhkiyh.svg',
  '+57 (321) 548-7690',
  '+573215487690',
  'centroesteticomanuj@gmail.com',
  'Chigorodo, Ant',
  'https://www.instagram.com/centroestetico_manuj?igsh=cmRoaWd3aXljYjE%3D&utm_source=qr',
  'https://www.facebook.com/share/16NsUkTiZN/?mibextid=wwXIfr',
  '"Más que un servicio, te brindo una experiencia"',
  'En nuestro centro estético realzamos la belleza única de cada persona a través de técnicas innovadoras de maquillaje y cosmetología, fusionando arte, ciencia y cuidado personalizado. Brindamos experiencias transformadoras que inspiran confianza, elevan la autoestima y promueven el bienestar integral. Nos destacamos por la excelencia profesional, el uso de productos de alta calidad y la pasión creativa que nos impulsa a ser tu primera elección en estética, fomentando una belleza saludable y responsable.',
  'Manuela Jaramillo',
  'Soy cosmetóloga y maquilladora profesional, apasionada por el cuidado de la piel y el arte del maquillaje. Cuento con experiencia y formación en tratamientos faciales, maquillaje social, para novias, quinceañeras, editorial y artístico. Mi compromiso es realzar la belleza natural de cada cliente a través de un servicio personalizado, técnicas actualizadas y una experiencia diseñada para brindar confianza, bienestar y resultados de alta calidad.',
  '["Fundadora", "Maquilladora profesional", "Especialista en maquillaje artístico", "Tratamientos faciales"]'::jsonb,
  'https://res.cloudinary.com/dcuethtco/image/upload/v1754769847/fundadora_gkqr4q.jpg',
  'https://res.cloudinary.com/dcuethtco/image/upload/v1754769846/fundadora2_quuwz2.jpg',
  'Crear experiencias de belleza y bienestar que permitan a cada persona redescubrir la mejor versión de sí misma, a través de tratamientos estéticos y maquillaje profesional realizados con conocimiento, dedicación y altos estándares de calidad. Nuestro propósito es que cada cliente no solo vea un cambio en el espejo, sino que también se sienta más segura, cuidada y confiada al salir de nuestro espacio.',
  'Ser un centro estético reconocido por transformar la belleza en una experiencia de confianza, innovación y bienestar, destacándonos por la calidad humana, la actualización constante y la excelencia en cada servicio. Aspiramos a convertirnos en un referente en la región, donde cada persona encuentre un lugar que inspire cuidado, autoestima y resultados que superen sus expectativas.'
)
on conflict (id) do nothing;
