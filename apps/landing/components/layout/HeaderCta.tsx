'use client';

import { GlowButton } from '@/components/ui/GlowButton';
import { waLink } from '@/lib/links';

export function HeaderCta() {
  return (
    <GlowButton href={waLink('Hola, quiero saber más sobre el servicio.')} textClassName="px-4 py-2">
      Hablemos
    </GlowButton>
  );
}
