// Cached references to the chrome elements, plus a tiny assert helper.

export const browserContent = document.querySelector<HTMLElement>("#browser-content");
export const browserChrome = document.querySelector<HTMLElement>("#browser-chrome");
export const addressForm = document.querySelector<HTMLFormElement>("#address-form");
export const addressInput = document.querySelector<HTMLInputElement>("#address-input");
export const addressLockButton = document.querySelector<HTMLButtonElement>("#address-lock");
export const stagePlaceholder = document.querySelector<HTMLElement>("#stage-placeholder");
export const toast = document.querySelector<HTMLElement>("#toast");
export const backButton = document.querySelector<HTMLButtonElement>("#go-back");
export const forwardButton = document.querySelector<HTMLButtonElement>("#go-forward");
export const reloadButton = document.querySelector<HTMLButtonElement>("#reload-page");
export const captureButton = document.querySelector<HTMLButtonElement>("#capture-shot");
export const fullPageButton = document.querySelector<HTMLButtonElement>("#capture-fullpage");
export const closeButton = document.querySelector<HTMLButtonElement>("#close-window");
export const minimizeButton = document.querySelector<HTMLButtonElement>("#minimize-window");
export const maximizeButton = document.querySelector<HTMLButtonElement>("#maximize-window");
export const presetButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-preset]")];
export const sizeMenu = document.querySelector<HTMLElement>(".size-menu");
export const sizeToggle = document.querySelector<HTMLButtonElement>("#size-toggle");
export const sizePopover = document.querySelector<HTMLElement>("#size-popover");
export const sizeChips = [...document.querySelectorAll<HTMLButtonElement>(".size-chip")];
export const sizeCustomForm = document.querySelector<HTMLFormElement>("#size-custom-form");
export const sizeWInput = document.querySelector<HTMLInputElement>("#size-w");
export const sizeHInput = document.querySelector<HTMLInputElement>("#size-h");

export function assertElement<T extends Element>(element: T | null, name: string): T {
  if (!element) {
    throw new Error(`Missing UI element: ${name}`);
  }

  return element;
}
