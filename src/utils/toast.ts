/**
 * This is src/lib/utils/toast.ts
 * Used by: Tab1Layout.svelte
 * Purpose: Toast notification system with auto-removal
 * Trigger: Called to show user notifications
 * Event Flow: Adds toast to store, sets timer for removal
 * List of functions: addToast, updateToast, toast object
 */

import { writable } from 'svelte/store';

export type ToastKind = 'success' | 'error' | 'info' | 'warning' | 'copy';
export type Toast = {
  id: number;
  kind: ToastKind;
  message: string;
  duration: number; // ms
  timerId?: any; // for canceling auto-removal
};

let _id = 1;
export const toasts = writable<Toast[]>([]);

export function addToast(kind: ToastKind, message: string, duration = 3500): number {
  const id = _id++;
  const timerId = setTimeout(() => {
    toasts.update((arr) => arr.filter((x) => x.id !== id));
  }, duration);
  const t: Toast = { id, kind, message, duration, timerId };
  toasts.update((arr) => [...arr, t]);
  return id;
}

export function updateToast(id: number, kind: ToastKind, message: string, duration?: number): void {
  toasts.update((arr) => {
    const idx = arr.findIndex((x) => x.id === id);
    if (idx === -1) return arr;
    const old = arr[idx];
    // Clear old timer if exists
    if (old.timerId) clearTimeout(old.timerId);
    // Set new timer if duration provided
    let timerId: any = old.timerId;
    if (duration !== undefined) {
      timerId = setTimeout(() => {
        toasts.update((a) => a.filter((x) => x.id !== id));
      }, duration);
    }
    const updated = { ...old, kind, message, duration: duration ?? old.duration, timerId };
    return [...arr.slice(0, idx), updated, ...arr.slice(idx + 1)];
  });
}

export const toast = {
  success: (m: string, d?: number) => addToast('success', m, d),
  error:   (m: string, d?: number) => addToast('error', m, d ?? 6000),
  info:    (m: string, d?: number) => addToast('info', m, d),
  warn:    (m: string, d?: number) => addToast('warning', m, d),
  copy:    (m: string, d?: number) => addToast('copy', m, d ?? 2000),
  update:  (id: number, kind: ToastKind, message: string, duration?: number) => updateToast(id, kind, message, duration),
  remove:  (id: number) => toasts.update((arr) => arr.filter((x) => x.id !== id)),
  removeKind: (kind: ToastKind) => toasts.update((arr) => {
    arr.forEach((toast) => {
      if (toast.kind === kind && toast.timerId) {
        clearTimeout(toast.timerId);
      }
    });
    return arr.filter((toast) => toast.kind !== kind);
  }),
};
