import { writable } from 'svelte/store';

export const isApiKeysPopupVisible = writable(false);

export function showApiKeysPopup() {
    isApiKeysPopupVisible.set(true);
}

export function hideApiKeysPopup() {
    isApiKeysPopupVisible.set(false);
}

export function toggleApiKeysPopup() {
    isApiKeysPopupVisible.update(value => !value);
} 