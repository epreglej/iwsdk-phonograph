import { createComponent } from "@iwsdk/core";

/** Part is being removed from the phonograph (unmount task active). */
export const Unmounting = createComponent("Unmounting", {});

/** Red affordance while a part should be removed. */
export const UNMOUNT_HIGHLIGHT_COLOR: [number, number, number, number] = [
  1, 0.12, 0.08, 0.38,
];
