import {
  createSystem,
  Entity,
  PanelDocument,
  Quaternion,
  UIKit,
  UIKitDocument,
  Vector3,
} from "@iwsdk/core";
import {
  PopIn,
  PopIn2D,
  PopOut,
  PopOut2D,
  Spin,
  SnapAnimation,
} from "../components/animation.js";

const POP_IN_MS = 700;
const POP_OUT_MS = 550;
const SPIN_PERIOD_MS = 1000;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeInCubic = (t: number) => t * t * t;
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

type PopComponent =
  | typeof PopIn
  | typeof PopOut
  | typeof PopIn2D
  | typeof PopOut2D;

export class AnimationSystem extends createSystem({
  popIn: { required: [PopIn] },
  popIn2D: { required: [PopIn2D] },
  popOut: { required: [PopOut] },
  popOut2D: { required: [PopOut2D] },
  spin: { required: [Spin] },
  snapAnimation: { required: [SnapAnimation] },
}) {
  private fromPos!: Vector3;
  private toPos!: Vector3;
  private fromQuat!: Quaternion;
  private toQuat!: Quaternion;
  private finished: Entity[] = [];

  init() {
    this.fromPos = new Vector3();
    this.toPos = new Vector3();
    this.fromQuat = new Quaternion();
    this.toQuat = new Quaternion();

    const resetPop = (entity: Entity, component: PopComponent) => {
      entity.setValue(component, "elapsed", 0);
      entity.setValue(component, "from", -1);
    };
    this.cleanupFuncs.push(
      this.queries.popIn.subscribe("qualify", (e) => resetPop(e, PopIn)),
      this.queries.popOut.subscribe("qualify", (e) => resetPop(e, PopOut)),
      this.queries.popIn2D.subscribe("qualify", (e) => resetPop(e, PopIn2D)),
      this.queries.popOut2D.subscribe("qualify", (e) => resetPop(e, PopOut2D)),
      this.queries.snapAnimation.subscribe("qualify", (e) => {
        e.setValue(SnapAnimation, "started", false);
        e.setValue(SnapAnimation, "elapsed", 0);
      }),
    );
  }

  update(delta: number) {
    const dtMs = delta * 1000;

    this.advancePop3D(this.queries.popIn.entities, PopIn, 1, POP_IN_MS, easeOutCubic, dtMs);
    this.advancePop3D(this.queries.popOut.entities, PopOut, 0.001, POP_OUT_MS, easeInCubic, dtMs);
    this.advancePop2D(this.queries.popIn2D.entities, PopIn2D, 1, POP_IN_MS, easeOutCubic, dtMs);
    this.advancePop2D(this.queries.popOut2D.entities, PopOut2D, 0.001, POP_OUT_MS, easeInCubic, dtMs);
    this.advanceSpin(dtMs);
    this.advanceSnap(dtMs);
  }

  private advancePop3D(
    entities: Iterable<Entity>,
    component: PopComponent,
    target: number,
    durationMs: number,
    easing: (t: number) => number,
    dtMs: number,
  ): void {
    this.finished.length = 0;
    for (const entity of entities) {
      const obj = entity.object3D;
      if (!obj) continue;

      let from = entity.getValue(component, "from")!;
      if (from < 0) {
        from = obj.scale.x;
        entity.setValue(component, "from", from);
      }

      const elapsed = entity.getValue(component, "elapsed")! + dtMs;
      const t = Math.min(elapsed / durationMs, 1);
      obj.scale.setScalar(from + (target - from) * easing(t));

      if (t >= 1) this.finished.push(entity);
      else entity.setValue(component, "elapsed", elapsed);
    }
    for (const entity of this.finished) entity.removeComponent(component);
  }

  private advancePop2D(
    entities: Iterable<Entity>,
    component: PopComponent,
    target: number,
    durationMs: number,
    easing: (t: number) => number,
    dtMs: number,
  ): void {
    this.finished.length = 0;
    for (const entity of entities) {
      const root = this.panelRoot(entity);
      if (!root) continue;

      let from = entity.getValue(component, "from")!;
      if (from < 0) {
        from = root.scale.x;
        entity.setValue(component, "from", from);
      }

      const elapsed = entity.getValue(component, "elapsed")! + dtMs;
      const t = Math.min(elapsed / durationMs, 1);
      root.scale.setScalar(from + (target - from) * easing(t));

      if (t >= 1) this.finished.push(entity);
      else entity.setValue(component, "elapsed", elapsed);
    }
    for (const entity of this.finished) entity.removeComponent(component);
  }

  private advanceSpin(dtMs: number): void {
    const step = (Math.PI * 2 * dtMs) / SPIN_PERIOD_MS;
    for (const entity of this.queries.spin.entities) {
      if (entity.object3D) entity.object3D.rotation.x += step;
    }
  }

  private advanceSnap(dtMs: number): void {
    this.finished.length = 0;
    for (const entity of this.queries.snapAnimation.entities) {
      const obj = entity.object3D;
      if (!obj) continue;

      if (!entity.getValue(SnapAnimation, "started")) {
        entity.setValue(SnapAnimation, "started", true);
        entity.setValue(SnapAnimation, "elapsed", 0);
        entity.setValue(SnapAnimation, "fromX", obj.position.x);
        entity.setValue(SnapAnimation, "fromY", obj.position.y);
        entity.setValue(SnapAnimation, "fromZ", obj.position.z);
        entity.setValue(SnapAnimation, "fromQX", obj.quaternion.x);
        entity.setValue(SnapAnimation, "fromQY", obj.quaternion.y);
        entity.setValue(SnapAnimation, "fromQZ", obj.quaternion.z);
        entity.setValue(SnapAnimation, "fromQW", obj.quaternion.w);
      }

      const duration = entity.getValue(SnapAnimation, "duration")!;
      const elapsed = entity.getValue(SnapAnimation, "elapsed")! + dtMs;
      const t = Math.min(elapsed / duration, 1);
      const eased = easeOutBack(t);

      this.fromPos.set(
        entity.getValue(SnapAnimation, "fromX")!,
        entity.getValue(SnapAnimation, "fromY")!,
        entity.getValue(SnapAnimation, "fromZ")!,
      );
      this.toPos.set(
        entity.getValue(SnapAnimation, "targetX")!,
        entity.getValue(SnapAnimation, "targetY")!,
        entity.getValue(SnapAnimation, "targetZ")!,
      );
      this.fromQuat.set(
        entity.getValue(SnapAnimation, "fromQX")!,
        entity.getValue(SnapAnimation, "fromQY")!,
        entity.getValue(SnapAnimation, "fromQZ")!,
        entity.getValue(SnapAnimation, "fromQW")!,
      );
      this.toQuat.set(
        entity.getValue(SnapAnimation, "targetQX")!,
        entity.getValue(SnapAnimation, "targetQY")!,
        entity.getValue(SnapAnimation, "targetQZ")!,
        entity.getValue(SnapAnimation, "targetQW")!,
      );

      obj.position.lerpVectors(this.fromPos, this.toPos, eased);
      obj.quaternion.slerpQuaternions(this.fromQuat, this.toQuat, eased);

      if (t >= 1) {
        obj.position.copy(this.toPos);
        obj.quaternion.copy(this.toQuat);
        this.finished.push(entity);
      } else {
        entity.setValue(SnapAnimation, "elapsed", elapsed);
      }
    }
    for (const entity of this.finished) entity.removeComponent(SnapAnimation);
  }

  private panelRoot(entity: Entity): UIKit.Component | undefined {
    const doc = entity.getValue(PanelDocument, "document") as
      | UIKitDocument
      | null;
    return doc?.getElementById("panel-root") as UIKit.Component | undefined;
  }
}
