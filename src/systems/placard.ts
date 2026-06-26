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
import { Task, ActiveTask, CompletedTask } from "./task.js";
import { PhonographPart, PhonographSpawnAnchor } from "./phonograph.js";
import { Crank, CrankingComplete } from "./crank.js";
import {
  isPartPopInComplete,
  PANEL_SPAWN_AFTER_PART_POP_IN_MS,
  PANEL_SPAWN_DELAY_PENDING,
  PopIn2D,
  PopOut2D,
} from "./animation.js";
import { Billboard } from "./billboard.js";
import { hidePanelEntity, stripPanelSurface } from "./panel-lifecycle.js";
import { Snapped } from "./snap.js";
import {
  PANEL_MAX_WIDTH,
  PHONOGRAPH_ABOVE_OFFSET_Y,
  PLACARDS_BY_TASK,
  TASK_ORDER,
  type PlacardBinding,
  type PlacardSpec,
} from "./task-config.js";

export const Placard = createComponent("Placard", {
  panelConfig: { type: Types.String, default: "" },
  maxWidth: { type: Types.Float32, default: PANEL_MAX_WIDTH },
  offsetX: { type: Types.Float32, default: 0 },
  offsetY: { type: Types.Float32, default: 0 },
  offsetZ: { type: Types.Float32, default: 0 },
  dismissOnGrab: { type: Types.Boolean, default: false },
  dismissOnSnap: { type: Types.Boolean, default: true },
  autoDismissMs: { type: Types.Float32, default: 0 },
  skipPartPopInWait: { type: Types.Boolean, default: false },
  spawnDelayRemainingMs: { type: Types.Float32, default: -1 },
});

export const PlacardDismissed = createComponent("PlacardDismissed", {});

export const PlacardAutoDismiss = createComponent("PlacardAutoDismiss", {
  remainingMs: { type: Types.Float32, default: 0 },
});

export const PlacardInstance = createComponent("PlacardInstance", {
  target: { type: Types.Entity, default: null },
});

/** Wait until the follow target finishes its 3D pop-in before spawning the panel. */
export const PlacardPendingSpawn = createComponent("PlacardPendingSpawn", {});

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
  placardPendingSpawn: {
    required: [Placard, PlacardPendingSpawn],
    excluded: [PlacardDismissed],
  },
  targets: { required: [Placard], excluded: [PlacardDismissed] },
  instances: { required: [PlacardInstance] },
  instanceDocs: { required: [PlacardInstance, PanelDocument] },
  targetGrabbed: { required: [Placard, Grabbed] },
  targetSnapped: { required: [Placard, Snapped] },
  spawnAnchor: { required: [PhonographSpawnAnchor] },
}) {
  init() {
    this.cleanupFuncs.push(
      this.queries.activeTask.subscribe("qualify", (taskEntity) => {
        const bindings = PLACARDS_BY_TASK[taskEntity.getValue(Task, "id")!];
        if (!bindings) return;

        for (const binding of bindings) {
          const target = this.resolvePlacardTarget(binding);
          if (target) this.attachPlacard(target, binding.placard);
        }
      }),

      this.queries.activeTask.subscribe("disqualify", (taskEntity) => {
        const taskId = taskEntity.getValue(Task, "id")!;
        const bindings = PLACARDS_BY_TASK[taskId];
        if (!bindings) return;

        for (const binding of bindings) {
          if (!this.shouldStripPlacard(taskId, binding)) continue;
          const target = this.resolvePlacardTarget(binding);
          if (target) this.stripPlacard(target);
        }
      }),

      this.queries.crankComplete.subscribe("qualify", () => {
        const crank = this.first(this.queries.crankPart.entities);
        if (crank) this.stripPlacard(crank);
      }),

      this.queries.targets.subscribe("disqualify", (target) => {
        target.removeComponent(PlacardAutoDismiss);
        this.destroyPlacardForTarget(target);
      }),

      this.queries.instances.subscribe("disqualify", (placard) => {
        placard.removeComponent(PlacardInstance);
        hidePanelEntity(placard);
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

      this.queries.spawnAnchor.subscribe("qualify", () => {
        for (const taskEntity of this.queries.activeTask.entities) {
          const bindings = PLACARDS_BY_TASK[taskEntity.getValue(Task, "id")!];
          if (!bindings) continue;
          for (const binding of bindings) {
            if (binding.anchor !== "phonograph_spawn") continue;
            const target = this.resolvePlacardTarget(binding);
            if (target) this.attachPlacard(target, binding.placard);
          }
        }
      }),
    );
  }

  update(delta: number) {
    const dtMs = delta * 1000;

    for (const target of this.queries.targets.entities) {
      if (this.findPlacardForTarget(target)) continue;

      if (!isPartPopInComplete(target)) {
        if (!target.getValue(Placard, "skipPartPopInWait")) {
          if (!target.hasComponent(PlacardPendingSpawn)) {
            target.addComponent(PlacardPendingSpawn);
          }
          continue;
        }
      }

      target.removeComponent(PlacardPendingSpawn);

      const remaining =
        target.getValue(Placard, "spawnDelayRemainingMs") ??
        PANEL_SPAWN_DELAY_PENDING;

      if (remaining === PANEL_SPAWN_DELAY_PENDING) {
        target.setValue(
          Placard,
          "spawnDelayRemainingMs",
          PANEL_SPAWN_AFTER_PART_POP_IN_MS,
        );
        continue;
      }

      if (remaining > 0) {
        target.setValue(
          Placard,
          "spawnDelayRemainingMs",
          Math.max(0, remaining - dtMs),
        );
        continue;
      }

      this.spawnPlacard(target);
    }

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

  private shouldStripPlacard(taskId: string, binding: PlacardBinding): boolean {
    for (const other of this.queries.activeTask.entities) {
      const otherBindings = PLACARDS_BY_TASK[other.getValue(Task, "id")!];
      if (
        otherBindings?.some(
          (b) =>
            b.anchor === binding.anchor &&
            b.partId === binding.partId &&
            b.placard.panelConfig === binding.placard.panelConfig,
        )
      ) {
        return false;
      }
    }

    const nextId = this.nextTaskId(taskId);
    const nextBindings = nextId ? PLACARDS_BY_TASK[nextId] : undefined;
    if (
      nextBindings?.some(
        (b) =>
          b.anchor === binding.anchor &&
          b.partId === binding.partId &&
          b.placard.panelConfig === binding.placard.panelConfig,
      )
    ) {
      return false;
    }

    return true;
  }

  private resolvePlacardTarget(binding: PlacardBinding): Entity | undefined {
    if (binding.anchor === "head") return this.playerHeadEntity;
    if (binding.anchor === "phonograph_spawn") {
      return this.first(this.queries.spawnAnchor.entities);
    }
    if (!binding.partId) return undefined;
    return this.partById(binding.partId);
  }

  private attachPlacard(entity: Entity, spec: PlacardSpec): void {
    if (
      entity.hasComponent(Placard) &&
      !entity.hasComponent(PlacardDismissed) &&
      entity.getValue(Placard, "panelConfig") === spec.panelConfig
    ) {
      return;
    }

    const partId = entity.getValue(PhonographPart, "id");
    const offsetY =
      spec.offsetY ??
      (partId === "phonograph" ? PHONOGRAPH_ABOVE_OFFSET_Y : 0.2);

    entity.removeComponent(PlacardDismissed).removeComponent(Placard);
    entity.addComponent(Placard, {
      panelConfig: spec.panelConfig,
      maxWidth: spec.maxWidth ?? PANEL_MAX_WIDTH,
      offsetX: spec.offsetX ?? 0,
      offsetY,
      offsetZ: spec.offsetZ ?? 0,
      dismissOnGrab: spec.dismissOnGrab ?? false,
      dismissOnSnap: spec.dismissOnSnap ?? true,
      autoDismissMs: spec.autoDismissMs ?? 0,
      skipPartPopInWait: spec.skipPartPopInWait ?? false,
      spawnDelayRemainingMs: spec.skipPartPopInWait
        ? 0
        : PANEL_SPAWN_DELAY_PENDING,
    });
  }

  private stripPlacard(entity: Entity): void {
    entity
      .removeComponent(Placard)
      .removeComponent(PlacardDismissed)
      .removeComponent(PlacardPendingSpawn);
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

    stripPanelSurface(placard);
    if (!placard.hasComponent(PopIn2D)) {
      placard.addComponent(PopIn2D);
    }
  }

  private spawnPlacard(target: Entity): void {
    const targetObj = target.object3D;
    if (!targetObj) return;

    target.removeComponent(PlacardPendingSpawn);

    const existing = this.findPlacardForTarget(target);
    if (existing) {
      existing.removeComponent(PlacardInstance);
      hidePanelEntity(existing);
    }

    const config = target.getValue(Placard, "panelConfig")!;
    const maxWidth = target.getValue(Placard, "maxWidth") ?? PANEL_MAX_WIDTH;

    const placard = this.world
      .createTransformEntity(undefined, { parent: this.world.sceneEntity })
      .addComponent(PanelUI, { config, maxWidth })
      .addComponent(PlacardInstance, { target })
      .addComponent(Follower, {
        behavior: FollowBehavior.NoRotation,
        target: targetObj,
        offsetPosition: [
          target.getValue(Placard, "offsetX") ?? 0,
          target.getValue(Placard, "offsetY") ?? 0.2,
          target.getValue(Placard, "offsetZ") ?? 0,
        ],
      })
      .addComponent(Billboard);

    placard.object3D!.scale.setScalar(1);
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
    if (placard?.object3D?.visible) {
      placard.object3D.visible = false;
    }
  }

  private showPlacard(target: Entity): void {
    const placard = this.findPlacardForTarget(target);
    if (placard?.object3D) {
      placard.object3D.visible = true;
    }
  }

  private dismissPlacard(target: Entity): void {
    if (target.hasComponent(PlacardDismissed)) return;
    target.addComponent(PlacardDismissed);
  }

  private destroyPlacardForTarget(target: Entity): void {
    target.removeComponent(PlacardAutoDismiss).removeComponent(PlacardPendingSpawn);
    const placard = this.findPlacardForTarget(target);
    if (!placard) return;
    placard.removeComponent(PlacardInstance);
    hidePanelEntity(placard);
  }

  private first(entities: Iterable<Entity>): Entity | undefined {
    for (const entity of entities) return entity;
    return undefined;
  }
}
