import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Gracefully silence Vite development WebSocket disconnections in hosted environment
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const msg = typeof reason === 'string' ? reason : reason?.message || '';
  if (msg.includes('WebSocket') || msg.includes('websocket') || msg.includes('failed to connect')) {
    event.preventDefault();
  }
});
window.addEventListener('error', (event) => {
  const msg = event.message || '';
  if (msg.includes('WebSocket') || msg.includes('websocket') || msg.includes('failed to connect')) {
    event.preventDefault();
  }
});

// Detect low-end devices or prefers-reduced-motion to switch to simple glass style
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const nav = navigator as any;
  const isLowEnd =
    (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4) ||
    (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4) ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (isLowEnd) {
    document.body.classList.add('low-end');
  }

  // Pause background & ambient CSS effects when tab is hidden
  const handleVisibility = () => {
    document.body.classList.toggle('tab-hidden', document.hidden);
  };
  document.addEventListener('visibilitychange', handleVisibility);
}

createRoot(document.getElementById('root')!).render(<App />);
