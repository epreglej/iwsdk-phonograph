import { createSystem, Entity, PanelDocument, PanelUI } from "@iwsdk/core";
import { playTaskNarration } from "../audio/narration.js";
import { resumeAudioContext } from "../audio/context.js";
import { playTaskChime } from "../audio/sfx.js";
import { InteractionGate } from "./interaction-gate.js";
import { PhonographPart } from "./phonograph.js";
import { revealPart } from "./part-reveal.js";
import { PlacardInstance } from "./placard.js";
import { StartCarriageRecording, StartRecordingSession } from "./recording.js";
import { Task, ActiveTask, CompletedTask } from "./task.js";
import {
  PLACARDS_BY_TASK,
  TaskId,
  TASK_BY_ID,
  TASK_ORDER,
  type TaskDef,
} from "./task-config.js";

export { Task, ActiveTask, CompletedTask } from "./task.js";
export {
  NARRATION_POST_DELAY_MS,
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
  placardReady: {
    required: [PlacardInstance, PanelUI, PanelDocument],
  },
}) {
  private completeTimer: ReturnType<typeof setTimeout> | null = null;
  private activeTaskEntity: Entity | null = null;
  private pendingPlacardAdvance: {
    task: TaskDef;
    taskEntity: Entity;
    narrationDone: boolean;
  } | null = null;

  init() {
    this.cleanupFuncs.push(
      this.queries.activeTask.subscribe("qualify", (entity) => {
        const taskId = entity.getValue(Task, "id")!;
        const task = TASK_BY_ID[taskId];
        if (!task) return;

        this.activeTaskEntity = entity;

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
          this.world.sceneEntity
            .addComponent(StartRecordingSession)
            .addComponent(StartCarriageRecording);
        }

        this.queueTaskAudio(task, entity);

        if (
          task.afterNarrationMs != null &&
          (task.placard || task.placards?.length)
        ) {
          this.pendingPlacardAdvance = {
            task,
            taskEntity: entity,
            narrationDone: !(task.narration ?? task.hintAudio),
          };
          this.tryAdvanceAfterPlacard();
        } else if (
          task.afterNarrationMs != null &&
          !(task.narration ?? task.hintAudio)
        ) {
          this.scheduleAutoAdvance(task.afterNarrationMs, entity);
        }
      }),

      this.queries.placardReady.subscribe("qualify", () => {
        this.tryAdvanceAfterPlacard();
      }),

      this.queries.activeTask.subscribe("disqualify", (entity) => {
        const taskId = entity.getValue(Task, "id")!;
        const task = TASK_BY_ID[taskId];
        if (!task) return;

        if (this.activeTaskEntity?.index === entity.index) {
          this.clearAutoAdvance();
          this.pendingPlacardAdvance = null;
          this.activeTaskEntity = null;
        }
      }),

      this.queries.completedActiveTask.subscribe("qualify", (entity) => {
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

  private queueTaskAudio(task: TaskDef, taskEntity: Entity): void {
    const url = task.narration ?? task.hintAudio;
    if (!url) return;

    const hasPlacard = !!(task.placard || task.placards?.length);
    const onEnded = () => {
      if (
        hasPlacard &&
        this.pendingPlacardAdvance?.taskEntity.index === taskEntity.index
      ) {
        this.pendingPlacardAdvance.narrationDone = true;
        this.tryAdvanceAfterPlacard();
        return;
      }

      if (task.narration && task.afterNarrationMs != null) {
        this.scheduleAutoAdvance(task.afterNarrationMs, taskEntity);
      }
    };

    void resumeAudioContext().then(() => playTaskNarration(url, 1, onEnded));
  }

  private tryAdvanceAfterPlacard(): void {
    const pending = this.pendingPlacardAdvance;
    if (!pending) return;

    const { task, taskEntity, narrationDone } = pending;
    if (
      !taskEntity.active ||
      taskEntity.hasComponent(CompletedTask) ||
      task.afterNarrationMs == null
    ) {
      this.pendingPlacardAdvance = null;
      return;
    }

    if (!narrationDone) return;

    const bindings = PLACARDS_BY_TASK[task.id];
    if (!bindings?.length) {
      this.pendingPlacardAdvance = null;
      this.scheduleAutoAdvance(task.afterNarrationMs, taskEntity);
      return;
    }

    const panelConfigs = new Set(
      bindings.map((binding) => binding.placard.panelConfig),
    );

    for (const placard of this.queries.placardReady.entities) {
      const config = placard.getValue(PanelUI, "config");
      if (config && panelConfigs.has(config)) {
        this.pendingPlacardAdvance = null;
        this.scheduleAutoAdvance(task.afterNarrationMs, taskEntity);
        return;
      }
    }
  }

  private scheduleAutoAdvance(delayMs: number, taskEntity: Entity): void {
    this.clearAutoAdvance();
    this.completeTimer = setTimeout(() => {
      this.completeTimer = null;
      if (taskEntity.active && !taskEntity.hasComponent(CompletedTask)) {
        taskEntity.addComponent(CompletedTask);
      }
    }, delayMs);
  }

  private clearAutoAdvance(): void {
    if (this.completeTimer != null) {
      clearTimeout(this.completeTimer);
      this.completeTimer = null;
    }
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
