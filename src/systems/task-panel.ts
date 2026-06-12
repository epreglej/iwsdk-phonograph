import {
  createComponent,
  createSystem,
  Entity,
  FollowBehavior,
  Follower,
  PanelDocument,
  PanelUI,
  PokeInteractable,
  Types,
  UIKit,
  UIKitDocument,
} from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "./task-flow.js";
import { Phonograph } from "./phonograph.js";
import { PopIn2D, PopOut2D, PopOut2DDone } from "./animation.js";
import { Billboard } from "./billboard.js";
import { TASK_PANEL_BY_TASK, type TaskPanelSpec } from "./task-flow.js";

export const TaskPanel = createComponent("TaskPanel", {
  panelConfig: { type: Types.String, default: "" },
  taskId: { type: Types.String, default: "" },
  maxWidth: { type: Types.Float32, default: 0.35 },
  offsetX: { type: Types.Float32, default: 0 },
  offsetY: { type: Types.Float32, default: 0 },
  offsetZ: { type: Types.Float32, default: 0 },
  faceTarget: { type: Types.Boolean, default: false },
  billboard: { type: Types.Boolean, default: false },
  buttonId: { type: Types.String, default: "" },
  deferCompleteOnDismiss: { type: Types.Boolean, default: false },
  autoCompleteMs: { type: Types.Float32, default: 0 },
});

export const TaskPanelInstance = createComponent("TaskPanelInstance", {
  anchor: { type: Types.Entity, default: null },
  taskId: { type: Types.String, default: "" },
});

export const TaskPanelWired = createComponent("TaskPanelWired", {});
export const TaskPanelPendingDismiss = createComponent("TaskPanelPendingDismiss", {});
export const TaskPanelPendingDispose = createComponent("TaskPanelPendingDispose", {});

export const TaskPanelAutoComplete = createComponent("TaskPanelAutoComplete", {
  remainingMs: { type: Types.Float32, default: 0 },
});

export class TaskPanelSystem extends createSystem({
  activeTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
  },
  phonograph: { required: [Phonograph] },
  panelAnchors: { required: [TaskPanel] },
  anchors: { required: [TaskPanel] },
  instances: { required: [TaskPanelInstance] },
  instanceDocs: { required: [TaskPanelInstance, PanelDocument] },
  wiredPanels: { required: [TaskPanelInstance, TaskPanelWired] },
  pendingDismissPanels: {
    required: [TaskPanelInstance, TaskPanelPendingDismiss],
  },
  pendingDisposePanels: {
    required: [TaskPanelInstance, TaskPanelPendingDispose],
  },
  poppedOut: { required: [TaskPanelInstance, PopOut2DDone] },
  activeTasks: { required: [Task, ActiveTask], excluded: [CompletedTask] },
  autoCompletePanels: { required: [TaskPanelInstance, TaskPanelAutoComplete] },
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

      this.queries.anchors.subscribe("qualify", (anchor) => {
        this.spawnPanel(anchor);
      }),

      this.queries.anchors.subscribe("disqualify", (anchor) => {
        this.destroyPanelForAnchor(anchor);
      }),

      this.queries.instances.subscribe("disqualify", (panel) => {
        panel
          .removeComponent(TaskPanelWired)
          .removeComponent(TaskPanelPendingDismiss)
          .removeComponent(TaskPanelPendingDispose);
        panel.removeComponent(TaskPanelAutoComplete);
        panel.dispose();
      }),

      this.queries.instanceDocs.subscribe("qualify", (panel) => {
        this.popInPanel(panel);
        this.wireButton(panel);
        this.scheduleAutoComplete(panel);
      }),

      this.queries.poppedOut.subscribe("qualify", (panel) => {
        const shouldComplete = this.hasPendingDismiss(panel);
        this.teardownPanel(panel);
        if (shouldComplete) {
          panel.removeComponent(TaskPanelPendingDismiss);
          this.completeTask(panel.getValue(TaskPanelInstance, "taskId")!);
        }
        if (this.hasPendingDispose(panel)) {
          panel.removeComponent(TaskPanelPendingDispose);
          panel.dispose();
        }
      }),
    );
  }

  update(delta: number) {
    const dtMs = delta * 1000;

    for (const panel of this.queries.autoCompletePanels.entities) {
      const remaining =
        (panel.getValue(TaskPanelAutoComplete, "remainingMs") ?? 0) - dtMs;

      if (remaining <= 0) {
        panel.removeComponent(TaskPanelAutoComplete);
        panel.addComponent(TaskPanelPendingDismiss);
        if (panel.hasComponent(PokeInteractable)) {
          panel.removeComponent(PokeInteractable);
        }
        this.hidePanel(panel);
      } else {
        panel.setValue(TaskPanelAutoComplete, "remainingMs", remaining);
      }
    }
  }

  private resolveAnchor(anchor: TaskPanelSpec["anchor"]): Entity | undefined {
    if (anchor === "head") return this.playerHeadEntity;
    return this.first(this.queries.phonograph.entities);
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

  private spawnPanel(anchor: Entity): void {
    const anchorObj = anchor.object3D;
    if (!anchorObj) return;

    const existing = this.findPanelForAnchor(anchor);
    if (existing) existing.dispose();

    const config = anchor.getValue(TaskPanel, "panelConfig")!;
    const taskId = anchor.getValue(TaskPanel, "taskId")!;
    const maxWidth = anchor.getValue(TaskPanel, "maxWidth") ?? 0.35;
    const faceTarget = anchor.getValue(TaskPanel, "faceTarget") ?? false;

    const panel = this.world
      .createTransformEntity(undefined, { parent: this.world.sceneEntity })
      .addComponent(PanelUI, { config, maxWidth })
      .addComponent(TaskPanelInstance, { anchor, taskId })
      .addComponent(Follower, {
        behavior: faceTarget
          ? FollowBehavior.FaceTarget
          : FollowBehavior.NoRotation,
        target: anchorObj,
        offsetPosition: [
          anchor.getValue(TaskPanel, "offsetX") ?? 0,
          anchor.getValue(TaskPanel, "offsetY") ?? 0,
          anchor.getValue(TaskPanel, "offsetZ") ?? 0,
        ],
      });

    if (anchor.getValue(TaskPanel, "billboard")) {
      panel.addComponent(Billboard);
    }

    const autoCompleteMs = anchor.getValue(TaskPanel, "autoCompleteMs") ?? 0;
    if (autoCompleteMs <= 0) {
      panel.addComponent(PokeInteractable);
    }

    panel.object3D!.scale.set(0.001, 0.001, 0.001);
    panel.object3D!.visible = true;
  }

  private popInPanel(panel: Entity): void {
    if (!panel.active) return;

    const doc = panel.getValue(PanelDocument, "document") as
      | UIKitDocument
      | null;
    const root = doc?.getElementById("panel-root") as UIKit.Component | undefined;
    if (root) root.scale.setScalar(0.001);

    panel.removeComponent(PopOut2D);
    if (!panel.hasComponent(PopIn2D)) {
      panel.addComponent(PopIn2D);
    }
  }

  private wireButton(panel: Entity): void {
    if (!panel.active || this.isWired(panel)) return;

    const anchor = panel.getValue(TaskPanelInstance, "anchor");
    if (!anchor?.active || !anchor.hasComponent(TaskPanel)) return;

    const buttonId = anchor.getValue(TaskPanel, "buttonId") ?? "";
    if (!buttonId) {
      panel.addComponent(TaskPanelWired);
      return;
    }

    const doc = panel.getValue(PanelDocument, "document") as UIKitDocument | null;
    const button = doc?.getElementById(buttonId);
    button?.addEventListener("click", () => {
      const taskId = panel.getValue(TaskPanelInstance, "taskId")!;
      const defer = anchor.getValue(TaskPanel, "deferCompleteOnDismiss") ?? false;

      if (defer) {
        panel.addComponent(TaskPanelPendingDismiss);
        panel.removeComponent(PokeInteractable);
        this.hidePanel(panel);
        return;
      }

      this.completeTask(taskId);
    });

    panel.addComponent(TaskPanelWired);
  }

  private scheduleAutoComplete(panel: Entity): void {
    if (panel.hasComponent(TaskPanelAutoComplete)) return;

    const anchor = panel.getValue(TaskPanelInstance, "anchor");
    if (!anchor?.active || !anchor.hasComponent(TaskPanel)) return;

    const ms = anchor.getValue(TaskPanel, "autoCompleteMs") ?? 0;
    if (ms <= 0) return;

    panel.addComponent(TaskPanelAutoComplete, { remainingMs: ms });
  }

  private hidePanel(entity: Entity): void {
    entity.removeComponent(PopIn2D);
    if (!entity.hasComponent(PopOut2D)) {
      entity.addComponent(PopOut2D);
    }
  }

  private completeTask(taskId: string): void {
    for (const task of this.queries.activeTasks.entities) {
      if (
        task.getValue(Task, "id") === taskId &&
        !task.hasComponent(CompletedTask)
      ) {
        task.addComponent(CompletedTask);
        return;
      }
    }
  }

  private teardownPanel(panel: Entity): void {
    if (!panel.active) return;
    if (panel.object3D) panel.object3D.visible = false;
    panel.removeComponent(PokeInteractable).removeComponent(Follower);
    if (panel.hasComponent(Billboard)) {
      panel.removeComponent(Billboard);
    }
  }

  private findPanelForAnchor(anchor: Entity): Entity | undefined {
    for (const panel of this.queries.instances.entities) {
      if (panel.getValue(TaskPanelInstance, "anchor") === anchor) {
        return panel;
      }
    }
    return undefined;
  }

  private destroyPanelForAnchor(anchor: Entity): void {
    const panel = this.findPanelForAnchor(anchor);
    if (!panel) return;

    panel.removeComponent(TaskPanelAutoComplete);

    if (
      panel.active &&
      panel.object3D?.visible &&
      !panel.hasComponent(PopOut2D) &&
      !panel.hasComponent(PopOut2DDone) &&
      !this.hasPendingDismiss(panel)
    ) {
      panel.addComponent(TaskPanelPendingDispose);
      this.hidePanel(panel);
      return;
    }

    panel.dispose();
  }

  private isWired(panel: Entity): boolean {
    for (const wired of this.queries.wiredPanels.entities) {
      if (wired.index === panel.index) return true;
    }
    return false;
  }

  private hasPendingDismiss(panel: Entity): boolean {
    for (const pending of this.queries.pendingDismissPanels.entities) {
      if (pending.index === panel.index) return true;
    }
    return false;
  }

  private hasPendingDispose(panel: Entity): boolean {
    for (const pending of this.queries.pendingDisposePanels.entities) {
      if (pending.index === panel.index) return true;
    }
    return false;
  }

  private first(entities: Iterable<Entity>): Entity | undefined {
    for (const entity of entities) return entity;
    return undefined;
  }
}
