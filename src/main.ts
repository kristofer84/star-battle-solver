import { createApp } from 'vue';
import App from './App.vue';

import './style.css';

// const shouldEnableEruda = (): boolean => {
//   if (typeof window === 'undefined') return false;
//   if (import.meta.env.DEV) return true;

//   const params = new URLSearchParams(window.location.search);
//   if (params.has('eruda')) return true;

//   return window.location.hostname.endsWith('github.io');
// };

// const initEruda = async (): Promise<void> => {
//   if (!shouldEnableEruda()) return;

//   const eruda = await import('eruda');
//   eruda.default.init();
// };

// void initEruda();

createApp(App).mount('#app');


