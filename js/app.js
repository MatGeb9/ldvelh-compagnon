import { attachEvents } from './events.js';

document.addEventListener('DOMContentLoaded', () => {
  attachEvents();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .catch(err => console.warn('SW register failed:', err));
  });
}
