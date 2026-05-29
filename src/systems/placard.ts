import {
  createSystem,
  Entity,
  FollowBehavior,
  Follower,
  Grabbed,
  PanelDocument,
  PanelUI,
  UIKit,
  UIKitDocument,
} from "@iwsdk/core";
import { Placard, PlacardDismissed, PlacardInstance } from "../components/placard.js";
import { PopIn2D, PopOut2D } from "../components/animation.js";
import { Billboard } from "../components/billboard.js";
import { Snapped } from "../components/snap.js";

export class PlacardSystem extends createSystem({
  targets: { required: [Placard], excluded: [PlacardDismissed] },
  instances: { required: [PlacardInstance] },
  instanceDocs: { required: [PlacardInstance, PanelDocument] },
  targetGrabbed: { required: [Placard, Grabbed] },
  targetSnapped: { required: [Placard, Snapped] },
}) {
  private dismissTimers = new Map<number, ReturnType<typeof setTimeout>>();

  init() {
    this.cleanupFuncs.push(
      this.queries.targets.subscribe("qualify", (target) => {
        this.spawnPlacard(target);
      }),

      this.queries.targets.subscribe("disqualify", (target) => {
        this.clearDismissTimer(target.index);
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
    if (!targetObj || this.findPlacardForTarget(target)) return;

    const config = target.getValue(Placard, "panelConfig")!;

    const placard = this.world
      .createTransformEntity(undefined, { parent: this.world.sceneEntity })
      .addComponent(PanelUI, { config, maxWidth: 0.221 })
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
      const timer = setTimeout(() => {
        this.dismissTimers.delete(target.index);
        if (target.active && !target.hasComponent(PlacardDismissed)) {
          this.dismissPlacard(target);
        }
      }, autoDismissMs);
      this.dismissTimers.set(target.index, timer);
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
    this.clearDismissTimer(target.index);
    const placard = this.findPlacardForTarget(target);
    placard?.dispose();
  }

  private clearDismissTimer(targetIndex: number): void {
    const timer = this.dismissTimers.get(targetIndex);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.dismissTimers.delete(targetIndex);
    }
  }
}
