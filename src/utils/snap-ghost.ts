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
  init() {
    this.cleanupFuncs.push(
      this.queries.grabbedWithSnapGhost.subscribe("qualify", (entity) => {
        const targetId = entity.getValue(Snappable, "snapPointId")!;
        if (!targetId) return;

        for (const sp of this.queries.snapPoints.entities) {
          if (sp.getValue(SnapPoint, "id") !== targetId) continue;

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

            // Animate out before hiding to avoid a blink.
            sp.removeComponent(PopIn);
            sp.addComponent(PopOut);
            sp.removeComponent(Highlight);

            await delay(560);
            if (sp.active) sp.object3D!.visible = false;
            break;
          }
        },
      ),
    );
  }
}
