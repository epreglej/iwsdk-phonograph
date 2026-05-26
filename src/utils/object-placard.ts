import {
  createComponent,
  createSystem,
  Entity,
  FollowBehavior,
  Follower,
  Grabbed,
  PanelUI,
  Types,
} from "@iwsdk/core";
import { PopIn2D, PopOut2D } from "../animations/animation.js";
import { Billboard } from "./billboard.js";
import { ActiveTask, CompletedTask, Task } from "../task.js";
import { Snapped } from "./snap.js";

/** Marks an object that has a museum placard following it in space. */
export const PlacardTarget = createComponent("PlacardTarget", {
  panelConfig: { type: Types.String, default: "" },
  offsetX: { type: Types.Float32, default: 0 },
  offsetY: { type: Types.Float32, default: 0 },
  offsetZ: { type: Types.Float32, default: 0 },
  dismissOnGrab: { type: Types.Boolean, default: false },
  dismissOnSnap: { type: Types.Boolean, default: true },
  autoDismissMs: { type: Types.Float32, default: 0 },
  completeTaskOnDismiss: { type: Types.String, default: "" },
});

export const PlacardDismissed = createComponent("PlacardDismissed", {});

export type PlacardTargetOptions = {
  panelConfig: string;
  offsetX?: number;
  offsetY?: number;
  offsetZ?: number;
  dismissOnGrab?: boolean;
  dismissOnSnap?: boolean;
  autoDismissMs?: number;
  completeTaskOnDismiss?: string;
};

export function addPlacardTarget(
  entity: Entity,
  options: PlacardTargetOptions,
): void {
  entity.addComponent(PlacardTarget, {
    panelConfig: options.panelConfig,
    offsetX: options.offsetX ?? 0,
    offsetY: options.offsetY ?? 0,
    offsetZ: options.offsetZ ?? 0,
    dismissOnGrab: options.dismissOnGrab ?? false,
    dismissOnSnap: options.dismissOnSnap ?? true,
    autoDismissMs: options.autoDismissMs ?? 0,
    completeTaskOnDismiss: options.completeTaskOnDismiss ?? "",
  });
}

export class ObjectPlacardSystem extends createSystem({
  targets: { required: [PlacardTarget], excluded: [PlacardDismissed] },
  targetGrabbed: { required: [PlacardTarget, Grabbed] },
  targetSnapped: { required: [PlacardTarget, Snapped] },
  activeTasks: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
  },
}) {
  private placards = new Map<number, Entity>();
  private dismissTimers = new Map<number, ReturnType<typeof setTimeout>>();

  init() {
    this.cleanupFuncs.push(
      this.queries.targets.subscribe("qualify", (target) => {
        this.spawnPlacard(target);
      }),

      this.queries.targets.subscribe("disqualify", (target) => {
        this.clearDismissTimer(target.index);
        this.destroyPlacard(target.index);
      }),

      this.queries.targetGrabbed.subscribe("qualify", (target) => {
        if (target.hasComponent(PlacardDismissed)) return;

        if (target.getValue(PlacardTarget, "dismissOnGrab")) {
          this.dismissPlacard(target);
          return;
        }

        this.hidePlacard(target.index);
      }),

      this.queries.targetGrabbed.subscribe("disqualify", (target) => {
        if (target.hasComponent(PlacardDismissed)) return;
        this.showPlacard(target.index);
      }),

      this.queries.targetSnapped.subscribe("qualify", (target) => {
        if (!target.getValue(PlacardTarget, "dismissOnSnap")) return;
        this.dismissPlacard(target);
      }),
    );
  }

  private spawnPlacard(target: Entity): void {
    const targetObj = target.object3D;
    if (!targetObj || this.placards.has(target.index)) return;

    const config = target.getValue(PlacardTarget, "panelConfig")!;

    const placard = this.world
      .createTransformEntity(undefined, { parent: this.world.sceneEntity })
      .addComponent(PanelUI, { config, maxWidth: 0.17 })
      .addComponent(Follower, {
        behavior: FollowBehavior.NoRotation,
        target: targetObj,
        offsetPosition: [
          target.getValue(PlacardTarget, "offsetX") ?? 0.1,
          target.getValue(PlacardTarget, "offsetY") ?? 0.12,
          target.getValue(PlacardTarget, "offsetZ") ?? 0,
        ],
      })
      .addComponent(Billboard)
      .addComponent(PopIn2D);

    placard.object3D!.scale.set(0.001, 0.001, 0.001);
    placard.object3D!.visible = true;
    this.placards.set(target.index, placard);

    const autoDismissMs = target.getValue(PlacardTarget, "autoDismissMs") ?? 0;
    if (autoDismissMs > 0) {
      const timer = setTimeout(() => {
        this.dismissTimers.delete(target.index);
        if (target.active && !target.hasComponent(PlacardDismissed)) {
          this.dismissPlacard(target);
        }
      }, autoDismissMs);
      this.dismissTimers.set(target.index, timer);
    }
  }

  private hidePlacard(targetIndex: number): void {
    const placard = this.placards.get(targetIndex);
    if (!placard) return;
    placard.removeComponent(PopIn2D);
    placard.addComponent(PopOut2D);
  }

  private showPlacard(targetIndex: number): void {
    const placard = this.placards.get(targetIndex);
    if (!placard?.object3D) return;
    placard.removeComponent(PopOut2D);
    placard.object3D.visible = true;
    placard.addComponent(PopIn2D);
  }

  private dismissPlacard(target: Entity): void {
    if (target.hasComponent(PlacardDismissed)) return;

    this.clearDismissTimer(target.index);
    target.addComponent(PlacardDismissed);

    const placard = this.placards.get(target.index);
    if (placard) {
      placard.removeComponent(PopIn2D);
      placard.addComponent(PopOut2D);
      const toDispose = placard;
      setTimeout(() => toDispose.dispose(), 600);
      this.placards.delete(target.index);
    }

    const taskId = target.getValue(PlacardTarget, "completeTaskOnDismiss");
    if (taskId) {
      for (const task of this.queries.activeTasks.entities) {
        if (task.getValue(Task, "id") === taskId) {
          task.addComponent(CompletedTask);
        }
      }
    }
  }

  private destroyPlacard(targetIndex: number): void {
    this.clearDismissTimer(targetIndex);
    const placard = this.placards.get(targetIndex);
    if (placard) {
      placard.dispose();
      this.placards.delete(targetIndex);
    }
  }

  private clearDismissTimer(targetIndex: number): void {
    const timer = this.dismissTimers.get(targetIndex);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.dismissTimers.delete(targetIndex);
    }
  }
}
