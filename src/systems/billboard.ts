import { createSystem, Vector3 } from "@iwsdk/core";
import { Billboard } from "../components/billboard.js";

export class BillboardSystem extends createSystem({
  billboards: { required: [Billboard] },
}) {
  private lookAtTarget = new Vector3();
  private entityPos = new Vector3();

  update() {
    for (const entity of this.queries.billboards.entities) {
      const obj = entity.object3D!;
      this.player.head.getWorldPosition(this.lookAtTarget);
      obj.getWorldPosition(this.entityPos);

      const lockY = entity.getValue(Billboard, "lockY") as boolean;
      if (lockY) {
        this.lookAtTarget.y = this.entityPos.y;
      }

      obj.lookAt(this.lookAtTarget);
    }
  }
}
