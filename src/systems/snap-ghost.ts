import { createSystem, Grabbed } from "@iwsdk/core";
import { Snappable, SnapGhost, SnapPoint, Snapped } from "../components/snap.js";
import { PopIn, PopOut } from "../components/animation.js";
import { delay } from "../helpers/delay.js";

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

          this.bumpHideVersion(sp.index);

          sp.removeComponent(PopOut);
          sp.object3D!.visible = true;
          sp.addComponent(PopIn);
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

            sp.removeComponent(PopIn);
            sp.addComponent(PopOut);

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
