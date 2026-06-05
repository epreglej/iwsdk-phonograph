import { Entity, Object3D, Quaternion, Vector3 } from "@iwsdk/core";
import { PhonographPart } from "../components/phonograph-part.js";
import {
  CARRIAGE_LAYOUT,
  CARRIAGE_PART_IDS,
  CARRIAGE_SNAP_POINT_IDS,
  PART_LAYOUT,
  type Vec3,
} from "../config/phonograph-layout.js";

const _worldPos = new Vector3();
const _worldQuat = new Quaternion();
const _parentWorldQuat = new Quaternion();
const _localQuat = new Quaternion();

export function isCarriageSnapPoint(snapPointId: string): boolean {
  return (CARRIAGE_SNAP_POINT_IDS as readonly string[]).includes(snapPointId);
}

export function isCarriagePart(partId: string | null | undefined): boolean {
  return partId != null && (CARRIAGE_PART_IDS as readonly string[]).includes(partId);
}

export function snapPointLocalOnCarriage(phonographLocal: Vec3): Vec3 {
  const [, cy, cz] = CARRIAGE_LAYOUT.position;
  return [0, phonographLocal[1] - cy, phonographLocal[2] - cz];
}

export function reparentObject3D(child: Object3D, newParent: Object3D): void {
  child.updateWorldMatrix(true, false);
  child.getWorldPosition(_worldPos);
  child.getWorldQuaternion(_worldQuat);

  newParent.add(child);
  newParent.updateWorldMatrix(true, false);
  newParent.worldToLocal(_worldPos);
  child.position.copy(_worldPos);

  newParent.getWorldQuaternion(_parentWorldQuat);
  _parentWorldQuat.invert();
  _localQuat.copy(_parentWorldQuat).multiply(_worldQuat);
  child.quaternion.copy(_localQuat);
}

export function reparentPartToPhonographStaging(
  part: Entity,
  phonographRoot: Object3D,
): void {
  const partId = part.getValue(PhonographPart, "id");
  const layout = PART_LAYOUT.find((entry) => entry.id === partId);
  if (!layout) return;

  const obj = part.object3D;
  if (!obj) return;

  if (obj.parent !== phonographRoot) {
    reparentObject3D(obj, phonographRoot);
  }

  obj.position.set(...layout.position);
  obj.quaternion.set(...layout.quaternion);
}
