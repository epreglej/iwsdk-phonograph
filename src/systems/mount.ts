import {
  createComponent,
  createSystem,
  Entity,
  Object3D,
  OneHandGrabbable,
  Types,
} from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "./task-flow.js";
import { Phonograph } from "./phonograph.js";
import { PhonographPart } from "./phonograph.js";
import { Highlight } from "./highlight.js";
import { Snappable, SnapGhost, Snapped } from "./snap.js";
import { PopIn } from "./animation.js";
import {
  MOUNT_BY_TASK,
  PART_LAYOUT,
  isCarriagePart,
  reparentObject3D,
} from "../config.js";

export const MountTaskBinding = createComponent("MountTaskBinding", {
  taskId: { type: Types.String, default: "" },
  snapPointId: { type: Types.String, default: "" },
});

export class MountSystem extends createSystem({
  activeTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
  },
  parts: { required: [PhonographPart] },
  phonograph: { required: [Phonograph] },
  snappedMountGoals: { required: [Snapped, MountTaskBinding] },
}) {
  init() {
    this.cleanupFuncs.push(
      this.queries.activeTask.subscribe("qualify", (taskEntity) => {
        const taskId = taskEntity.getValue(Task, "id")!;
        const binding = MOUNT_BY_TASK[taskId];
        const part = binding && this.partById(binding.partId);
        if (binding && part) {
          this.activateMount(part, binding.snapPointId, taskId);
        }
      }),

      this.queries.activeTask.subscribe("disqualify", (taskEntity) => {
        const binding = MOUNT_BY_TASK[taskEntity.getValue(Task, "id")!];
        const part = binding && this.partById(binding.partId);
        if (part) this.deactivateMount(part);
      }),

      this.queries.snappedMountGoals.subscribe("qualify", (part) => {
        const taskId = part.getValue(MountTaskBinding, "taskId")!;

        part
          .removeComponent(MountTaskBinding)
          .removeComponent(Highlight)
          .removeComponent(SnapGhost);

        for (const task of this.queries.activeTask.entities) {
          if (task.getValue(Task, "id") === taskId) {
            task.addComponent(CompletedTask);
          }
        }
      }),
    );
  }

  private activateMount(
    part: Entity,
    snapPointId: string,
    taskId: string,
  ): void {
    const partId = part.getValue(PhonographPart, "id");
    const phonograph = this.first(this.queries.phonograph.entities);
    if (isCarriagePart(partId) && phonograph?.object3D) {
      this.reparentPartToPhonographStaging(part, phonograph.object3D);
    }

    const obj = part.object3D;
    if (obj) obj.scale.setScalar(0.001);
    part.addComponent(PopIn);

    part
      .addComponent(OneHandGrabbable)
      .addComponent(Snappable, { snapPointId })
      .addComponent(SnapGhost)
      .addComponent(Highlight)
      .addComponent(MountTaskBinding, { taskId, snapPointId });
  }

  private deactivateMount(part: Entity): void {
    part
      .removeComponent(MountTaskBinding)
      .removeComponent(Highlight)
      .removeComponent(SnapGhost)
      .removeComponent(Snappable)
      .removeComponent(OneHandGrabbable);
  }

  private reparentPartToPhonographStaging(
    part: Entity,
    phonographRoot: Object3D,
  ): void {
    const partId = part.getValue(PhonographPart, "id");
    const layout = PART_LAYOUT.find((entry) => entry.id === partId);
    if (!layout) return;

    const obj = part.object3D;
    if (!obj) return;

    if (obj.parent !== phonographRoot) {
      reparentObject3D(obj, phonographRoot);
    }

    obj.position.set(...layout.position);
    obj.quaternion.set(...layout.quaternion);
  }

  private partById(id: string): Entity | undefined {
    for (const part of this.queries.parts.entities) {
      if (part.getValue(PhonographPart, "id") === id) return part;
    }
    return undefined;
  }

  private first(entities: Iterable<Entity>): Entity | undefined {
    for (const entity of entities) return entity;
    return undefined;
  }
}
