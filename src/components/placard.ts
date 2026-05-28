import { createComponent, Types } from "@iwsdk/core";

export const Placard = createComponent("Placard", {
  panelConfig: { type: Types.String, default: "" },
  offsetX: { type: Types.Float32, default: 0 },
  offsetY: { type: Types.Float32, default: 0 },
  offsetZ: { type: Types.Float32, default: 0 },
  dismissOnGrab: { type: Types.Boolean, default: false },
  dismissOnSnap: { type: Types.Boolean, default: true },
  autoDismissMs: { type: Types.Float32, default: 0 },
});

export const PlacardDismissed = createComponent("PlacardDismissed", {});

export const PlacardInstance = createComponent("PlacardInstance", {
  target: { type: Types.Entity, default: null },
});
