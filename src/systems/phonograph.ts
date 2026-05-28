import { createSystem, eq } from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../components/task.js";
import { Phonograph } from "../components/phonograph.js";
import { PopIn } from "../components/animation.js";
import { firstEntity } from "../helpers/entity-query.js";

export class PhonographSystem extends createSystem({
  activeSetupTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "recording_setup_info")],
  },
  phonograph: { required: [Phonograph] },
}) {
  init() {
    this.cleanupFuncs.push(
      this.queries.activeSetupTask.subscribe("qualify", () => {
        const phonographEntity = firstEntity(this.queries.phonograph.entities);
        if (!phonographEntity?.object3D) return;

        const headY =
          this.world.player?.head?.position.y ?? this.world.camera.position.y;
        const cam = this.world.camera.position;
        phonographEntity.object3D.position.set(cam.x, headY - 0.35, cam.z - 0.8);
        
        // Soft entrance even after reset cycles.
        phonographEntity.object3D.scale.setScalar(0.001);
        phonographEntity.object3D.visible = true;
        phonographEntity.addComponent(PopIn);
      }),
    );
  }
}
