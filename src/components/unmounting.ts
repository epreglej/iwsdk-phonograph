import { createComponent, Types } from "@iwsdk/core";

export const Unmounting = createComponent("Unmounting", {
  taskId: { type: Types.String, default: "" },
});

export const UnmountPopping = createComponent("UnmountPopping", {});

export const UNMOUNT_HIGHLIGHT_COLOR: [number, number, number, number] = [
  1, 0.12, 0.08, 0.38,
];
