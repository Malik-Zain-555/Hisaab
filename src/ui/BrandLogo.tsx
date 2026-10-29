import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP = {
  sm: { box: 34, img: 26, radius: 'rounded-[11px]' },
  md: { box: 42, img: 32, radius: 'rounded-[13px]' },
  lg: { box: 56, img: 44, radius: 'rounded-[17px]' },
  xl: { box: 76, img: 60, radius: 'rounded-[22px]' },
};

/**
 * Displays the Hisaab coin logo from /public on a crisp light rounded tile
 * so it stands out cleanly on dark backgrounds.
 */
export const BrandLogo: React.FC<BrandLogoProps> = React.memo(({ size = 'sm', className = '' }) => {
  const s = SIZE_MAP[size];

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 select-none bg-[#FFFDF9] border border-white/80 shadow-[0_6px_18px_rgba(0,0,0,0.28)] ${s.radius} ${className}`}
      style={{ width: s.box, height: s.box }}
    >
      <img
        src="/icon.svg"
        alt="Hisaab Logo"
        width={s.img}
        height={s.img}
        decoding="async"
        className="object-contain block"
        onError={(e) => {
          const target = e.currentTarget;
          if (!target.src.endsWith('/icon-192.png')) {
            target.src = '/icon-192.png';
          }
        }}
      />
    </span>
  );
});
BrandLogo.displayName = 'BrandLogo';
