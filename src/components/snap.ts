import { createComponent, Entity, Types } from "@iwsdk/core";

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
export const TrackSnapZone = createComponent("TrackSnapZone", {});
export const InSnapZone = createComponent("InSnapZone", {});

export function findSnapPointById(
  snapPoints: Iterable<Entity>,
  id: string,
): Entity | undefined {
  for (const point of snapPoints) {
    if (point.getValue(SnapPoint, "id") === id) return point;
  }
  return undefined;
}
