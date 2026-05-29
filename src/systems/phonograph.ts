import { createSystem, eq } from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../components/task.js";
import { Phonograph } from "../components/phonograph.js";
import { firstEntity } from "../helpers/entity-query.js";
import { popInFromZero } from "../helpers/pop.js";

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
        phonographEntity.object3D.position.set(cam.x, headY - 0.45, cam.z - 0.8);

        popInFromZero(phonographEntity);
      }),
    );
  }
}
