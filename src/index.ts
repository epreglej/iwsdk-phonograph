import { AssetManifest, AssetType, SessionMode, World } from "@iwsdk/core";

import { publicUrl } from "./assets/public-url.js";

import { Task, ActiveTask } from "./systems/task.js";
import { TaskId } from "./systems/task-config.js";
import { TaskFlowSystem } from "./systems/task-flow.js";
import { SpawnSystem } from "./systems/spawn.js";
import { AnimationSystem } from "./systems/animation.js";
import { BillboardSystem } from "./systems/billboard.js";
import { PlacardSystem } from "./systems/placard.js";
import { TaskPanelSystem } from "./systems/task-panel.js";
import { WorldResetSystem } from "./systems/world-reset.js";
import { HighlightSystem } from "./systems/highlight.js";
import { SnapSystem } from "./systems/snap.js";
import { MountSystem } from "./systems/mount.js";
import { UnmountSystem } from "./systems/unmount.js";
import { PhonographSystem } from "./systems/phonograph.js";
import { CylinderSystem } from "./systems/cylinder.js";
import { CrankSystem } from "./systems/crank.js";
import { BrakeSystem } from "./systems/brake.js";
import { InteractionGateSystem } from "./systems/interaction-gate.js";
import { RecordingSystem } from "./systems/recording.js";
import { CarriageSystem } from "./systems/carriage.js";
import { TypewriterSystem } from "./systems/typewriter.js";

const assets: AssetManifest = {
  chimeSound: {
    url: publicUrl("audio/chime.mp3"),
    type: AssetType.Audio,
    priority: "background",
  },
  phonograph: {
    url: "./gltf/phonograph.glb",
    type: AssetType.GLTF,
    priority: "critical",
  },
  cylinder: {
    url: "./gltf/cylinder.glb",
    type: AssetType.GLTF,
    priority: "critical",
  },
  recorder: {
    url: "./gltf/recorder.glb",
    type: AssetType.GLTF,
    priority: "critical",
  },
  reproducer: {
    url: "./gltf/reproducer.glb",
    type: AssetType.GLTF,
    priority: "critical",
  },
  recording_horn: {
    url: "./gltf/recording_horn.glb",
    type: AssetType.GLTF,
    priority: "critical",
  },
  listening_horn: {
    url: "./gltf/listening_horn.glb",
    type: AssetType.GLTF,
    priority: "critical",
  },
  crank: {
    url: "./gltf/crank.glb",
    type: AssetType.GLTF,
    priority: "critical",
  },
  brake: {
    url: "./gltf/brake.glb",
    type: AssetType.GLTF,
    priority: "critical",
  },
  carriage: {
    url: "./gltf/carriage.glb",
    type: AssetType.GLTF,
    priority: "critical",
  },
};

World.create(document.getElementById("scene-container") as HTMLDivElement, {
  assets,
  xr: {
    sessionMode: SessionMode.ImmersiveAR,
    offer: "always",
    features: {
      handTracking: true,
      anchors: true,
      hitTest: true,
      planeDetection: true,
      meshDetection: true,
      layers: true,
    },
  },
  features: {
    locomotion: false,
    grabbing: true,
    physics: false,
    sceneUnderstanding: false,
    environmentRaycast: true,
  },
}).then((world) => {
  const { camera } = world;
  camera.position.set(0, 1, 0.5);

  try {
    world
      .registerSystem(HighlightSystem)
      .registerSystem(AnimationSystem)
      .registerSystem(TypewriterSystem)
      .registerSystem(SpawnSystem)
      .registerSystem(TaskFlowSystem)
      .registerSystem(BillboardSystem)
      .registerSystem(PlacardSystem)
      .registerSystem(TaskPanelSystem)
      .registerSystem(InteractionGateSystem)
      .registerSystem(WorldResetSystem)
      .registerSystem(SnapSystem)
      .registerSystem(MountSystem)
      .registerSystem(UnmountSystem)
      .registerSystem(PhonographSystem)
      .registerSystem(CylinderSystem)
      .registerSystem(CrankSystem)
      .registerSystem(RecordingSystem)
      .registerSystem(BrakeSystem)
      .registerSystem(CarriageSystem);

    world
      .createEntity()
      .addComponent(Task, { id: TaskId.Welcome })
      .addComponent(ActiveTask);
  } catch (error) {
    console.error("Failed to initialize phonograph experience:", error);
  }
}).catch((error) => {
  console.error("Failed to create IWSDK world:", error);
});
