import {
  createComponent,
  createSystem,
  eq,
  Grabbed,
  OneHandGrabbable,
  Types,
  Vector3,
  Object3D,
} from "@iwsdk/core";

import { Task, ActiveTask, CompletedTask } from "../task.js";
import { Highlight } from "../utils/highlight.js";
import { PopIn } from "../animations/animation.js";

export const Crank = createComponent("Crank", {
  requiredRotations: {
    type: Types.Float32,
    default: 3,
  },
});

export const CrankingComplete = createComponent("CrankingComplete", {});
export const CrankHeld = createComponent("CrankHeld", {});

export class CrankSystem extends createSystem(
  {
    activeCrankCrankingTask: {
      required: [Task, ActiveTask],
      excluded: [CompletedTask],
      where: [eq(Task, "id", "crank_cranking")],
    },
    crank: {
      required: [Crank],
      excluded: [CrankingComplete],
    },
    crankGrabbed: {
      required: [Crank, Grabbed],
    },
    crankHeld: {
      required: [Crank, CrankHeld],
    },
    crankComplete: {
      required: [Crank, CrankingComplete],
    },
  },
  {
    sensitivity: {
      type: Types.Float32,
      default: 1,
    },
  },
) {
  private _gripWorldPos = new Vector3();
  private _gripLocalPos = new Vector3();
  private _firstFrame = new Map<number, boolean>();
  private _lastAngle = new Map<number, number>();
  private _totalRotation = new Map<number, number>();
  private _pivot = new Map<number, Object3D>();

  init() {
    const [crankEntity] = this.queries.crank.entities;

    this.cleanupFuncs.push(
      this.queries.activeCrankCrankingTask.subscribe("qualify", () => {
        const crankRoot = crankEntity.object3D;
        if (!crankRoot) return;

        crankRoot.visible = true;
        crankEntity.addComponent(PopIn);

        crankEntity
          .addComponent(OneHandGrabbable, {
            translate: false,
            rotate: false,
          })
          .addComponent(Highlight);

        let pivot = crankRoot.getObjectByName("__crankPivot");

        if (!pivot) {
          pivot = new Object3D();
          pivot.name = "__crankPivot";

          while (crankRoot.children.length > 0) {
            pivot.add(crankRoot.children[0]);
          }

          crankRoot.add(pivot);
        }

        this._pivot.set(crankEntity.index, pivot);
        this._totalRotation.set(crankEntity.index, 0);
      }),

      this.queries.activeCrankCrankingTask.subscribe("disqualify", () => {
        crankEntity
          .removeComponent(CrankHeld)
          .removeComponent(OneHandGrabbable)
          .removeComponent(Highlight);

        this._firstFrame.delete(crankEntity.index);
        this._lastAngle.delete(crankEntity.index);
        this._totalRotation.delete(crankEntity.index);
        this._pivot.delete(crankEntity.index);
      }),

      this.queries.crankGrabbed.subscribe("qualify", (entity) => {
        this._firstFrame.set(entity.index, true);
        entity.addComponent(CrankHeld);
      }),

      this.queries.crankGrabbed.subscribe("disqualify", (entity) => {
        this._firstFrame.delete(entity.index);
        this._lastAngle.delete(entity.index);
        entity.removeComponent(CrankHeld);
      }),

      this.queries.crankComplete.subscribe("qualify", () => {
        for (const task of this.queries.activeCrankCrankingTask.entities) {
          task.addComponent(CompletedTask);
        }
      }),
    );
  }

  update() {
    const rightGrip = this.player.gripSpaces.right;
    if (!rightGrip) return;

    rightGrip.getWorldPosition(this._gripWorldPos);

    for (const entity of this.queries.crankHeld.entities) {
      const crankRoot = entity.object3D;

      const pivot = this._pivot.get(entity.index);
      if (!crankRoot || !pivot) continue;

      crankRoot.updateMatrixWorld(true);

      this._gripLocalPos.copy(this._gripWorldPos);
      crankRoot.worldToLocal(this._gripLocalPos);

      const angle = Math.atan2(this._gripLocalPos.z, this._gripLocalPos.y);

      if (this._firstFrame.get(entity.index)) {
        this._firstFrame.set(entity.index, false);
        this._lastAngle.set(entity.index, angle);
        continue;
      }

      const lastAngle = this._lastAngle.get(entity.index) ?? angle;

      let delta = angle - lastAngle;
      if (delta > Math.PI) {
        delta -= Math.PI * 2;
      }
      if (delta < -Math.PI) {
        delta += Math.PI * 2;
      }

      delta *= this.config.sensitivity.peek();

      pivot.rotation.x += delta;

      this._lastAngle.set(entity.index, angle);

      let total = (this._totalRotation.get(entity.index) ?? 0) + delta;

      if (total > 0) {
        total = 0;
      }

      this._totalRotation.set(entity.index, total);

      const required = entity.getValue(Crank, "requiredRotations") ?? 3;

      if (total <= required * -Math.PI * 2) {
        entity
          .removeComponent(CrankHeld)
          .removeComponent(OneHandGrabbable)
          .removeComponent(Highlight)
          .addComponent(CrankingComplete);

        this._firstFrame.delete(entity.index);
        this._lastAngle.delete(entity.index);
        this._totalRotation.delete(entity.index);
        this._pivot.delete(entity.index);
      }
    }
  }
}
