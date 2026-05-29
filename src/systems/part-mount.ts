import { createSystem, Entity, OneHandGrabbable } from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../components/task.js";
import { PhonographPart } from "../components/phonograph-part.js";
import { MountTaskBinding } from "../components/mount-task-binding.js";
import { Highlight } from "../components/highlight.js";
import { Snappable, SnapGhost } from "../components/snap.js";
import { MOUNT_BY_TASK } from "../config/task-flow.js";
import { getPart } from "../helpers/parts.js";
import { popInFromZero } from "../helpers/pop.js";

export class PartMountSystem extends createSystem({
  activeTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
  },
  parts: { required: [PhonographPart] },
}) {
  init() {
    this.cleanupFuncs.push(
      this.queries.activeTask.subscribe("qualify", (taskEntity) => {
        const taskId = taskEntity.getValue(Task, "id")!;
        const binding = MOUNT_BY_TASK[taskId];
        const part = binding && getPart(this.queries.parts.entities, binding.partId);
        if (binding && part) {
          this.activateMount(part, binding.snapPointId, taskId);
        }
      }),

      this.queries.activeTask.subscribe("disqualify", (taskEntity) => {
        const binding = MOUNT_BY_TASK[taskEntity.getValue(Task, "id")!];
        const part = binding && getPart(this.queries.parts.entities, binding.partId);
        if (part) this.deactivateMount(part);
      }),
    );
  }

  private activateMount(
    part: Entity,
    snapPointId: string,
    taskId: string,
  ): void {
    popInFromZero(part);
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
}
