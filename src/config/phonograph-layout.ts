type Vec3 = [number, number, number];
type Quat = [number, number, number, number];

const IDENTITY_QUAT: Quat = [0, 0, 0, 1];

export const BRAKE_PLAY = { x: -0.1, y: 0.16, z: 0.0725 };
const BRAKE_SHIFT_X = 0.035;
export const BRAKE_STOP = {
  x: BRAKE_PLAY.x + BRAKE_SHIFT_X,
  y: BRAKE_PLAY.y,
  z: BRAKE_PLAY.z,
};

export type PartBehaviorTag = "cylinder" | "crank" | "brake";

export interface PartLayout {
  id: string;
  assetKey: string;
  position: Vec3;
  quaternion: Quat;
  visible: boolean;
  behaviorTag?: PartBehaviorTag;
}

export interface SnapPointLayout {
  id: string;
  ghostAssetKey: string;
  position: Vec3;
  quaternion: Quat;
}

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
    id: "recorder",
    assetKey: "recorder",
    position: [-0.4, 0.015, 0.1],
    quaternion: IDENTITY_QUAT,
    visible: false,
  },
  {
    id: "reproducer",
    assetKey: "reproducer",
    position: [-0.4, 0.015, 0.1],
    quaternion: IDENTITY_QUAT,
    visible: false,
  },
  {
    id: "recording_horn",
    assetKey: "recording_horn",
    position: [-0.4, 0.1225, 0.1],
    quaternion: [-0.766, 0, 0, 0.6428],
    visible: false,
  },
  {
    id: "listening_horn",
    assetKey: "listening_horn",
    position: [-0.4, 0.1225, 0.1],
    quaternion: [-0.766, 0, 0, 0.6428],
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
    position: [BRAKE_STOP.x, BRAKE_STOP.y, BRAKE_STOP.z],
    quaternion: IDENTITY_QUAT,
    visible: true,
    behaviorTag: "brake",
  },
];

export const SNAP_POINT_LAYOUT: SnapPointLayout[] = [
  {
    id: "cylinder_snap_point",
    ghostAssetKey: "cylinder",
    position: [0.01, 0.23, -0.05],
    quaternion: [-0.000111, 0.005654, -0.019514, 1],
  },
  {
    id: "recorder_snap_point",
    ghostAssetKey: "recorder",
    position: [0.09, 0.2945, -0.016],
    quaternion: [-0.1, -0.002, -0.02, 0.995],
  },
  {
    id: "horn_snap_point",
    ghostAssetKey: "recording_horn",
    position: [0.09025, 0.3955, 0.455],
    quaternion: [-0.78, 0, 0, 0.625],
  },
];
