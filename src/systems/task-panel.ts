import {
  createSystem,
  Entity,
  FollowBehavior,
  Follower,
  PanelDocument,
  PanelUI,
  PokeInteractable,
  UIKit,
  UIKitDocument,
} from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../components/task.js";
import { TaskPanel, TaskPanelInstance } from "../components/task-panel.js";
import { PopIn2D, PopOut2D, PopOut2DDone } from "../components/animation.js";
import { Billboard } from "../components/billboard.js";
import { hidePanel } from "../ui/panel-lifecycle.js";

export class TaskPanelSystem extends createSystem({
  anchors: { required: [TaskPanel] },
  instances: { required: [TaskPanelInstance] },
  instanceDocs: { required: [TaskPanelInstance, PanelDocument] },
  poppedOut: { required: [TaskPanelInstance, PopOut2DDone] },
  activeTask: { required: [Task, ActiveTask], excluded: [CompletedTask] },
}) {
  private wired = new Set<number>();
  private pendingDismiss = new Set<number>();

  init() {
    this.cleanupFuncs.push(
      this.queries.anchors.subscribe("qualify", (anchor) => {
        this.spawnPanel(anchor);
      }),

      this.queries.anchors.subscribe("disqualify", (anchor) => {
        this.destroyPanelForAnchor(anchor);
      }),

      this.queries.instances.subscribe("disqualify", (panel) => {
        this.wired.delete(panel.index);
        this.pendingDismiss.delete(panel.index);
        panel.dispose();
      }),

      this.queries.instanceDocs.subscribe("qualify", (panel) => {
        this.popInPanel(panel);
        this.wireButton(panel);
      }),

      this.queries.poppedOut.subscribe("qualify", (panel) => {
        if (this.pendingDismiss.delete(panel.index)) {
          this.completeTask(panel.getValue(TaskPanelInstance, "taskId")!);
        }
        this.teardownPanel(panel);
      }),
    );
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

    panel.addComponent(PokeInteractable);
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
    if (this.wired.has(panel.index)) return;

    const anchor = panel.getValue(TaskPanelInstance, "anchor");
    if (!anchor?.hasComponent(TaskPanel)) return;

    const buttonId = anchor.getValue(TaskPanel, "buttonId") ?? "";
    if (!buttonId) {
      this.wired.add(panel.index);
      return;
    }

    const doc = panel.getValue(PanelDocument, "document") as UIKitDocument | null;
    const button = doc?.getElementById(buttonId);
    button?.addEventListener("click", () => {
      const taskId = panel.getValue(TaskPanelInstance, "taskId")!;
      const defer = anchor.getValue(TaskPanel, "deferCompleteOnDismiss") ?? false;

      if (defer) {
        this.pendingDismiss.add(panel.index);
        panel.removeComponent(PokeInteractable);
        hidePanel(panel);
        return;
      }

      this.completeTask(taskId);
    });

    this.wired.add(panel.index);
  }

  private completeTask(taskId: string): void {
    for (const task of this.queries.activeTask.entities) {
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
    panel?.dispose();
  }
}
