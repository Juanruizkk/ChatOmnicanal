'use client';

import BorderGlow from '@/components/reactbits/BorderGlow';

interface GlowButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: 'dark' | 'light';
  className?: string;
  textClassName?: string;
}

// Shared glow config for brand consistency across nav, hero, and plan CTAs
const DARK_CONFIG = {
  backgroundColor: '#0e1116',
  glowColor: '270 80 85',
  colors: ['#c084fc', '#f472b6', '#38bdf8'] as string[],
  glowIntensity: 1.1,
  glowRadius: 28,
  edgeSensitivity: 22,
  coneSpread: 28,
  fillOpacity: 0.35,
};

const LIGHT_CONFIG = {
  backgroundColor: '#ffffff',
  glowColor: '270 70 75',
  colors: ['#a855f7', '#ec4899', '#0ea5e9'] as string[],
  glowIntensity: 0.9,
  glowRadius: 28,
  edgeSensitivity: 22,
  coneSpread: 28,
  fillOpacity: 0.2,
};

export function GlowButton({ href, children, variant = 'dark', className = '', textClassName = '' }: GlowButtonProps) {
  const config = variant === 'dark' ? DARK_CONFIG : LIGHT_CONFIG;

  return (
    <BorderGlow
      {...config}
      borderRadius={9999}
      className={className}
    >
      <a
        href={href}
        className={`block w-full whitespace-nowrap px-5 py-3 text-center text-sm font-medium ${
          variant === 'dark' ? 'text-white' : 'text-ink'
        } ${textClassName}`}
      >
        {children}
      </a>
    </BorderGlow>
  );
}
