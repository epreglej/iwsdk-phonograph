import { createSystem } from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../components/task.js";
import { nextTaskId, isInteractiveTask } from "../config/task-flow.js";
import { playTaskChime } from "../audio/sfx.js";
import { openInteractionGate } from "../interaction/interaction-gate.js";

export class TaskFlowSystem extends createSystem({
  completedActiveTask: { required: [Task, ActiveTask, CompletedTask] },
}) {
  init() {
    this.cleanupFuncs.push(
      this.queries.completedActiveTask.subscribe("qualify", (entity) => {
        const completedId = entity.getValue(Task, "id")!;
        playTaskChime();
        this.advance(completedId);
        entity.dispose();
      }),
    );
  }

  private advance(completedId: string): void {
    const nextId = nextTaskId(completedId);
    if (!nextId) return;

    if (isInteractiveTask(nextId)) {
      openInteractionGate();
    }

    this.world
      .createEntity()
      .addComponent(ActiveTask)
      .addComponent(Task, { id: nextId });
  }
}
