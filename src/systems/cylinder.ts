import { createComponent, createSystem, eq } from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "./task-flow.js";
import { Spin } from "./animation.js";

export const Cylinder = createComponent("Cylinder", {});

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
    const cylinder = this.first(this.queries.cylinder.entities);
    if (!cylinder) return;
    if (spinning) cylinder.addComponent(Spin);
    else cylinder.removeComponent(Spin);
  }

  private first(entities: Iterable<import("@iwsdk/core").Entity>): import("@iwsdk/core").Entity | undefined {
    for (const entity of entities) return entity;
    return undefined;
  }
}
