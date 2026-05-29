import { createComponent, Types } from "@iwsdk/core";

export const TaskPanel = createComponent("TaskPanel", {
  panelConfig: { type: Types.String, default: "" },
  taskId: { type: Types.String, default: "" },
  maxWidth: { type: Types.Float32, default: 0.35 },
  offsetX: { type: Types.Float32, default: 0 },
  offsetY: { type: Types.Float32, default: 0 },
  offsetZ: { type: Types.Float32, default: 0 },
  faceTarget: { type: Types.Boolean, default: false },
  billboard: { type: Types.Boolean, default: false },
  buttonId: { type: Types.String, default: "" },
  deferCompleteOnDismiss: { type: Types.Boolean, default: false },
});

export const TaskPanelInstance = createComponent("TaskPanelInstance", {
  anchor: { type: Types.Entity, default: null },
  taskId: { type: Types.String, default: "" },
});
