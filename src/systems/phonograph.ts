import { createComponent, createSystem, eq, Types } from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "./task-flow.js";
import { PopIn } from "./animation.js";

export const Phonograph = createComponent("Phonograph", {});

export const PhonographPart = createComponent("PhonographPart", {
  id: { type: Types.String, default: "" },
});

export class PhonographSystem extends createSystem({
  activeSetupTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "assembly_intro")],
  },
  phonograph: { required: [Phonograph] },
}) {
  init() {
    this.cleanupFuncs.push(
      this.queries.activeSetupTask.subscribe("qualify", () => {
        const phonographEntity = this.first(this.queries.phonograph.entities);
        if (!phonographEntity?.object3D) return;

        const headY =
          this.world.player?.head?.position.y ?? this.world.camera.position.y;
        const cam = this.world.camera.position;
        phonographEntity.object3D.position.set(cam.x, headY - 0.45, cam.z - 0.8);

        phonographEntity.object3D.scale.setScalar(0.001);
        phonographEntity.addComponent(PopIn);
      }),
    );
  }

  private first(entities: Iterable<import("@iwsdk/core").Entity>): import("@iwsdk/core").Entity | undefined {
    for (const entity of entities) return entity;
    return undefined;
  }
}
