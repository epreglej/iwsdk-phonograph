import { createSystem, Entity } from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../components/task.js";
import { Phonograph } from "../components/phonograph.js";
import { TaskPanel } from "../components/task-panel.js";
import { TASK_PANEL_BY_TASK, type TaskPanelSpec } from "../config/task-flow.js";
import { firstEntity } from "../helpers/entity-query.js";

export class TaskPanelTaskSystem extends createSystem({
  activeTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
  },
  phonograph: { required: [Phonograph] },
  panelAnchors: { required: [TaskPanel] },
}) {
  init() {
    this.cleanupFuncs.push(
      this.queries.activeTask.subscribe("qualify", (taskEntity) => {
        const taskId = taskEntity.getValue(Task, "id")!;
        const spec = TASK_PANEL_BY_TASK[taskId];
        if (!spec) return;

        const anchor = this.resolveAnchor(spec.anchor);
        if (!anchor) return;

        this.attachPanel(anchor, taskId, spec);
      }),

      this.queries.activeTask.subscribe("disqualify", (taskEntity) => {
        const taskId = taskEntity.getValue(Task, "id")!;
        if (!TASK_PANEL_BY_TASK[taskId]) return;
        this.stripPanel(taskId);
      }),
    );
  }

  private resolveAnchor(anchor: TaskPanelSpec["anchor"]): Entity | undefined {
    if (anchor === "head") return this.playerHeadEntity;
    return firstEntity(this.queries.phonograph.entities);
  }

  private attachPanel(
    anchor: Entity,
    taskId: string,
    spec: TaskPanelSpec,
  ): void {
    if (
      anchor.hasComponent(TaskPanel) &&
      anchor.getValue(TaskPanel, "taskId") === taskId &&
      anchor.getValue(TaskPanel, "panelConfig") === spec.panelConfig
    ) {
      return;
    }

    anchor.removeComponent(TaskPanel);
    anchor.addComponent(TaskPanel, {
      panelConfig: spec.panelConfig,
      taskId,
      maxWidth: spec.maxWidth ?? 0.35,
      offsetX: spec.offsetX ?? 0,
      offsetY: spec.offsetY ?? 0,
      offsetZ: spec.offsetZ ?? 0,
      faceTarget: spec.faceTarget ?? false,
      billboard: spec.billboard ?? false,
      buttonId: spec.buttonId ?? "",
      deferCompleteOnDismiss: spec.deferCompleteOnDismiss ?? false,
      autoCompleteMs: spec.autoCompleteMs ?? 0,
    });
  }

  private stripPanel(taskId: string): void {
    for (const anchor of this.queries.panelAnchors.entities) {
      if (anchor.getValue(TaskPanel, "taskId") === taskId) {
        anchor.removeComponent(TaskPanel);
      }
    }
  }
}
