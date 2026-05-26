import { createSystem, Grabbed } from "@iwsdk/core";
import { Highlight } from "./highlight.js";
import { Snappable, SnapGhost, SnapPoint, Snapped } from "./snap.js";

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
          sp.object3D!.visible = true;
          sp.addComponent(Highlight);
          break;
        }
      }),

      this.queries.grabbedWithSnapGhost.subscribe("disqualify", (entity) => {
        const targetId = entity.getValue(Snappable, "snapPointId")!;

        for (const sp of this.queries.snapPoints.entities) {
          if (sp.getValue(SnapPoint, "id") !== targetId) continue;
          sp.object3D!.visible = false;
          sp.removeComponent(Highlight);
          break;
        }
      }),
    );
  }
}
