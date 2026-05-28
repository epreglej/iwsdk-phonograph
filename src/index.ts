import { AssetManifest, AssetType, SessionMode, World } from "@iwsdk/core";

import { ActiveTask, Task } from "./components/task.js";
import { TaskSystem } from "./systems/task.js";
import { SpawnSystem } from "./systems/spawn.js";
import { AnimationSystem } from "./systems/animation.js";
import { BillboardSystem } from "./systems/billboard.js";
import { PlacardSystem } from "./systems/placard.js";
import { PlacardTaskSystem } from "./systems/placard-task.js";
import { InteractivePanelSystem } from "./systems/interactive-panel.js";
import { IntroductionWelcomePanelSystem } from "./systems/introduction-welcome.js";
import { IntroductionContentPanelSystem } from "./systems/introduction-content.js";
import { RecordingCountdownSystem } from "./systems/recording-countdown.js";
import { HighlightSystem } from "./systems/highlight.js";
import { SnapSystem } from "./systems/snap.js";
import { SnapGhostSystem } from "./systems/snap-ghost.js";
import { PartMountSystem } from "./systems/part-mount.js";
import { TaskSnapCompletionSystem } from "./systems/task-snap-completion.js";
import { PartUnmountSystem } from "./systems/part-unmount.js";
import { PhonographSystem } from "./systems/phonograph.js";
import { CylinderSystem } from "./systems/cylinder.js";
import { CrankSystem } from "./systems/crank.js";
import { RecordingSystem } from "./systems/recording.js";

const assets: AssetManifest = {
  chimeSound: {
    url: "/audio/chime.mp3",
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
  recording_diaphragm: {
    url: "./gltf/recording_diaphragm.glb",
    type: AssetType.GLTF,
    priority: "critical",
  },
  playback_diaphragm: {
    url: "./gltf/playback_diaphragm.glb",
    type: AssetType.GLTF,
    priority: "critical",
  },
  recording_trumpet: {
    url: "./gltf/recording_trumpet.glb",
    type: AssetType.GLTF,
    priority: "critical",
  },
  playback_trumpet: {
    url: "./gltf/playback_trumpet.glb",
    type: AssetType.GLTF,
    priority: "critical",
  },
  crank: {
    url: "./gltf/crank.glb",
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
      .registerSystem(SpawnSystem)
      .registerSystem(TaskSystem)
      .registerSystem(BillboardSystem)
      .registerSystem(PlacardSystem)
      .registerSystem(PlacardTaskSystem)
      .registerSystem(InteractivePanelSystem)
      .registerSystem(IntroductionWelcomePanelSystem)
      .registerSystem(IntroductionContentPanelSystem)
      .registerSystem(RecordingCountdownSystem)
      .registerSystem(SnapSystem)
      .registerSystem(SnapGhostSystem)
      .registerSystem(PartMountSystem)
      .registerSystem(TaskSnapCompletionSystem)
      .registerSystem(PartUnmountSystem)
      .registerSystem(PhonographSystem)
      .registerSystem(CylinderSystem)
      .registerSystem(CrankSystem)
      .registerSystem(RecordingSystem);

    world
      .createEntity()
      .addComponent(Task, { id: "introduction_welcome" })
      .addComponent(ActiveTask);
  } catch (error) {
    console.error("Failed to initialize phonograph experience:", error);
  }
}).catch((error) => {
  console.error("Failed to create IWSDK world:", error);
});
