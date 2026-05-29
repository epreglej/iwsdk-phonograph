import {
  createSystem,
  Entity,
  Grabbed,
  OneHandGrabbable,
  Vector3,
} from "@iwsdk/core";
import { Snappable, SnapPoint, Snapped } from "../components/snap.js";
import { SnapAnimation } from "../components/animation.js";
import { playSnap } from "../audio/sfx.js";
import { Unmounting } from "../components/unmounting.js";

export class SnapSystem extends createSystem({
  snappables: {
    required: [Snappable],
    excluded: [Snapped, Grabbed, Unmounting],
  },
  snappedAndGrabbed: { required: [Snappable, Snapped, Grabbed] },
  snapPoints: { required: [SnapPoint] },
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

    playSnap();
  }
}
