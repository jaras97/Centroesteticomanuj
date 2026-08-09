import { Gift } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatBogotaHuman } from '@/lib/booking/timezone';
import type { LoyaltyStatus } from '@/lib/booking/loyalty';

export default function LoyaltyCard({ status }: { status: LoyaltyStatus }) {
  const progressPercent = Math.round((status.completedSinceLastReward / status.threshold) * 100);
  const availableRewards = status.rewards.filter((r) => !r.used_at);

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-lg font-semibold'>
          <Gift className='h-4 w-4 text-brand-gold' />
          Fidelización
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div>
          <p className='text-sm text-gray-500 mb-2'>
            {status.completedSinceLastReward}/{status.threshold} citas para el próximo cupón
          </p>
          <Progress value={progressPercent} />
        </div>

        {availableRewards.length > 0 && (
          <div className='space-y-1'>
            {availableRewards.map((r) => (
              <Badge key={r.id} variant='success' className='mr-1'>
                {r.discount_percent}% disponible
              </Badge>
            ))}
          </div>
        )}

        {status.rewards.length > 0 && (
          <div>
            <p className='text-xs text-gray-400 mb-1'>Historial de cupones</p>
            <div className='space-y-1'>
              {status.rewards.map((r) => (
                <div key={r.id} className='flex items-center justify-between text-sm'>
                  <span className='text-gray-600'>
                    {r.discount_percent}% · {formatBogotaHuman(r.earned_at)}
                  </span>
                  <Badge variant={r.used_at ? 'secondary' : 'success'}>
                    {r.used_at ? 'Usado' : 'Disponible'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
