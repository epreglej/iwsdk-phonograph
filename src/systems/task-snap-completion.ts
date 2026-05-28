import { createSystem } from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../components/task.js";
import { MountTaskBinding } from "../components/mount-task-binding.js";
import { Highlight } from "../components/highlight.js";
import { SnapGhost, Snapped } from "../components/snap.js";

export class TaskSnapCompletionSystem extends createSystem({
  snappedMountGoals: { required: [Snapped, MountTaskBinding] },
  activeTasks: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
  },
}) {
  init() {
    this.cleanupFuncs.push(
      this.queries.snappedMountGoals.subscribe("qualify", (part) => {
        const taskId = part.getValue(MountTaskBinding, "taskId")!;

        part
          .removeComponent(MountTaskBinding)
          .removeComponent(Highlight)
          .removeComponent(SnapGhost);

        for (const task of this.queries.activeTasks.entities) {
          if (task.getValue(Task, "id") === taskId) {
            task.addComponent(CompletedTask);
          }
        }
      }),
    );
  }
}
