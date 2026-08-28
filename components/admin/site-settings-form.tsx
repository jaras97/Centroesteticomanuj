'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import ImageUpload from '@/components/admin/image-upload';
import { updateSiteSettings } from '@/app/admin/(dashboard)/actions';
import type { SiteSettings } from '@/lib/supabase/types';

export default function SiteSettingsForm({ settings }: { settings: SiteSettings }) {
  const [logoUrl, setLogoUrl] = useState(settings.logo_url ?? '');
  const [phoneDisplay, setPhoneDisplay] = useState(settings.phone_display ?? '');
  const [whatsappNumber, setWhatsappNumber] = useState(settings.whatsapp_number ?? '');
  const [email, setEmail] = useState(settings.email ?? '');
  const [address, setAddress] = useState(settings.address ?? '');
  const [instagramUrl, setInstagramUrl] = useState(settings.instagram_url ?? '');
  const [facebookUrl, setFacebookUrl] = useState(settings.facebook_url ?? '');
  const [footerTagline, setFooterTagline] = useState(settings.footer_tagline ?? '');

  const [aboutIntro, setAboutIntro] = useState(settings.about_intro ?? '');
  const [founderName, setFounderName] = useState(settings.founder_name ?? '');
  const [founderBio, setFounderBio] = useState(settings.founder_bio ?? '');
  const [founderRolesText, setFounderRolesText] = useState(settings.founder_roles.join('\n'));
  const [founderImageUrl1, setFounderImageUrl1] = useState(settings.founder_image_url_1 ?? '');
  const [founderImageUrl2, setFounderImageUrl2] = useState(settings.founder_image_url_2 ?? '');

  const [missionText, setMissionText] = useState(settings.mission_text ?? '');
  const [visionText, setVisionText] = useState(settings.vision_text ?? '');

  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const result = await updateSiteSettings({
        logoUrl: logoUrl || null,
        phoneDisplay: phoneDisplay || null,
        whatsappNumber: whatsappNumber || null,
        email: email || null,
        address: address || null,
        instagramUrl: instagramUrl || null,
        facebookUrl: facebookUrl || null,
        footerTagline: footerTagline || null,
        aboutIntro: aboutIntro || null,
        founderName: founderName || null,
        founderBio: founderBio || null,
        founderRoles: founderRolesText.split('\n'),
        founderImageUrl1: founderImageUrl1 || null,
        founderImageUrl2: founderImageUrl2 || null,
        missionText: missionText || null,
        visionText: visionText || null,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Configuración guardada.');
    });
  }

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle className='text-lg'>Marca y contacto</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <Label>Logo</Label>
            <ImageUpload folder='site' value={logoUrl} onChange={setLogoUrl} />
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-2'>
              <Label htmlFor='settings-phone'>Teléfono (como se muestra)</Label>
              <Input
                id='settings-phone'
                placeholder='+57 (321) 548-7690'
                value={phoneDisplay}
                onChange={(e) => setPhoneDisplay(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='settings-whatsapp'>Número de WhatsApp</Label>
              <Input
                id='settings-whatsapp'
                placeholder='+573215487690'
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
              />
              <p className='text-xs text-gray-500'>Con indicativo de país, sin espacios.</p>
            </div>
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-2'>
              <Label htmlFor='settings-email'>Email</Label>
              <Input id='settings-email' value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='settings-address'>Dirección</Label>
              <Input
                id='settings-address'
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-2'>
              <Label htmlFor='settings-instagram'>Instagram (link completo)</Label>
              <Input
                id='settings-instagram'
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='settings-facebook'>Facebook (link completo)</Label>
              <Input
                id='settings-facebook'
                value={facebookUrl}
                onChange={(e) => setFacebookUrl(e.target.value)}
              />
            </div>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='settings-tagline'>Frase del pie de página</Label>
            <Input
              id='settings-tagline'
              placeholder='"Más que un servicio, te brindo una experiencia"'
              value={footerTagline}
              onChange={(e) => setFooterTagline(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-lg'>Sobre nosotros</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='settings-about-intro'>Texto de introducción</Label>
            <Textarea
              id='settings-about-intro'
              value={aboutIntro}
              onChange={(e) => setAboutIntro(e.target.value)}
              rows={3}
            />
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='relative space-y-2'>
              <Label>Foto de la fundadora 1</Label>
              <ImageUpload folder='site' value={founderImageUrl1} onChange={setFounderImageUrl1} />
            </div>
            <div className='space-y-2'>
              <Label>Foto de la fundadora 2</Label>
              <ImageUpload folder='site' value={founderImageUrl2} onChange={setFounderImageUrl2} />
            </div>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='settings-founder-name'>Nombre de la fundadora</Label>
            <Input
              id='settings-founder-name'
              value={founderName}
              onChange={(e) => setFounderName(e.target.value)}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='settings-founder-roles'>Etiquetas (una por línea)</Label>
            <Textarea
              id='settings-founder-roles'
              value={founderRolesText}
              onChange={(e) => setFounderRolesText(e.target.value)}
              placeholder={'Fundadora\nMaquilladora profesional'}
              rows={4}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='settings-founder-bio'>Biografía</Label>
            <Textarea
              id='settings-founder-bio'
              value={founderBio}
              onChange={(e) => setFounderBio(e.target.value)}
              rows={5}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-lg'>Misión y visión</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='settings-mission'>Misión</Label>
            <Textarea
              id='settings-mission'
              value={missionText}
              onChange={(e) => setMissionText(e.target.value)}
              rows={4}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='settings-vision'>Visión</Label>
            <Textarea
              id='settings-vision'
              value={visionText}
              onChange={(e) => setVisionText(e.target.value)}
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <div className='flex justify-end'>
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending && <Loader2 className='h-4 w-4 animate-spin' />}
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
