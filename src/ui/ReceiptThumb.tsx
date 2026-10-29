import React, { useState, useEffect } from 'react';
import { createThumbnailFromDataUrl } from '../lib/mediaUtils';

interface ReceiptThumbProps {
  src: string;
  alt?: string;
  size?: number;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export const ReceiptThumb: React.FC<ReceiptThumbProps> = React.memo(
  ({ src, alt = 'Receipt proof', size = 36, className = '', onClick }) => {
    const [thumbSrc, setThumbSrc] = useState<string>(src);

    useEffect(() => {
      let active = true;
      createThumbnailFromDataUrl(src, size * 2, 0.6).then((smallUrl) => {
        if (active) setThumbSrc(smallUrl);
      });
      return () => {
        active = false;
      };
    }, [src, size]);

    return (
      <button
        type="button"
        onClick={onClick}
        style={{ width: size, height: size }}
        className={`relative rounded-[10px] overflow-hidden border border-[var(--line)] bg-[var(--surface-2)] shrink-0 active-press cursor-pointer ${className}`}
        title="View receipt proof"
      >
        <img
          src={thumbSrc}
          alt={alt}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover block"
        />
      </button>
    );
  }
);
ReceiptThumb.displayName = 'ReceiptThumb';
