import React from 'react';

export const PERSON_COLORS = [
  '#4338CA', // Indigo
  '#0284C7', // Sky
  '#059669', // Emerald
  '#D97706', // Amber
  '#DB2777', // Pink
  '#7C3AED', // Violet
];

export function getPersonColor(identifier: string): string {
  if (!identifier) return PERSON_COLORS[0];
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PERSON_COLORS.length;
  return PERSON_COLORS[index];
}

export function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface AvatarProps {
  name: string;
  photoURL?: string | null;
  identifier?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  ring?: 'none' | 'green' | 'red';
  statusDot?: 'none' | 'green' | 'red';
  className?: string;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm font-semibold',
  lg: 'w-14 h-14 text-base font-bold',
  xl: 'w-20 h-20 text-xl font-bold',
};

const sizePixels = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

export const Avatar: React.FC<AvatarProps> = React.memo(
  ({
    name,
    photoURL,
    identifier,
    size = 'md',
    ring = 'none',
    statusDot = 'none',
    className = '',
  }) => {
    const bgColor = getPersonColor(identifier || name || 'user');
    const initials = getInitials(name);
    const px = sizePixels[size];

    let ringClass = '';
    if (ring === 'green') {
      ringClass = 'ring-2 ring-[var(--positive)] ring-offset-2 ring-offset-[var(--surface)]';
    } else if (ring === 'red') {
      ringClass = 'ring-2 ring-[var(--negative)] ring-offset-2 ring-offset-[var(--surface)]';
    }

    return (
      <div className="relative inline-flex shrink-0" style={{ width: px, height: px }}>
        <div
          className={`relative inline-flex items-center justify-center rounded-full shrink-0 select-none overflow-hidden font-semibold text-white ${sizeClasses[size]} ${ringClass} ${className}`}
          style={{ backgroundColor: photoURL ? undefined : bgColor, width: px, height: px }}
          title={name}
        >
          {photoURL ? (
            <img
              src={photoURL}
              alt={name}
              width={px}
              height={px}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover rounded-full block"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        {statusDot !== 'none' && (
          <span
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-[var(--surface)] ${
              statusDot === 'green' ? 'bg-[var(--positive)]' : 'bg-[var(--negative)]'
            }`}
          />
        )}
      </div>
    );
  }
);
Avatar.displayName = 'Avatar';
