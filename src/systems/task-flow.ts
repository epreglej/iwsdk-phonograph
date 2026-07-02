import { createSystem, Entity } from "@iwsdk/core";
import { stopTaskNarration } from "../audio/narration.js";
import { playTaskChime } from "../audio/sfx.js";
import { InteractionGate } from "./interaction-gate.js";
import { PhonographPart } from "./phonograph.js";
import { revealPart } from "./part-reveal.js";
import { StartCarriageRecording, StartRecordingSession } from "./recording.js";
import { Task, ActiveTask, CompletedTask } from "./task.js";
import {
  TaskId,
  TASK_BY_ID,
  TASK_ORDER,
  type TaskDef,
} from "./task-config.js";

export { Task, ActiveTask, CompletedTask } from "./task.js";
export {
  TaskId,
  TASK_BY_ID,
  TASK_ORDER,
  MOUNT_BY_TASK,
  PLACARD_BY_TASK,
  PLACARDS_BY_TASK,
  TASK_PANEL_BY_TASK,
  UNMOUNT_BY_TASK,
  NAME_TAGS_BY_TASK,
  type PlacardBinding,
  type PlacardSpec,
  type TaskDef,
  type TaskPanelSpec,
  type MountBinding,
} from "./task-config.js";

export class TaskFlowSystem extends createSystem({
  completedActiveTask: { required: [Task, ActiveTask, CompletedTask] },
  activeTask: { required: [Task, ActiveTask], excluded: [CompletedTask] },
  parts: { required: [PhonographPart] },
}) {
  private activeTaskEntity: Entity | null = null;
  private pendingStartRecordingOnStart = false;

  init() {
    this.cleanupFuncs.push(
      this.queries.activeTask.subscribe("qualify", (entity) => {
        const taskId = entity.getValue(Task, "id")!;
        const task = TASK_BY_ID[taskId];
        if (!task) return;

        this.activeTaskEntity = entity;

        if (task.autoCompleteOnStart) {
          if (!entity.hasComponent(CompletedTask)) {
            entity.addComponent(CompletedTask);
          }
          return;
        }

        if (task.interactive) {
          this.world.sceneEntity.addComponent(InteractionGate);
        } else {
          this.world.sceneEntity.removeComponent(InteractionGate);
        }

        if (task.revealPart) {
          const revealId = task.revealPartId ?? task.partId;
          if (revealId) {
            const part = this.partById(revealId);
            if (part) revealPart(part);
          }
        }

        if (task.startRecordingOnStart) {
          this.pendingStartRecordingOnStart = true;
        }
      }),

      this.queries.activeTask.subscribe("disqualify", (entity) => {
        const taskId = entity.getValue(Task, "id")!;
        const task = TASK_BY_ID[taskId];
        if (!task) return;

        if (this.activeTaskEntity?.index === entity.index) {
          stopTaskNarration();
          this.activeTaskEntity = null;
        }
      }),

      this.queries.completedActiveTask.subscribe("qualify", (entity) => {
        stopTaskNarration();
        const completedId = entity.getValue(Task, "id")!;
        const completedTask = TASK_BY_ID[completedId];
        if (completedTask?.revealOnComplete) {
          const part = this.partById(completedTask.revealOnComplete);
          if (part) revealPart(part);
        }
        playTaskChime();
        entity.removeComponent(ActiveTask);
        this.advance(completedId);
      }),
    );
  }

  update() {
    if (!this.pendingStartRecordingOnStart) return;
    this.pendingStartRecordingOnStart = false;
    this.world.sceneEntity
      .addComponent(StartRecordingSession)
      .addComponent(StartCarriageRecording);
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

  private partById(id: string): Entity | undefined {
    for (const part of this.queries.parts.entities) {
      if (part.getValue(PhonographPart, "id") === id) return part;
    }
    return undefined;
  }
}
