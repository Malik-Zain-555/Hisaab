import React, { useState, useEffect } from 'react';
import { m, AnimatePresence, useReducedMotion } from '../ui/motion';
import { BrandLogo } from '../ui/BrandLogo';

/**
 * Splash screen where the Hisaab coin drops and spins in on a light rounded tile,
 * then reveals the app smoothly (< 400ms per transition phase, transform + opacity only).
 */
export const SplashScreen: React.FC = () => {
  const prefersReduced = useReducedMotion();
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      if (sessionStorage.getItem('hisaab_splash_seen') === '1') {
        return false;
      }
      sessionStorage.setItem('hisaab_splash_seen', '1');
      return true;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      setVisible(false);
    }, prefersReduced ? 120 : 520);
    return () => clearTimeout(timer);
  }, [visible, prefersReduced]);

  return (
    <AnimatePresence>
      {visible && (
        <m.div
          key="hisaab-splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.03 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[140] bg-[#140B29] flex flex-col items-center justify-center gap-4 select-none pointer-events-none"
          aria-hidden="true"
        >
          <m.div
            initial={
              prefersReduced
                ? { opacity: 0 }
                : { opacity: 0, y: -64, rotate: -180, scale: 0.72 }
            }
            animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
            transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
          >
            <BrandLogo size="xl" />
          </m.div>

          <m.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-center"
          >
            <div className="font-heading text-2xl font-extrabold tracking-tight text-[#FFFBF5]">
              Hisaab
            </div>
            <div className="text-xs font-semibold text-[#C8BEE4] mt-0.5">
              Your money, sorted
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
};
