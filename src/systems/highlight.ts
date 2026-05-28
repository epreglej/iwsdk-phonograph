import {
  createSystem,
  Entity,
  Grabbed,
  Mesh,
  MeshBasicMaterial,
  Color,
  Object3D,
} from "@iwsdk/core";
import { Highlight } from "../components/highlight.js";

function isMesh(obj: Object3D): obj is Mesh {
  return (obj as Mesh).isMesh === true && !!(obj as Mesh).geometry;
}

export class HighlightSystem extends createSystem({
  all: { required: [Highlight], excluded: [Grabbed] },
}) {
  private originalMaterials = new Map<
    Entity,
    Map<Mesh, Mesh["material"]>
  >();
  private highlightMaterials: Map<Entity, MeshBasicMaterial> = new Map();
  private highlightBaseOpacity = new Map<Entity, number>();
  private highlightPhase = new Map<Entity, number>();
  private _clockSeconds = 0;
  private tempColor = new Color();

  init() {
    this.queries.all.subscribe("qualify", (entity) => {
      this.applyHighlight(entity);
    });
    this.queries.all.subscribe("disqualify", (entity) => {
      this.removeHighlight(entity);
    });
  }

  private applyHighlight(entity: Entity): void {
    if (this.highlightMaterials.has(entity)) return;

    const root = entity.object3D;
    if (!root) return;

    const highlightMaterial = this.createHighlightMaterial(entity);
    this.highlightMaterials.set(entity, highlightMaterial);
    this.originalMaterials.set(entity, new Map());

    const colorView = entity.getVectorView(Highlight, "color") as Float32Array;
    this.highlightBaseOpacity.set(entity, colorView[3] ?? 0.25);
    this.highlightPhase.set(entity, Math.random() * Math.PI * 2);

    const savedMats = this.originalMaterials.get(entity)!;

    root.traverse((child) => {
      if (isMesh(child)) {
        const originalMat = child.material;
        if (!originalMat) return;

        savedMats.set(child, originalMat as Mesh["material"]);

        const originalMats = Array.isArray(originalMat)
          ? originalMat
          : [originalMat];
        child.material = [...originalMats, highlightMaterial];

        const count = child.geometry.index
          ? child.geometry.index.count
          : child.geometry.attributes.position.count;

        child.geometry.clearGroups();
        child.geometry.addGroup(0, count, 0);
        child.geometry.addGroup(0, count, originalMats.length);
      }
    });
  }

  private removeHighlight(entity: Entity): void {
    const savedMats = this.originalMaterials.get(entity);
    if (!savedMats) return;

    for (const [mesh, originalMat] of savedMats) {
      mesh.material = originalMat;
      mesh.geometry.clearGroups();
    }

    this.originalMaterials.delete(entity);

    const highlightMaterial = this.highlightMaterials.get(entity);
    if (highlightMaterial) {
      highlightMaterial.dispose();
      this.highlightMaterials.delete(entity);
    }

    this.highlightBaseOpacity.delete(entity);
    this.highlightPhase.delete(entity);
  }

  private createHighlightMaterial(entity: Entity): MeshBasicMaterial {
    const colorView = entity.getVectorView(Highlight, "color") as Float32Array;
    this.tempColor.setRGB(colorView[0], colorView[1], colorView[2]);
    return new MeshBasicMaterial({
      color: this.tempColor,
      transparent: true,
      opacity: colorView[3],
      depthTest: true,
      depthWrite: false,
      side: 2,
    });
  }

  stop(): void {
    for (const entity of [...this.originalMaterials.keys()]) {
      this.removeHighlight(entity);
    }
  }

  update(delta: number): void {
    this._clockSeconds += delta;

    const freqHz = 1.6;
    const amp = 0.18;

    for (const [entity, material] of this.highlightMaterials.entries()) {
      const base = this.highlightBaseOpacity.get(entity);
      if (base === undefined) continue;
      const phase = this.highlightPhase.get(entity) ?? 0;
      const pulse = Math.sin(this._clockSeconds * Math.PI * 2 * freqHz + phase);
      const nextOpacity = base * (1 + amp * pulse);
      material.opacity = Math.min(0.95, Math.max(0.04, nextOpacity));
    }
  }
}
