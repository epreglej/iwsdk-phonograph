import {
  createComponent,
  createSystem,
  Entity,
  eq,
  FollowBehavior,
  Follower,
  Grabbed,
  PanelDocument,
  PanelUI,
  Types,
  UIKit,
  UIKitDocument,
} from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "./task-flow.js";
import { PhonographPart } from "./phonograph.js";
import { Crank, CrankingComplete } from "./crank.js";
import { PopIn2D, PopOut2D } from "./animation.js";
import { Billboard } from "./billboard.js";
import { Snapped } from "./snap.js";
import {
  PLACARD_BY_TASK,
  TASK_ORDER,
  type PlacardSpec,
} from "./task-flow.js";

export const Placard = createComponent("Placard", {
  panelConfig: { type: Types.String, default: "" },
  maxWidth: { type: Types.Float32, default: 0.221 },
  offsetX: { type: Types.Float32, default: 0 },
  offsetY: { type: Types.Float32, default: 0 },
  offsetZ: { type: Types.Float32, default: 0 },
  dismissOnGrab: { type: Types.Boolean, default: false },
  dismissOnSnap: { type: Types.Boolean, default: true },
  autoDismissMs: { type: Types.Float32, default: 0 },
});

export const PlacardDismissed = createComponent("PlacardDismissed", {});

export const PlacardAutoDismiss = createComponent("PlacardAutoDismiss", {
  remainingMs: { type: Types.Float32, default: 0 },
});

export const PlacardInstance = createComponent("PlacardInstance", {
  target: { type: Types.Entity, default: null },
});

export class PlacardSystem extends createSystem({
  activeTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
  },
  parts: { required: [PhonographPart] },
  crankPart: {
    required: [PhonographPart],
    where: [eq(PhonographPart, "id", "crank")],
  },
  crankComplete: { required: [Crank, CrankingComplete] },
  placardAutoDismiss: {
    required: [PlacardAutoDismiss],
    excluded: [PlacardDismissed],
  },
  targets: { required: [Placard], excluded: [PlacardDismissed] },
  instances: { required: [PlacardInstance] },
  instanceDocs: { required: [PlacardInstance, PanelDocument] },
  targetGrabbed: { required: [Placard, Grabbed] },
  targetSnapped: { required: [Placard, Snapped] },
}) {
  init() {
    this.cleanupFuncs.push(
      this.queries.activeTask.subscribe("qualify", (taskEntity) => {
        const binding = PLACARD_BY_TASK[taskEntity.getValue(Task, "id")!];
        const target = binding && this.partById(binding.partId);
        if (binding && target) this.attachPlacard(target, binding.placard);
      }),

      this.queries.activeTask.subscribe("disqualify", (taskEntity) => {
        const taskId = taskEntity.getValue(Task, "id")!;
        const binding = PLACARD_BY_TASK[taskId];
        if (!binding) return;

        for (const other of this.queries.activeTask.entities) {
          if (other.index === taskEntity.index) continue;
          const otherBinding = PLACARD_BY_TASK[other.getValue(Task, "id")!];
          if (otherBinding?.partId === binding.partId) return;
        }

        const nextId = this.nextTaskId(taskId);
        const nextBinding = nextId ? PLACARD_BY_TASK[nextId] : undefined;
        if (
          nextBinding &&
          nextBinding.partId === binding.partId &&
          nextBinding.placard.panelConfig === binding.placard.panelConfig
        ) {
          return;
        }

        const target = this.partById(binding.partId);
        if (target) this.stripPlacard(target);
      }),

      this.queries.crankComplete.subscribe("qualify", () => {
        const crank = this.first(this.queries.crankPart.entities);
        if (crank) this.stripPlacard(crank);
      }),

      this.queries.targets.subscribe("qualify", (target) => {
        this.spawnPlacard(target);
      }),

      this.queries.targets.subscribe("disqualify", (target) => {
        target.removeComponent(PlacardAutoDismiss);
        this.destroyPlacardForTarget(target);
      }),

      this.queries.instances.subscribe("disqualify", (placard) => {
        placard.dispose();
      }),

      this.queries.instanceDocs.subscribe("qualify", (placard) => {
        this.popInPlacard(placard);
      }),

      this.queries.targetGrabbed.subscribe("qualify", (target) => {
        if (target.hasComponent(PlacardDismissed)) return;

        if (target.getValue(Placard, "dismissOnGrab")) {
          this.dismissPlacard(target);
          return;
        }

        this.hidePlacard(target);
      }),

      this.queries.targetGrabbed.subscribe("disqualify", (target) => {
        if (target.hasComponent(PlacardDismissed)) return;
        this.showPlacard(target);
      }),

      this.queries.targetSnapped.subscribe("qualify", (target) => {
        if (!target.getValue(Placard, "dismissOnSnap")) return;
        this.dismissPlacard(target);
      }),
    );
  }

  update(delta: number) {
    const dtMs = delta * 1000;

    for (const target of this.queries.placardAutoDismiss.entities) {
      const remaining =
        (target.getValue(PlacardAutoDismiss, "remainingMs") ?? 0) - dtMs;

      if (remaining <= 0) {
        target.removeComponent(PlacardAutoDismiss);
        this.dismissPlacard(target);
      } else {
        target.setValue(PlacardAutoDismiss, "remainingMs", remaining);
      }
    }
  }

  private attachPlacard(entity: Entity, spec: PlacardSpec): void {
    if (
      entity.hasComponent(Placard) &&
      !entity.hasComponent(PlacardDismissed) &&
      entity.getValue(Placard, "panelConfig") === spec.panelConfig
    ) {
      return;
    }

    entity.removeComponent(PlacardDismissed).removeComponent(Placard);
    entity.addComponent(Placard, {
      panelConfig: spec.panelConfig,
      maxWidth: spec.maxWidth ?? 0.221,
      offsetX: spec.offsetX ?? 0,
      offsetY: spec.offsetY ?? 0,
      offsetZ: spec.offsetZ ?? 0,
      dismissOnGrab: spec.dismissOnGrab ?? false,
      dismissOnSnap: spec.dismissOnSnap ?? true,
      autoDismissMs: spec.autoDismissMs ?? 0,
    });
  }

  private stripPlacard(entity: Entity): void {
    entity.removeComponent(Placard).removeComponent(PlacardDismissed);
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

  private popInPlacard(placard: Entity): void {
    if (!placard.active) return;

    const doc = placard.getValue(PanelDocument, "document") as
      | UIKitDocument
      | null;
    const root = doc?.getElementById("panel-root") as UIKit.Component | undefined;
    if (root) root.scale.setScalar(0.001);

    placard.removeComponent(PopOut2D);
    if (!placard.hasComponent(PopIn2D)) {
      placard.addComponent(PopIn2D);
    }
  }

  private spawnPlacard(target: Entity): void {
    const targetObj = target.object3D;
    if (!targetObj) return;

    const existing = this.findPlacardForTarget(target);
    if (existing) existing.dispose();

    const config = target.getValue(Placard, "panelConfig")!;
    const maxWidth = target.getValue(Placard, "maxWidth") ?? 0.221;

    const placard = this.world
      .createTransformEntity(undefined, { parent: this.world.sceneEntity })
      .addComponent(PanelUI, { config, maxWidth })
      .addComponent(PlacardInstance, { target })
      .addComponent(Follower, {
        behavior: FollowBehavior.NoRotation,
        target: targetObj,
        offsetPosition: [
          target.getValue(Placard, "offsetX") ?? 0.1,
          target.getValue(Placard, "offsetY") ?? 0.12,
          target.getValue(Placard, "offsetZ") ?? 0,
        ],
      })
      .addComponent(Billboard);

    placard.object3D!.scale.set(0.001, 0.001, 0.001);
    placard.object3D!.visible = true;

    const autoDismissMs = target.getValue(Placard, "autoDismissMs") ?? 0;
    if (autoDismissMs > 0) {
      target.removeComponent(PlacardAutoDismiss);
      target.addComponent(PlacardAutoDismiss, { remainingMs: autoDismissMs });
    }
  }

  private findPlacardForTarget(target: Entity): Entity | undefined {
    for (const placard of this.queries.instances.entities) {
      if (placard.getValue(PlacardInstance, "target") === target) {
        return placard;
      }
    }
    return undefined;
  }

  private hidePlacard(target: Entity): void {
    const placard = this.findPlacardForTarget(target);
    if (!placard) return;
    placard.removeComponent(PopIn2D);
    placard.addComponent(PopOut2D);
  }

  private showPlacard(target: Entity): void {
    const placard = this.findPlacardForTarget(target);
    if (!placard?.object3D) return;
    placard.removeComponent(PopOut2D);
    placard.object3D.visible = true;
    placard.addComponent(PopIn2D);
  }

  private dismissPlacard(target: Entity): void {
    if (target.hasComponent(PlacardDismissed)) return;
    target.addComponent(PlacardDismissed);
  }

  private destroyPlacardForTarget(target: Entity): void {
    target.removeComponent(PlacardAutoDismiss);
    const placard = this.findPlacardForTarget(target);
    placard?.dispose();
  }

  private first(entities: Iterable<Entity>): Entity | undefined {
    for (const entity of entities) return entity;
    return undefined;
  }
}
