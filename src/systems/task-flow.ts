import { createComponent, createSystem, Types } from "@iwsdk/core";
import { TASK_FLOW, TASK_ORDER, type TaskDef } from "../config.js";
import { playTaskChime } from "../audio/sfx.js";
import { InteractionGate } from "./interaction-gate.js";

export const Task = createComponent("Task", {
  id: { type: Types.String, default: "main_menu" },
});
export const ActiveTask = createComponent("ActiveTask", {});
export const CompletedTask = createComponent("CompletedTask", {});

const INTERACTIVE_TASK_KINDS = new Set<TaskDef["kind"]>([
  "mount",
  "crank",
  "unmount",
  "brakeShift",
  "carriageReturn",
  "recording",
]);

export class TaskFlowSystem extends createSystem({
  completedActiveTask: { required: [Task, ActiveTask, CompletedTask] },
  activeTask: { required: [Task, ActiveTask], excluded: [CompletedTask] },
}) {
  init() {
    this.cleanupFuncs.push(
      this.queries.activeTask.subscribe("qualify", (entity) => {
        const taskId = entity.getValue(Task, "id")!;
        if (this.isInteractiveTask(taskId)) {
          this.world.sceneEntity.addComponent(InteractionGate);
        } else {
          this.world.sceneEntity.removeComponent(InteractionGate);
        }
      }),

      this.queries.completedActiveTask.subscribe("qualify", (entity) => {
        const completedId = entity.getValue(Task, "id")!;
        playTaskChime();
        this.advance(completedId);
        entity.dispose();
      }),
    );
  }

  private advance(completedId: string): void {
    const nextId = this.nextTaskId(completedId);
    if (!nextId) return;

    this.world
      .createEntity()
      .addComponent(ActiveTask)
      .addComponent(Task, { id: nextId });
  }

  private nextTaskId(currentId: string): string | undefined {
    const index = TASK_ORDER.indexOf(currentId);
    if (index < 0) return undefined;
    return TASK_ORDER[(index + 1) % TASK_ORDER.length];
  }

  private isInteractiveTask(taskId: string): boolean {
    const task = TASK_FLOW.find((entry) => entry.id === taskId);
    return task != null && INTERACTIVE_TASK_KINDS.has(task.kind);
  }
}
