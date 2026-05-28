import { createComponent, Types } from "@iwsdk/core";

export const MountTaskBinding = createComponent("MountTaskBinding", {
  taskId: { type: Types.String, default: "" },
  snapPointId: { type: Types.String, default: "" },
});
