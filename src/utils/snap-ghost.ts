import { createSystem, Grabbed } from "@iwsdk/core";
import { Highlight } from "./highlight.js";
import { Snappable, SnapGhost, SnapPoint, Snapped } from "./snap.js";
import { PopIn, PopOut } from "../animations/animation.js";
import { delay } from "./delay.js";

export class SnapGhostSystem extends createSystem({
  grabbedWithSnapGhost: {
    required: [Snappable, SnapGhost, Grabbed],
    excluded: [Snapped],
  },
  snapPoints: { required: [SnapPoint] },
}) {
  private hideVersionBySnapPoint = new Map<number, number>();

  private bumpHideVersion(snapPointIndex: number): number {
    const next = (this.hideVersionBySnapPoint.get(snapPointIndex) ?? 0) + 1;
    this.hideVersionBySnapPoint.set(snapPointIndex, next);
    return next;
  }

  init() {
    this.cleanupFuncs.push(
      this.queries.grabbedWithSnapGhost.subscribe("qualify", (entity) => {
        const targetId = entity.getValue(Snappable, "snapPointId")!;
        if (!targetId) return;

        for (const sp of this.queries.snapPoints.entities) {
          if (sp.getValue(SnapPoint, "id") !== targetId) continue;

          // Cancel any pending delayed hide for this snap-point.
          this.bumpHideVersion(sp.index);

          // Smoothly animate the snap ghost in (scale + no pop).
          sp.removeComponent(PopOut);
          sp.object3D!.visible = true;
          sp.addComponent(PopIn);
          sp.addComponent(Highlight);
          break;
        }
      }),

      this.queries.grabbedWithSnapGhost.subscribe(
        "disqualify",
        async (entity) => {
          const targetId = entity.getValue(Snappable, "snapPointId")!;
          if (!targetId) return;

          for (const sp of this.queries.snapPoints.entities) {
            if (sp.getValue(SnapPoint, "id") !== targetId) continue;

            const hideVersion = this.bumpHideVersion(sp.index);

            // Animate out before hiding to avoid a blink.
            sp.removeComponent(PopIn);
            sp.addComponent(PopOut);
            sp.removeComponent(Highlight);

            await delay(560);
            const currentVersion = this.hideVersionBySnapPoint.get(sp.index);
            if (sp.active && currentVersion === hideVersion) {
              sp.object3D!.visible = false;
            }
            break;
          }
        },
      ),
    );
  }
}
