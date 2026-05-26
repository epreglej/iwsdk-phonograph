import { AssetManifest, AssetType, SessionMode, World } from "@iwsdk/core";

import { ActiveTask, Task, TaskSystem } from "./task.js";
import { SpawnSystem } from "./spawn.js";
import { AnimationSystem } from "./animations/animation.js";
import { IntroductionWelcomePanelSystem } from "./panels/introductions/welcome.js";
import { IntroductionContentPanelSystem } from "./panels/introductions/content.js";
import { IntroductionInteractionSystem } from "./panels/introductions/interaction.js";
import { PhonographSystem } from "./phonograph/phonograph.js";
import { BillboardSystem } from "./utils/billboard.js";
import { CylinderSystem } from "./phonograph/cylinder.js";
import { HighlightSystem } from "./utils/highlight.js";
import { SnapSystem } from "./utils/snap.js";
import { SnapGhostSystem } from "./utils/snap-ghost.js";
import { TrumpetSystem } from "./phonograph/trumpet.js";
import { DiaphragmSystem } from "./phonograph/diaphragm.js";
import { CrankSystem } from "./phonograph/crank.js";
import { RecordingSystem } from "./utils/recording.js";

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

  world
    .registerSystem(SpawnSystem)
    .registerSystem(TaskSystem)
    .registerSystem(AnimationSystem)
    .registerSystem(BillboardSystem)
    .registerSystem(IntroductionWelcomePanelSystem)
    .registerSystem(IntroductionContentPanelSystem)
    .registerSystem(IntroductionInteractionSystem)
    .registerSystem(HighlightSystem)
    .registerSystem(SnapSystem)
    .registerSystem(SnapGhostSystem)
    .registerSystem(PhonographSystem)
    .registerSystem(CylinderSystem)
    .registerSystem(DiaphragmSystem)
    .registerSystem(TrumpetSystem)
    .registerSystem(CrankSystem)
    .registerSystem(RecordingSystem);

  world
    .createEntity()
    .addComponent(Task, { id: "introduction_welcome" })
    .addComponent(ActiveTask);
});
