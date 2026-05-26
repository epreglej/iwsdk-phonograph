import {
  createComponent,
  createSystem,
  Entity,
  Grabbed,
  OneHandGrabbable,
  Quaternion,
  Types,
  Vector3,
} from "@iwsdk/core";
import { SnapAnimation } from "../animations/animation.js";

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
/** Opt in — SnapSystem maintains InSnapZone enter/leave on this entity. */
export const TrackSnapZone = createComponent("TrackSnapZone", {});
export const InSnapZone = createComponent("InSnapZone", {});

export class SnapSystem extends createSystem({
  snappables: { required: [Snappable], excluded: [Snapped, Grabbed] },
  snappedAndGrabbed: { required: [Snappable, Snapped, Grabbed] },
  snapPoints: { required: [SnapPoint] },
  zoneTracked: { required: [Snappable, TrackSnapZone] },
}) {
  private _pos1!: Vector3;
  private _pos2!: Vector3;

  init() {
    this._pos1 = new Vector3();
    this._pos2 = new Vector3();

    this.cleanupFuncs.push(
      this.queries.snappables.subscribe("qualify", (entity) => {
        this.trySnap(entity);
      }),
      this.queries.snappedAndGrabbed.subscribe("qualify", (entity) => {
        this.unsnap(entity);
      }),
    );
  }

  private unsnap(entity: Entity) {
    entity.removeComponent(Snapped);
    entity.removeComponent(SnapAnimation);
    entity.addComponent(OneHandGrabbable);
  }

  private trySnap(entity: Entity) {
    const snapRadius = entity.getValue(Snappable, "snapRadius")!;
    const targetId = entity.getValue(Snappable, "snapPointId");

    entity.object3D!.getWorldPosition(this._pos1);

    for (const point of this.queries.snapPoints.entities) {
      const pointId = point.getValue(SnapPoint, "id");
      if (targetId && pointId !== targetId) continue;

      point.object3D!.getWorldPosition(this._pos2);

      if (this._pos1.distanceTo(this._pos2) < snapRadius) {
        this.executeSnap(entity, point);
        return;
      }
    }
  }

  private executeSnap(entity: Entity, point: Entity) {
    const targetPos = point.object3D!.position;
    const targetQuat = point.object3D!.quaternion;

    entity.removeComponent(OneHandGrabbable);
    entity.addComponent(Snapped, {
      snapPointId: point.getValue(SnapPoint, "id")!,
    });
    entity.addComponent(SnapAnimation, {
      targetX: targetPos.x,
      targetY: targetPos.y,
      targetZ: targetPos.z,
      targetQX: targetQuat.x,
      targetQY: targetQuat.y,
      targetQZ: targetQuat.z,
      targetQW: targetQuat.w,
      duration: 300,
    });
  }

  update() {
    for (const entity of this.queries.zoneTracked.entities) {
      if (this.isWithinSnapZone(entity)) {
        if (!entity.hasComponent(InSnapZone)) {
          entity.addComponent(InSnapZone);
        }
      } else if (entity.hasComponent(InSnapZone)) {
        entity.removeComponent(InSnapZone);
      }
    }
  }

  private isWithinSnapZone(entity: Entity): boolean {
    const snapRadius = entity.getValue(Snappable, "snapRadius")!;
    const targetId = entity.getValue(Snappable, "snapPointId");
    if (!targetId) return false;

    entity.object3D!.getWorldPosition(this._pos1);

    for (const point of this.queries.snapPoints.entities) {
      if (point.getValue(SnapPoint, "id") !== targetId) continue;

      point.object3D!.getWorldPosition(this._pos2);
      return this._pos1.distanceTo(this._pos2) < snapRadius;
    }

    return false;
  }
}
