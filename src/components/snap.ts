import { createComponent, Types } from "@iwsdk/core";

export const Snappable = createComponent("Snappable", {
  snapRadius: { type: Types.Float32, default: 0.15 },
  snapPointId: { type: Types.String, default: "" },
});
export const SnapPoint = createComponent("SnapPoint", {
  id: { type: Types.String, default: "" },
});
export const Snapped = createComponent("Snapped", {
  snapPointId: { type: Types.String, default: "" },
});

export const SnapGhost = createComponent("SnapGhost", {});
