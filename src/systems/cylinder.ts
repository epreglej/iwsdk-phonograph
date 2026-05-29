import { createSystem, eq } from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../components/task.js";
import { Cylinder } from "../components/phonograph.js";
import { Spin } from "../components/animation.js";
import { firstEntity } from "../helpers/entity-query.js";

export class CylinderSystem extends createSystem({
  activeRecordingTask: {
    required: [Task, ActiveTask],
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
    this.cleanupFuncs.push(
      this.queries.activeRecordingTask.subscribe("qualify", () => this.setSpin(true)),
      this.queries.activeRecordingTask.subscribe("disqualify", () => this.setSpin(false)),
      this.queries.activePlaybackTask.subscribe("qualify", () => this.setSpin(true)),
      this.queries.activePlaybackTask.subscribe("disqualify", () => this.setSpin(false)),
    );
  }

  private setSpin(spinning: boolean): void {
    const cylinder = firstEntity(this.queries.cylinder.entities);
    if (!cylinder) return;
    if (spinning) cylinder.addComponent(Spin);
    else cylinder.removeComponent(Spin);
  }
}
