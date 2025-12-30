import './app.css';
import App from './App.svelte';
import { dispatch } from './taskFlow/runtime/dispatch';
import { cmdBoot } from './taskFlow/core/commands';

const app = new App({
  target: document.getElementById('app') as HTMLElement,
});

// HMR guard: prevent running boot twice during hot reload
// Why: Vite HMR would re-execute this module, causing duplicate boot flows.
let bootExecuted = false;

// Startup: dispatch Boot command ONCE
if (!bootExecuted) {
  bootExecuted = true;
  
  // Run boot flow on app startup
  // Why: Generates initial bundle evidence proving app started correctly.
  dispatch(cmdBoot({ appVersion: '0.0.1' }))
    .catch(err => {
      console.error('Boot dispatch failed:', err);
    });
}

export default app;
