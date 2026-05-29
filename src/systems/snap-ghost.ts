import { createSystem, Entity, Grabbed } from "@iwsdk/core";
import { Snappable, SnapGhost, SnapPoint, Snapped } from "../components/snap.js";
import { PopIn, PopOut, PopOutDone } from "../components/animation.js";

export class SnapGhostSystem extends createSystem({
  grabbedWithSnapGhost: {
    required: [Snappable, SnapGhost, Grabbed],
    excluded: [Snapped],
  },
  snappedWithGhost: { required: [Snappable, SnapGhost, Snapped] },
  ghostPoppedOut: { required: [SnapPoint, PopOutDone] },
  snapPoints: { required: [SnapPoint] },
}) {
  init() {
    this.cleanupFuncs.push(
      this.queries.grabbedWithSnapGhost.subscribe("qualify", (entity) => {
        const sp = this.snapPointFor(entity);
        if (!sp?.object3D) return;
        sp.removeComponent(PopOut);
        sp.object3D.visible = true;
        sp.addComponent(PopIn);
      }),

      this.queries.grabbedWithSnapGhost.subscribe("disqualify", (entity) => {
        // A part that snapped hides its ghost instantly (see snappedWithGhost),
        // so only pop out when the part was released without snapping.
        if (entity.hasComponent(Snapped)) return;
        const sp = this.snapPointFor(entity);
        if (!sp) return;
        sp.removeComponent(PopIn);
        sp.addComponent(PopOut);
      }),

      // Part snapped into place: drop the ghost immediately, cancelling any
      // pop-out the release may have started.
      this.queries.snappedWithGhost.subscribe("qualify", (entity) => {
        const sp = this.snapPointFor(entity);
        if (!sp?.object3D) return;
        sp.removeComponent(PopIn).removeComponent(PopOut);
        sp.object3D.visible = false;
      }),

      // The pop-out ran to completion: hide the ghost. If the part is re-grabbed
      // mid-pop-out, PopOut is removed before it finishes, so no PopOutDone is
      // emitted and the ghost simply stays visible — no version tracking needed.
      this.queries.ghostPoppedOut.subscribe("qualify", (sp) => {
        if (sp.object3D) sp.object3D.visible = false;
      }),
    );
  }

  private snapPointFor(entity: Entity): Entity | undefined {
    const targetId = entity.getValue(Snappable, "snapPointId");
    if (!targetId) return undefined;
    for (const sp of this.queries.snapPoints.entities) {
      if (sp.getValue(SnapPoint, "id") === targetId) return sp;
    }
    return undefined;
  }
}
