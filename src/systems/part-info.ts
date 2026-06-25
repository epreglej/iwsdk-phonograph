import {
  createComponent,
  createSystem,
  Entity,
  FollowBehavior,
  Follower,
  Grabbed,
  Object3D,
  PanelDocument,
  PanelUI,
  PokeInteractable,
  Types,
  UIKit,
  UIKitDocument,
} from "@iwsdk/core";
import { PopIn, PopIn2D, PopInDone, PopOut2D } from "./animation.js";
import { Billboard } from "./billboard.js";
import { resumeAudioContext } from "../audio/context.js";
import { PhonographPart } from "./phonograph.js";
import { Snapped } from "./snap.js";
import { Task, ActiveTask, CompletedTask } from "./task.js";
import { NAME_TAGS_BY_TASK } from "./task-config.js";
import {
  DETAIL_PANEL_MAX_WIDTH,
  NAME_TAG_MAX_WIDTH,
  PANEL_OFFSET_Y,
  nameTagSpecForTaskPart,
} from "./part-info-config.js";

/** Lerp speed for part-attached panels (default Follower speed is 1). */
const PANEL_FOLLOW_SPEED = 12;
/** Max positional slack before the panel snaps to catch up (default is 0.4m). */
const PANEL_FOLLOW_TOLERANCE = 0.05;

export const PartNameTag = createComponent("PartNameTag", {
  nameTagConfig: { type: Types.String, default: "" },
  detailConfig: { type: Types.String, default: "" },
  maxWidth: { type: Types.Float32, default: NAME_TAG_MAX_WIDTH },
  detailMaxWidth: { type: Types.Float32, default: DETAIL_PANEL_MAX_WIDTH },
  offsetX: { type: Types.Float32, default: 0 },
  offsetY: { type: Types.Float32, default: PANEL_OFFSET_Y },
  offsetZ: { type: Types.Float32, default: 0 },
  infoButtonId: { type: Types.String, default: "" },
  closeButtonId: { type: Types.String, default: "" },
});

export const PartNameTagInstance = createComponent("PartNameTagInstance", {
  part: { type: Types.Entity, default: null },
});

export const PartNameTagWired = createComponent("PartNameTagWired", {});
export const PartNameTagPendingSpawn = createComponent("PartNameTagPendingSpawn", {});
/** Name tag is popping out before the detail panel replaces it. */
export const PartNameTagSwappingOut = createComponent("PartNameTagSwappingOut", {
  part: { type: Types.Entity, default: null },
  popOutStarted: { type: Types.Boolean, default: false },
});

export const PartInfoDetailInstance = createComponent("PartInfoDetailInstance", {
  part: { type: Types.Entity, default: null },
  closeButtonId: { type: Types.String, default: "" },
});
export const PartInfoDetailWired = createComponent("PartInfoDetailWired", {});
/** Detail panel is popping out before the name tag returns. */
export const PartInfoDetailSwappingOut = createComponent("PartInfoDetailSwappingOut", {
  part: { type: Types.Entity, default: null },
  popOutStarted: { type: Types.Boolean, default: false },
});

export class PartInfoSystem extends createSystem({
  parts: { required: [PhonographPart] },
  activeTask: { required: [Task, ActiveTask], excluded: [CompletedTask] },
  snappedParts: { required: [PhonographPart, Snapped] },
  taggedParts: { required: [PartNameTag] },
  taggedPartsPopInDone: { required: [PartNameTag, PopInDone] },
  taggedPartsGrabbed: { required: [PartNameTag, Grabbed] },
  nameTagPendingSpawn: {
    required: [PartNameTag, PartNameTagPendingSpawn],
  },
  nameTagInstances: { required: [PartNameTagInstance] },
  nameTagDocs: { required: [PartNameTagInstance, PanelDocument] },
  wiredNameTags: {
    required: [PartNameTagInstance, PartNameTagWired],
  },
  nameTagSwappingOut: {
    required: [PartNameTagInstance, PartNameTagSwappingOut],
  },
  detailInstances: { required: [PartInfoDetailInstance] },
  detailDocs: { required: [PartInfoDetailInstance, PanelDocument] },
  wiredDetails: {
    required: [PartInfoDetailInstance, PartInfoDetailWired],
  },
  detailSwappingOut: {
    required: [PartInfoDetailInstance, PartInfoDetailSwappingOut],
  },
}) {
  private readonly pendingOpen: Entity[] = [];
  private readonly pendingClose: Entity[] = [];
  private readonly pendingNameTagWiring: Entity[] = [];
  private readonly pendingDetailWiring: Entity[] = [];

  init() {
    this.cleanupFuncs.push(
      this.queries.activeTask.subscribe("qualify", (taskEntity) => {
        const taskId = taskEntity.getValue(Task, "id")!;
        this.applyNameTagForTask(taskId);
      }),

      this.queries.activeTask.subscribe("disqualify", (taskEntity) => {
        const taskId = taskEntity.getValue(Task, "id")!;
        this.removeNameTagForTask(taskId);
      }),

      this.queries.snappedParts.subscribe("qualify", (part) => {
        this.removePartNameTag(part);
      }),

      this.queries.taggedParts.subscribe("qualify", (part) => {
        this.trySpawnNameTag(part);
      }),

      this.queries.taggedPartsPopInDone.subscribe("qualify", (part) => {
        this.trySpawnNameTag(part);
      }),

      this.queries.taggedParts.subscribe("disqualify", (part) => {
        part.removeComponent(PartNameTagPendingSpawn);
        this.destroyPanelsForPart(part);
      }),

      this.queries.nameTagPendingSpawn.subscribe("qualify", () => {
        for (const part of this.queries.nameTagPendingSpawn.entities) {
          this.trySpawnNameTag(part);
        }
      }),

      this.queries.taggedPartsGrabbed.subscribe("qualify", (part) => {
        this.hidePartPanels(part);
      }),

      this.queries.taggedPartsGrabbed.subscribe("disqualify", (part) => {
        this.showPartPanels(part);
      }),

      this.queries.nameTagDocs.subscribe("qualify", (panel) => {
        this.popInPanel(panel);
        this.pendingNameTagWiring.push(panel);
      }),

      this.queries.detailDocs.subscribe("qualify", (panel) => {
        this.popInPanel(panel);
        this.pendingDetailWiring.push(panel);
      }),
    );

    for (const part of this.queries.taggedParts.entities) {
      this.trySpawnNameTag(part);
    }
  }

  update() {
    this.processNameTagSwapOut();
    this.processDetailSwapOut();
    this.processPendingWiring();

    for (const part of this.queries.taggedParts.entities) {
      if (!part.object3D?.visible) {
        this.destroyPanelsForPart(part);
        continue;
      }

      if (
        this.canSpawnNameTag(part) &&
        !this.findNameTagForPart(part) &&
        !this.isDetailOpenForPart(part) &&
        !this.isNameTagSwappingOut(part)
      ) {
        part.removeComponent(PartNameTagPendingSpawn);
        this.spawnNameTag(part);
      }
    }
  }

  private processNameTagSwapOut(): void {
    this.pendingOpen.length = 0;
    for (const panel of this.queries.nameTagSwappingOut.entities) {
      if (!panel.getValue(PartNameTagSwappingOut, "popOutStarted")) continue;
      if (!panel.hasComponent(PopOut2D)) {
        this.pendingOpen.push(panel);
      }
    }

    for (const nameTagPanel of this.pendingOpen) {
      if (!nameTagPanel.active) continue;

      const part = nameTagPanel.getValue(PartNameTagSwappingOut, "part");
      nameTagPanel.removeComponent(PartNameTagSwappingOut);
      if (nameTagPanel.object3D) nameTagPanel.object3D.visible = false;

      if (part?.active) {
        this.spawnDetailPanel(part);
      }
    }
  }

  private processDetailSwapOut(): void {
    this.pendingClose.length = 0;
    for (const panel of this.queries.detailSwappingOut.entities) {
      if (!panel.getValue(PartInfoDetailSwappingOut, "popOutStarted")) continue;
      if (!panel.hasComponent(PopOut2D)) {
        this.pendingClose.push(panel);
      }
    }

    for (const detailPanel of this.pendingClose) {
      if (!detailPanel.active) continue;

      const part = detailPanel.getValue(PartInfoDetailSwappingOut, "part");
      this.teardownDetailPanel(detailPanel);

      if (part?.active) {
        this.restoreNameTag(part);
      }
    }
  }

  private processPendingWiring(): void {
    for (const panel of this.pendingNameTagWiring) {
      if (panel.active) this.wireNameTag(panel);
    }
    this.pendingNameTagWiring.length = 0;

    for (const panel of this.pendingDetailWiring) {
      if (panel.active) this.wireDetailPanel(panel);
    }
    this.pendingDetailWiring.length = 0;
  }

  private trySpawnNameTag(part: Entity): void {
    if (!part.object3D?.visible) {
      if (!part.hasComponent(PartNameTagPendingSpawn)) {
        part.addComponent(PartNameTagPendingSpawn);
      }
      return;
    }

    if (
      this.canSpawnNameTag(part) &&
      !this.findNameTagForPart(part) &&
      !this.isDetailOpenForPart(part) &&
      !this.isNameTagSwappingOut(part)
    ) {
      part.removeComponent(PartNameTagPendingSpawn);
      this.spawnNameTag(part);
      return;
    }

    if (!part.hasComponent(PartNameTagPendingSpawn)) {
      part.addComponent(PartNameTagPendingSpawn);
    }
  }

  private canSpawnNameTag(part: Entity): boolean {
    const obj = part.object3D;
    if (!obj?.visible) return false;
    if (part.hasComponent(PopInDone)) return true;
    if (part.hasComponent(PopIn)) return obj.scale.x >= 0.9;
    return true;
  }

  private partPanelOffset(part: Entity): [number, number, number] {
    return [
      part.getValue(PartNameTag, "offsetX") ?? 0,
      part.getValue(PartNameTag, "offsetY") ?? PANEL_OFFSET_Y,
      part.getValue(PartNameTag, "offsetZ") ?? 0,
    ];
  }

  private partPanelFollower(part: Entity, target: Object3D) {
    return {
      behavior: FollowBehavior.NoRotation,
      target,
      offsetPosition: this.partPanelOffset(part),
      speed: PANEL_FOLLOW_SPEED,
      tolerance: PANEL_FOLLOW_TOLERANCE,
    };
  }

  private spawnNameTag(part: Entity): void {
    const partObj = part.object3D;
    if (!partObj?.visible) return;

    const existing = this.findNameTagForPart(part);
    if (existing) {
      this.teardownNameTag(existing);
    }

    const config = part.getValue(PartNameTag, "nameTagConfig")!;
    const maxWidth = part.getValue(PartNameTag, "maxWidth") ?? NAME_TAG_MAX_WIDTH;

    const panel = this.world
      .createTransformEntity(undefined, { parent: this.world.sceneEntity })
      .addComponent(PanelUI, { config, maxWidth })
      .addComponent(PartNameTagInstance, { part })
      .addComponent(Follower, this.partPanelFollower(part, partObj))
      .addComponent(Billboard);

    if (this.isInfoNameTag(part)) {
      panel.addComponent(PokeInteractable);
    }

    panel.object3D!.scale.setScalar(0.001);
    panel.object3D!.visible = true;
  }

  private spawnDetailPanel(part: Entity): void {
    const partObj = part.object3D;
    if (!partObj?.visible) return;

    const existing = this.findDetailForPart(part);
    if (existing) {
      this.teardownDetailPanel(existing);
    }

    const detailConfig = part.getValue(PartNameTag, "detailConfig");
    const closeButtonId = part.getValue(PartNameTag, "closeButtonId") ?? "";
    if (!detailConfig) return;

    const maxWidth =
      part.getValue(PartNameTag, "detailMaxWidth") ?? DETAIL_PANEL_MAX_WIDTH;

    const panel = this.world
      .createTransformEntity(undefined, { parent: this.world.sceneEntity })
      .addComponent(PanelUI, { config: detailConfig, maxWidth })
      .addComponent(PartInfoDetailInstance, { part, closeButtonId })
      .addComponent(Follower, this.partPanelFollower(part, partObj))
      .addComponent(Billboard)
      .addComponent(PokeInteractable);

    panel.object3D!.scale.setScalar(0.001);
    panel.object3D!.visible = true;
  }

  private isInfoNameTag(part: Entity): boolean {
    return !!(
      part.getValue(PartNameTag, "infoButtonId") ||
      part.getValue(PartNameTag, "detailConfig")
    );
  }

  private wireNameTag(panel: Entity): void {
    if (!panel.active || this.isNameTagWired(panel)) return;

    const part = panel.getValue(PartNameTagInstance, "part");
    if (!part?.active || !part.hasComponent(PartNameTag)) return;

    const buttonId = part.getValue(PartNameTag, "infoButtonId") ?? "";
    if (!buttonId) {
      panel.addComponent(PartNameTagWired);
      return;
    }

    const doc = panel.getValue(PanelDocument, "document") as UIKitDocument | null;
    const button = doc?.getElementById(buttonId);
    if (!button) return;

    button.addEventListener("click", () => {
      void resumeAudioContext();
      this.beginOpenDetail(part, panel);
    });

    panel.addComponent(PartNameTagWired);
  }

  private wireDetailPanel(panel: Entity): void {
    if (!panel.active || this.isDetailWired(panel)) return;
    if (!panel.hasComponent(PartInfoDetailInstance)) return;

    const closeButtonId =
      panel.getValue(PartInfoDetailInstance, "closeButtonId") ?? "";
    if (!closeButtonId) {
      panel.addComponent(PartInfoDetailWired);
      return;
    }

    const doc = panel.getValue(PanelDocument, "document") as UIKitDocument | null;
    const button = doc?.getElementById(closeButtonId);
    button?.addEventListener("click", () => {
      void resumeAudioContext();
      this.beginCloseDetail(panel);
    });

    panel.addComponent(PartInfoDetailWired);
  }

  private beginOpenDetail(part: Entity, nameTagPanel: Entity): void {
    if (
      !nameTagPanel.active ||
      nameTagPanel.hasComponent(PartNameTagSwappingOut) ||
      this.isDetailOpenForPart(part)
    ) {
      return;
    }

    nameTagPanel.removeComponent(PokeInteractable);
    nameTagPanel.addComponent(PartNameTagSwappingOut, {
      part,
      popOutStarted: true,
    });
    nameTagPanel.removeComponent(PopIn2D);
    nameTagPanel.removeComponent(PopOut2D);
    nameTagPanel.addComponent(PopOut2D);
  }

  private beginCloseDetail(detailPanel: Entity): void {
    if (!detailPanel.active || detailPanel.hasComponent(PartInfoDetailSwappingOut)) {
      return;
    }

    const part = detailPanel.getValue(PartInfoDetailInstance, "part");
    detailPanel.removeComponent(PokeInteractable);
    detailPanel.addComponent(PartInfoDetailSwappingOut, {
      part,
      popOutStarted: true,
    });
    detailPanel.removeComponent(PopIn2D);
    detailPanel.removeComponent(PopOut2D);
    detailPanel.addComponent(PopOut2D);
  }

  private restoreNameTag(part: Entity): void {
    if (!part.hasComponent(PartNameTag)) return;

    const nameTag = this.findNameTagForPart(part);
    if (!nameTag?.object3D) {
      this.spawnNameTag(part);
      return;
    }

    nameTag.object3D.visible = true;
    nameTag.removeComponent(PartNameTagSwappingOut);
    nameTag.removeComponent(PopOut2D);
    if (this.isInfoNameTag(part) && !nameTag.hasComponent(PokeInteractable)) {
      nameTag.addComponent(PokeInteractable);
    }
    this.popInPanel(nameTag);
  }

  private hidePartPanels(part: Entity): void {
    const nameTag = this.findNameTagForPart(part);
    if (nameTag && !nameTag.hasComponent(PartNameTagSwappingOut)) {
      nameTag.removeComponent(PopIn2D);
      nameTag.removeComponent(PopOut2D);
      nameTag.addComponent(PopOut2D);
    }

    const detail = this.findDetailForPart(part);
    if (detail && !detail.hasComponent(PartInfoDetailSwappingOut)) {
      detail.removeComponent(PopIn2D);
      detail.removeComponent(PopOut2D);
      detail.addComponent(PopOut2D);
    }
  }

  private showPartPanels(part: Entity): void {
    if (this.isDetailOpenForPart(part)) {
      const detail = this.findDetailForPart(part);
      if (detail?.object3D && !detail.hasComponent(PartInfoDetailSwappingOut)) {
        detail.removeComponent(PopOut2D);
        detail.object3D.visible = true;
        detail.addComponent(PopIn2D);
      }
      return;
    }

    const nameTag = this.findNameTagForPart(part);
    if (nameTag?.object3D && !nameTag.hasComponent(PartNameTagSwappingOut)) {
      nameTag.removeComponent(PopOut2D);
      nameTag.object3D.visible = true;
      nameTag.addComponent(PopIn2D);
    }
  }

  private destroyPanelsForPart(part: Entity): void {
    part.removeComponent(PartNameTagPendingSpawn);

    const nameTag = this.findNameTagForPart(part);
    if (nameTag) this.teardownNameTag(nameTag);

    const detail = this.findDetailForPart(part);
    if (detail) this.teardownDetailPanel(detail);
  }

  private applyNameTagForTask(taskId: string): void {
    const partIds = NAME_TAGS_BY_TASK[taskId];
    if (!partIds?.length) return;

    const activeIds = new Set(partIds);
    for (const part of [...this.queries.taggedParts.entities]) {
      const taggedId = part.getValue(PhonographPart, "id");
      if (!taggedId || !activeIds.has(taggedId)) {
        this.removePartNameTag(part);
      }
    }

    for (const partId of partIds) {
      const part = this.partById(partId);
      if (!part || part.hasComponent(Snapped) || part.hasComponent(PartNameTag)) {
        continue;
      }

      const spec = nameTagSpecForTaskPart(taskId, partId);
      if (!spec) continue;

      part.addComponent(PartNameTag, { ...spec });
    }
  }

  private removeNameTagForTask(taskId: string): void {
    const partIds = NAME_TAGS_BY_TASK[taskId];
    if (!partIds?.length) return;

    for (const partId of partIds) {
      const part = this.partById(partId);
      if (part) this.removePartNameTag(part);
    }
  }

  private removePartNameTag(part: Entity): void {
    if (!part.hasComponent(PartNameTag)) return;
    this.destroyPanelsForPart(part);
    part.removeComponent(PartNameTag);
  }

  private partById(id: string): Entity | undefined {
    for (const part of this.queries.parts.entities) {
      if (part.getValue(PhonographPart, "id") === id) return part;
    }
    return undefined;
  }

  private teardownNameTag(panel: Entity): void {
    panel
      .removeComponent(PartNameTagWired)
      .removeComponent(PartNameTagSwappingOut)
      .removeComponent(PokeInteractable)
      .removeComponent(PopIn2D)
      .removeComponent(PopOut2D)
      .removeComponent(Follower)
      .removeComponent(Billboard)
      .removeComponent(PartNameTagInstance);
    if (panel.object3D) panel.object3D.visible = false;
  }

  private teardownDetailPanel(panel: Entity): void {
    if (!panel.active) return;
    if (panel.object3D) panel.object3D.visible = false;
    panel.dispose();
  }

  private popInPanel(panel: Entity): void {
    if (!panel.active) return;

    const doc = panel.getValue(PanelDocument, "document") as UIKitDocument | null;
    const root = doc?.getElementById("panel-root") as UIKit.Component | undefined;
    if (root) root.scale.setScalar(0.001);

    panel.removeComponent(PopOut2D);
    if (!panel.hasComponent(PopIn2D)) {
      panel.addComponent(PopIn2D);
    }
  }

  private findNameTagForPart(part: Entity): Entity | undefined {
    for (const panel of this.queries.nameTagInstances.entities) {
      if (panel.getValue(PartNameTagInstance, "part") === part) {
        return panel;
      }
    }
    return undefined;
  }

  private findDetailForPart(part: Entity): Entity | undefined {
    for (const panel of this.queries.detailInstances.entities) {
      if (panel.getValue(PartInfoDetailInstance, "part") === part) {
        return panel;
      }
    }
    return undefined;
  }

  private isDetailOpenForPart(part: Entity): boolean {
    const detail = this.findDetailForPart(part);
    return !!detail?.active && !!detail.object3D?.visible;
  }

  private isNameTagSwappingOut(part: Entity): boolean {
    const nameTag = this.findNameTagForPart(part);
    return !!nameTag?.hasComponent(PartNameTagSwappingOut);
  }

  private isNameTagWired(panel: Entity): boolean {
    for (const wired of this.queries.wiredNameTags.entities) {
      if (wired.index === panel.index) return true;
    }
    return false;
  }

  private isDetailWired(panel: Entity): boolean {
    for (const wired of this.queries.wiredDetails.entities) {
      if (wired.index === panel.index) return true;
    }
    return false;
  }
}
