type Vec3 = [number, number, number];
type Quat = [number, number, number, number];

const IDENTITY_QUAT: Quat = [0, 0, 0, 1];

export const BRAKE_HOME = { x: -0.1, y: 0.155, z: 0.0725 };
const BRAKE_SHIFT_X = 0.035;
export const BRAKE_SHIFTED = {
  x: BRAKE_HOME.x + BRAKE_SHIFT_X,
  y: BRAKE_HOME.y,
  z: BRAKE_HOME.z,
};

/** Behaviour tag a part needs in addition to its `PhonographPart` id. */
export type PartBehaviorTag = "cylinder" | "crank" | "brake";

export interface PartLayout {
  /** `PhonographPart` id and lookup key used across systems. */
  id: string;
  /** `AssetManager.getGLTF` key. */
  assetKey: string;
  position: Vec3;
  quaternion: Quat;
  visible: boolean;
  behaviorTag?: PartBehaviorTag;
}

export interface SnapPointLayout {
  /** `SnapPoint` id. */
  id: string;
  /** Mesh cloned into the ghost preview. */
  ghostAssetKey: string;
  position: Vec3;
  quaternion: Quat;
}

/** Single source of truth for every swappable / mechanism part transform. */
export const PART_LAYOUT: PartLayout[] = [
  {
    id: "cylinder",
    assetKey: "cylinder",
    position: [0.4, 0.05, 0.1],
    quaternion: IDENTITY_QUAT,
    visible: false,
    behaviorTag: "cylinder",
  },
  {
    id: "recording_diaphragm",
    assetKey: "recording_diaphragm",
    position: [-0.4, 0, 0.1],
    quaternion: IDENTITY_QUAT,
    visible: false,
  },
  {
    id: "playback_diaphragm",
    assetKey: "playback_diaphragm",
    position: [-0.4, 0, 0.1],
    quaternion: IDENTITY_QUAT,
    visible: false,
  },
  {
    id: "recording_trumpet",
    assetKey: "recording_trumpet",
    position: [0.4, 0.05, 0.065],
    quaternion: [-0.7071, 0, 0, 0.7071],
    visible: false,
  },
  {
    id: "playback_trumpet",
    assetKey: "playback_trumpet",
    position: [0.4, 0.05, 0.065],
    quaternion: [-0.7071, 0, 0, 0.7071],
    visible: false,
  },
  {
    id: "crank",
    assetKey: "crank",
    position: [0.235, 0.078, -0.0365],
    quaternion: IDENTITY_QUAT,
    visible: false,
    behaviorTag: "crank",
  },
  {
    id: "brake",
    assetKey: "brake",
    position: [BRAKE_HOME.x, BRAKE_HOME.y, BRAKE_HOME.z],
    quaternion: IDENTITY_QUAT,
    visible: true,
    behaviorTag: "brake",
  },
];

/** Snap-point ghosts, parented under the phonograph root. */
export const SNAP_POINT_LAYOUT: SnapPointLayout[] = [
  {
    id: "cylinder_snap_point",
    ghostAssetKey: "cylinder",
    position: [0.01, 0.23, -0.05],
    quaternion: [-0.000111, 0.005654, -0.019514, 1],
  },
  {
    id: "diaphragm_snap_point",
    ghostAssetKey: "recording_diaphragm",
    position: [0.09, 0.2945, -0.016],
    quaternion: [-0.1, -0.002, -0.02, 0.995],
  },
  {
    id: "trumpet_snap_point",
    ghostAssetKey: "recording_trumpet",
    position: [0.0903, 0.396, 0.455],
    quaternion: [-0.78, 0, 0, 0.625],
  },
];
