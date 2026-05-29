import { createComponent, Types } from "@iwsdk/core";

export const Unmounting = createComponent("Unmounting", {
  taskId: { type: Types.String, default: "" },
});

export const UnmountPopping = createComponent("UnmountPopping", {});
