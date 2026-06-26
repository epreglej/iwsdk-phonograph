import { Entity, Follower, PokeInteractable } from "@iwsdk/core";
import { PopIn2D, PopOut2D } from "./animation.js";
import { Billboard } from "./billboard.js";

/** Strip poke + pop animation components before hide or teardown. */
export function stripPanelSurface(panel: Entity): void {
  panel.removeComponent(PokeInteractable);
  panel.removeComponent(PopIn2D);
  panel.removeComponent(PopOut2D);
}

export function beginPanelPopOut(panel: Entity): void {
  stripPanelSurface(panel);
  if (!panel.hasComponent(PopOut2D)) {
    panel.addComponent(PopOut2D);
  }
}

/** Hide a panel entity without dispose — safe during ECS updates. */
export function hidePanelEntity(panel: Entity): void {
  stripPanelSurface(panel);
  panel.removeComponent(Follower);
  if (panel.hasComponent(Billboard)) {
    panel.removeComponent(Billboard);
  }
  if (panel.object3D) panel.object3D.visible = false;
}

/** Queue a single task completion for the next update tick. */
export class DeferredTaskCompletion {
  private pendingTaskId: string | null = null;

  schedule(taskId: string): void {
    this.pendingTaskId = taskId;
  }

  clear(): void {
    this.pendingTaskId = null;
  }

  flush(complete: (taskId: string) => void): void {
    if (!this.pendingTaskId) return;
    const taskId = this.pendingTaskId;
    this.pendingTaskId = null;
    complete(taskId);
  }
}
