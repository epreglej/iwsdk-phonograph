import { createSystem, Entity } from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../components/task.js";
import { PhonographPart } from "../components/phonograph-part.js";
import { Crank, CrankingComplete } from "../components/phonograph.js";
import { Placard, PlacardDismissed } from "../components/placard.js";
import { PLACARD_BY_TASK, type PlacardSpec } from "../config/task-flow.js";
import { getPart } from "../helpers/parts.js";

export class PlacardTaskSystem extends createSystem({
  activeTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
  },
  parts: { required: [PhonographPart] },
  crankComplete: { required: [Crank, CrankingComplete] },
}) {
  init() {
    this.cleanupFuncs.push(
      this.queries.activeTask.subscribe("qualify", (taskEntity) => {
        const binding = PLACARD_BY_TASK[taskEntity.getValue(Task, "id")!];
        const target = binding && getPart(this.queries.parts.entities, binding.partId);
        if (binding && target) this.attachPlacard(target, binding.placard);
      }),

      this.queries.activeTask.subscribe("disqualify", (taskEntity) => {
        const binding = PLACARD_BY_TASK[taskEntity.getValue(Task, "id")!];
        const target = binding && getPart(this.queries.parts.entities, binding.partId);
        if (target) this.stripPlacard(target);
      }),

      this.queries.crankComplete.subscribe("qualify", () => {
        const crank = getPart(this.queries.parts.entities, "crank");
        if (crank) this.stripPlacard(crank);
      }),
    );
  }

  private attachPlacard(entity: Entity, spec: PlacardSpec): void {
    entity.removeComponent(PlacardDismissed).removeComponent(Placard);
    entity.addComponent(Placard, {
      panelConfig: spec.panelConfig,
      offsetX: spec.offsetX ?? 0,
      offsetY: spec.offsetY ?? 0,
      offsetZ: spec.offsetZ ?? 0,
      dismissOnGrab: spec.dismissOnGrab ?? false,
      dismissOnSnap: spec.dismissOnSnap ?? true,
      autoDismissMs: spec.autoDismissMs ?? 0,
    });
  }

  private stripPlacard(entity: Entity): void {
    entity.removeComponent(Placard).removeComponent(PlacardDismissed);
  }
}
