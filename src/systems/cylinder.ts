import { createSystem, eq } from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../components/task.js";
import { Cylinder } from "../components/phonograph.js";
import { Spin } from "../components/animation.js";
import { firstEntity } from "../helpers/entity-query.js";
import { RecordingArmed } from "../components/recording-armed.js";

export class CylinderSystem extends createSystem({
  activeRecordingTask: {
    required: [Task, ActiveTask, RecordingArmed],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "recording")],
  },
  activePlaybackTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "playback")],
  },
  cylinder: { required: [Cylinder] },
}) {
  init() {
    const cylinderEntity = firstEntity(this.queries.cylinder.entities);
    if (!cylinderEntity) return;

    this.cleanupFuncs.push(
      this.queries.activeRecordingTask.subscribe("qualify", () => {
        cylinderEntity.addComponent(Spin);
      }),
      this.queries.activeRecordingTask.subscribe("disqualify", () => {
        cylinderEntity.removeComponent(Spin);
      }),
      this.queries.activePlaybackTask.subscribe("qualify", () => {
        cylinderEntity.addComponent(Spin);
      }),
      this.queries.activePlaybackTask.subscribe("disqualify", () => {
        cylinderEntity.removeComponent(Spin);
      }),
    );
  }
}
