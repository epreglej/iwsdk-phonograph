import {
  createComponent,
  createSystem,
  Entity,
  eq,
  Grabbed,
  Object3D,
  OneHandGrabbable,
  Types,
  Vector3,
} from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "./task.js";
import { TaskId } from "./task-config.js";
import { PhonographPart } from "./phonograph.js";
import { Highlight } from "./highlight.js";
import { PopIn } from "./animation.js";
import { playCrankTick } from "../audio/sfx.js";

export const Crank = createComponent("Crank", {
  requiredRotations: { type: Types.Float32, default: 3 },
});
export const CrankingComplete = createComponent("CrankingComplete", {});
export const CrankHeld = createComponent("CrankHeld", {});

export const CrankRotation = createComponent("CrankRotation", {
  lastAngle: { type: Types.Float32, default: 0 },
  totalRotation: { type: Types.Float32, default: 0 },
  lastTickProgress: { type: Types.Float32, default: 0 },
  firstFrame: { type: Types.Boolean, default: true },
});

export class CrankSystem extends createSystem(
  {
    activeCrankCrankingTask: {
      required: [Task, ActiveTask],
      excluded: [CompletedTask],
      where: [eq(Task, "id", TaskId.AssemblyCrankWind)],
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
    crankPart: {
      required: [PhonographPart],
      where: [eq(PhonographPart, "id", "crank")],
    },
  },
  {
    sensitivity: { type: Types.Float32, default: 1 },
  },
) {
  private _gripWorldPos = new Vector3();
  private _gripLocalPos = new Vector3();

  init() {
    this.cleanupFuncs.push(
      this.queries.activeCrankCrankingTask.subscribe("qualify", () => {
        const crankEntity = this.first(this.queries.crankPart.entities);
        const crankRoot = crankEntity?.object3D;
        if (!crankEntity || !crankRoot) return;

        crankEntity
          .removeComponent(CrankingComplete)
          .removeComponent(CrankHeld)
          .removeComponent(CrankRotation);

        if (!crankEntity.hasComponent(PopIn) && crankRoot.scale.x < 0.9) {
          crankRoot.scale.setScalar(0.001);
          crankEntity.addComponent(PopIn);
        }

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
        pivot.rotation.x = 0;
      }),

      this.queries.activeCrankCrankingTask.subscribe("disqualify", () => {
        const crankEntity = this.first(this.queries.crankPart.entities);
        crankEntity
          ?.removeComponent(CrankHeld)
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
    );
  }

  update(delta: number) {
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

      let angleDelta = angle - lastAngle;
      if (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
      if (angleDelta < -Math.PI) angleDelta += Math.PI * 2;

      angleDelta *= this.config.sensitivity.peek();

      const previousRotation = pivot.rotation.x;
      const atRest = previousRotation >= -1e-5;

      // At the rest detent, ignore wrong-direction input entirely (no rotation, no drift).
      if (atRest && angleDelta > 0) {
        entity.setValue(CrankRotation, "lastAngle", angle);
        continue;
      }

      let nextRotation = previousRotation + angleDelta;
      // Cannot pass through rest (0°) into the wrong direction.
      if (nextRotation > 0) nextRotation = 0;

      const appliedDelta = nextRotation - previousRotation;
      if (appliedDelta === 0) {
        entity.setValue(CrankRotation, "lastAngle", angle);
        continue;
      }

      pivot.rotation.x = nextRotation;
      entity.setValue(CrankRotation, "lastAngle", angle);

      let total = (entity.getValue(CrankRotation, "totalRotation") ?? 0) + appliedDelta;
      if (total > 0) total = 0;
      entity.setValue(CrankRotation, "totalRotation", total);

      const required = entity.getValue(Crank, "requiredRotations") ?? 3;
      const progress = -total;
      const tickStepRadians = Math.PI / 8;
      let last = entity.getValue(CrankRotation, "lastTickProgress") ?? 0;
      if (progress < last) {
        last = progress;
      }
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

        for (const task of this.queries.activeCrankCrankingTask.entities) {
          if (!task.hasComponent(CompletedTask)) {
            task.addComponent(CompletedTask);
          }
        }
      }
    }
  }

  private first(entities: Iterable<Entity>): Entity | undefined {
    for (const entity of entities) return entity;
    return undefined;
  }
}
