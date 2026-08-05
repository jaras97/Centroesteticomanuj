'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError('Correo o contraseña incorrectos.');
      return;
    }

    router.push('/admin');
    router.refresh();
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-sand/10 to-white px-4'>
      <div className='w-full max-w-sm bg-white rounded-lg border shadow-sm p-8'>
        <h1 className='text-xl font-bold text-brand-ink mb-6 text-center'>
          Panel administrativo
        </h1>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='email'>Correo</Label>
            <Input
              id='email'
              type='email'
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='password'>Contraseña</Label>
            <Input
              id='password'
              type='password'
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className='text-sm font-medium text-destructive'>{error}</p>}
          <Button type='submit' className='w-full' disabled={loading}>
            {loading && <Loader2 className='h-4 w-4 animate-spin' />}
            Iniciar sesión
          </Button>
        </form>
      </div>
    </div>
  );
}
