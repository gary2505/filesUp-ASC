import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { dispatch } from './qaTaskFlow/runtime/dispatch';
import { cmdBoot } from './qaTaskFlow/core/commands';

const appElement = document.getElementById('app');
if (!appElement) {
  throw new Error('Root element #app not found');
}

const app = mount(App, {
  target: appElement,
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
