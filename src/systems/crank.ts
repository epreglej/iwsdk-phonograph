import {
  createSystem,
  eq,
  Grabbed,
  OneHandGrabbable,
  Types,
  Vector3,
  Object3D,
} from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../components/task.js";
import { Crank, CrankingComplete, CrankHeld } from "../components/phonograph.js";
import { CrankRotation } from "../components/crank-rotation.js";
import { Highlight } from "../components/highlight.js";
import { PopIn } from "../components/animation.js";
import { playCrankTick } from "../audio/sfx.js";
import { firstEntity } from "../helpers/entity-query.js";

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
      required: [Crank, CrankHeld, CrankRotation],
    },
    crankComplete: {
      required: [Crank, CrankingComplete],
    },
  },
  {
    sensitivity: { type: Types.Float32, default: 1 },
  },
) {
  private _gripWorldPos = new Vector3();
  private _gripLocalPos = new Vector3();

  init() {
    const crankEntity = firstEntity(this.queries.crank.entities);
    if (!crankEntity) return;

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
          .addComponent(Highlight)
          .addComponent(CrankRotation);

        let pivot = crankRoot.getObjectByName("__crankPivot");
        if (!pivot) {
          pivot = new Object3D();
          pivot.name = "__crankPivot";
          while (crankRoot.children.length > 0) {
            pivot.add(crankRoot.children[0]);
          }
          crankRoot.add(pivot);
        }
      }),

      this.queries.activeCrankCrankingTask.subscribe("disqualify", () => {
        crankEntity
          .removeComponent(CrankHeld)
          .removeComponent(CrankRotation)
          .removeComponent(OneHandGrabbable)
          .removeComponent(Highlight);
      }),

      this.queries.crankGrabbed.subscribe("qualify", (entity) => {
        entity.addComponent(CrankHeld);
        if (!entity.hasComponent(CrankRotation)) {
          entity.addComponent(CrankRotation);
        }
        entity.setValue(CrankRotation, "firstFrame", true);
      }),

      this.queries.crankGrabbed.subscribe("disqualify", (entity) => {
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
      const pivot = crankRoot?.getObjectByName("__crankPivot");
      if (!crankRoot || !pivot) continue;

      crankRoot.updateMatrixWorld(true);

      this._gripLocalPos.copy(this._gripWorldPos);
      crankRoot.worldToLocal(this._gripLocalPos);

      const angle = Math.atan2(this._gripLocalPos.z, this._gripLocalPos.y);

      if (entity.getValue(CrankRotation, "firstFrame")) {
        entity.setValue(CrankRotation, "firstFrame", false);
        entity.setValue(CrankRotation, "lastAngle", angle);
        continue;
      }

      const lastAngle = entity.getValue(CrankRotation, "lastAngle") ?? angle;

      let delta = angle - lastAngle;
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;

      delta *= this.config.sensitivity.peek();
      pivot.rotation.x += delta;
      entity.setValue(CrankRotation, "lastAngle", angle);

      let total = (entity.getValue(CrankRotation, "totalRotation") ?? 0) + delta;
      if (total > 0) total = 0;
      entity.setValue(CrankRotation, "totalRotation", total);

      const required = entity.getValue(Crank, "requiredRotations") ?? 3;
      const progress = -total;
      const tickStepRadians = Math.PI / 8;
      let last = entity.getValue(CrankRotation, "lastTickProgress") ?? 0;
      while (progress - last >= tickStepRadians) {
        playCrankTick();
        last += tickStepRadians;
      }
      entity.setValue(CrankRotation, "lastTickProgress", last);

      if (total <= required * -Math.PI * 2) {
        entity
          .removeComponent(CrankHeld)
          .removeComponent(CrankRotation)
          .removeComponent(OneHandGrabbable)
          .removeComponent(Highlight)
          .addComponent(CrankingComplete);
      }
    }
  }
}
