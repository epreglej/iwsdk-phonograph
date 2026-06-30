import { createComponent, createSystem, Entity, eq, Quaternion, Types, Vector3 } from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "./task.js";
import { PHONOGRAPH_SPAWN_BELOW_HEAD_M, PHONOGRAPH_SPAWN_FORWARD_M, TaskId } from "./task-config.js";
import { PopIn } from "./animation.js";

export const Phonograph = createComponent("Phonograph", {});

/** Fixed world anchor where the phonograph will appear (set when Welcome completes). */
export const PhonographSpawnAnchor = createComponent("PhonographSpawnAnchor", {});

export const PhonographPart = createComponent("PhonographPart", {
  id: { type: Types.String, default: "" },
});

export function computePhonographSpawnPosition(
  camX: number,
  camZ: number,
  headY: number,
  headQuat: Quaternion,
  forward: Vector3,
): { x: number; y: number; z: number } {
  forward.set(0, 0, -1).applyQuaternion(headQuat);
  forward.y = 0;
  if (forward.lengthSq() < 0.001) forward.set(0, 0, -1);
  forward.normalize();

  const y = headY - PHONOGRAPH_SPAWN_BELOW_HEAD_M;
  return {
    x: camX + forward.x * PHONOGRAPH_SPAWN_FORWARD_M,
    y,
    z: camZ + forward.z * PHONOGRAPH_SPAWN_FORWARD_M,
  };
}

export class PhonographSystem extends createSystem({
  activeSetupTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", TaskId.AssemblyCylinderMount)],
  },
  completedWelcomeTask: {
    required: [Task, ActiveTask, CompletedTask],
    where: [eq(Task, "id", TaskId.Welcome)],
  },
  activeWelcomeTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", TaskId.Welcome)],
  },
  phonograph: { required: [Phonograph] },
  spawnAnchor: { required: [PhonographSpawnAnchor] },
}) {
  private forward!: Vector3;
  private spawnQuat!: Quaternion;
  private spawnCamX = 0;
  private spawnCamZ = 0;
  private spawnHeadY = 0;
  private spawnAnchorEntity: Entity | null = null;

  init() {
    this.forward = new Vector3();
    this.spawnQuat = new Quaternion();

    this.cleanupFuncs.push(
      this.queries.activeWelcomeTask.subscribe("qualify", () => {
        this.destroySpawnAnchor();
      }),

      // Snapshot camera state the moment the user presses the Start button
      this.queries.completedWelcomeTask.subscribe("qualify", () => {
        const head = this.world.player?.head;
        this.spawnCamX = this.world.camera.position.x;
        this.spawnCamZ = this.world.camera.position.z;
        this.spawnHeadY = head?.position.y ?? this.world.camera.position.y;
        this.spawnQuat.copy(head?.quaternion ?? this.world.camera.quaternion);
        this.ensureSpawnAnchor();
      }),

      this.queries.activeSetupTask.subscribe("qualify", () => {
        const phonographEntity = this.first(this.queries.phonograph.entities);
        if (!phonographEntity?.object3D) return;

        const spawn = computePhonographSpawnPosition(
          this.spawnCamX,
          this.spawnCamZ,
          this.spawnHeadY,
          this.spawnQuat,
          this.forward,
        );

        phonographEntity.object3D.position.set(spawn.x, spawn.y, spawn.z);
        phonographEntity.object3D.lookAt(this.spawnCamX, spawn.y, this.spawnCamZ);

        phonographEntity.object3D.scale.setScalar(0.001);
        phonographEntity.addComponent(PopIn);
        this.destroySpawnAnchor();
      }),
    );
  }

  private ensureSpawnAnchor(): void {
    const spawn = computePhonographSpawnPosition(
      this.spawnCamX,
      this.spawnCamZ,
      this.spawnHeadY,
      this.spawnQuat,
      this.forward,
    );

    let anchor = this.spawnAnchorEntity;
    if (!anchor?.active) {
      anchor = this.world
        .createTransformEntity(undefined, { parent: this.world.sceneEntity })
        .addComponent(PhonographSpawnAnchor);
      this.spawnAnchorEntity = anchor;
    }

    const obj = anchor.object3D;
    if (!obj) return;

    obj.position.set(spawn.x, spawn.y, spawn.z);
    obj.lookAt(this.spawnCamX, spawn.y, this.spawnCamZ);
    obj.visible = false;
  }

  private destroySpawnAnchor(): void {
    if (!this.spawnAnchorEntity?.active) {
      this.spawnAnchorEntity = null;
      return;
    }
    this.spawnAnchorEntity.dispose();
    this.spawnAnchorEntity = null;
  }

  private first(entities: Iterable<Entity>): Entity | undefined {
    for (const entity of entities) return entity;
    return undefined;
  }
}
