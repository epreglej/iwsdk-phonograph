import { createComponent } from "@iwsdk/core";

/** Part is being removed from the phonograph (unmount task active). */
export const Unmounting = createComponent("Unmounting", {});

/** Pop-out animation started — blocks repeat unmount until task completes. */
export const UnmountPopping = createComponent("UnmountPopping", {});

/** Red affordance while a part should be removed. */
export const UNMOUNT_HIGHLIGHT_COLOR: [number, number, number, number] = [
  1, 0.12, 0.08, 0.38,
];
