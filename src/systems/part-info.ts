import {
  createComponent,
  createSystem,
  Entity,
  eq,
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
import {
  isPartPopInComplete,
  PopIn2D,
  PopIn2DDone,
  PopInDone,
  PopOut2D,
} from "./animation.js";
import { Billboard } from "./billboard.js";
import {
  beginPanelPopOut,
  hidePanelEntity,
  stripPanelSurface,
} from "./panel-lifecycle.js";
import { resumeAudioContext } from "../audio/context.js";
import { playInfoDetailNarration } from "../audio/narration.js";
import { PhonographPart } from "./phonograph.js";
import { Snapped } from "./snap.js";
import { Task, ActiveTask, CompletedTask } from "./task.js";
import { ACTION_NAME_TAGS_BY_TASK, NAME_TAGS_BY_TASK, TASK_BY_ID, TaskId } from "./task-config.js";
import { DismissTaskInstruction } from "./instruction.js";
import { BrakeRecordingStopArmed } from "./recording.js";
import {
  actionNameTagSpecForTaskPart,
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
  detailNarration: { type: Types.String, default: "" },
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
});
export const PartInfoDetailWired = createComponent("PartInfoDetailWired", {});
/** Detail panel is popping out before the name tag returns. */
export const PartInfoDetailSwappingOut = createComponent("PartInfoDetailSwappingOut", {
  part: { type: Types.Entity, default: null },
  popOutStarted: { type: Types.Boolean, default: false },
});

/** Narration + auto-close sequence is running for this detail panel instance. */
export const PartInfoDetailNarrationActive = createComponent(
  "PartInfoDetailNarrationActive",
  {},
);

/**
 * Marker placed on the active task entity when its info detail panel opens.
 * When the panel finishes closing the task is completed via an ECS query.
 */
export const InfoTutorialCompleteOnDetailClose = createComponent(
  "InfoTutorialCompleteOnDetailClose",
  {},
);

/**
 * Placed on a part entity to defer closing its detail panel until the part
 * is released (Grabbed removed).
 */
export const DetailPendingCloseAfterRelease = createComponent(
  "DetailPendingCloseAfterRelease",
  { panel: { type: Types.Entity, default: null } },
);

/** Task-specific action label shown alongside the standard info name tag. */
export const PartActionNameTag = createComponent("PartActionNameTag", {
  nameTagConfig: { type: Types.String, default: "" },
  maxWidth: { type: Types.Float32, default: NAME_TAG_MAX_WIDTH },
  offsetX: { type: Types.Float32, default: 0 },
  offsetY: { type: Types.Float32, default: PANEL_OFFSET_Y },
  offsetZ: { type: Types.Float32, default: 0 },
});

export const PartActionNameTagInstance = createComponent(
  "PartActionNameTagInstance",
  {
    part: { type: Types.Entity, default: null },
  },
);

export const PartActionNameTagPendingSpawn = createComponent(
  "PartActionNameTagPendingSpawn",
  {},
);

/** TEMP: disable name-tag pop-out while grabbing for layout testing. */
const DISABLE_NAME_TAG_GRAB_POPOUT = true;

export class PartInfoSystem extends createSystem({
  parts: { required: [PhonographPart] },
  activeTask: { required: [Task, ActiveTask], excluded: [CompletedTask] },
  /** Active task whose info-tutorial detail panel should complete it on close. */
  infoTutorialTask: {
    required: [Task, ActiveTask, InfoTutorialCompleteOnDetailClose],
    excluded: [CompletedTask],
  },
  /** Parts whose detail panel should close as soon as the part is released. */
  partDetailPendingRelease: {
    required: [PhonographPart, DetailPendingCloseAfterRelease],
    excluded: [Grabbed],
  },
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
  detailNarrationActive: {
    required: [PartInfoDetailInstance, PartInfoDetailNarrationActive],
  },
  nameTagPopInDone: { required: [PartNameTagInstance, PopIn2DDone] },
  detailPopInDone: {
    required: [PartInfoDetailInstance, PopIn2DDone],
    excluded: [PartInfoDetailSwappingOut, PartInfoDetailNarrationActive],
  },
  actionTaggedParts: { required: [PartActionNameTag] },
  actionTaggedPartsGrabbed: { required: [PartActionNameTag, Grabbed] },
  actionNameTagPendingSpawn: {
    required: [PartActionNameTag, PartActionNameTagPendingSpawn],
  },
  actionNameTagInstances: { required: [PartActionNameTagInstance] },
  actionNameTagDocs: {
    required: [PartActionNameTagInstance, PanelDocument],
  },
  brakeRecordingStopArmed: {
    required: [PhonographPart, BrakeRecordingStopArmed],
    where: [eq(PhonographPart, "id", "brake")],
  },
}) {
  private readonly pendingOpen: Entity[] = [];
  private readonly pendingClose: Entity[] = [];
  private readonly pendingNameTagWiring: Entity[] = [];
  private readonly pendingDetailWiring: Entity[] = [];
  private readonly pendingDetailNarration: Entity[] = [];
  private readonly pendingNameTagPoke: Entity[] = [];
  private cancelDetailAutoClose: (() => void) | null = null;

  init() {
    this.cleanupFuncs.push(
      this.queries.activeTask.subscribe("qualify", (taskEntity) => {
        const taskId = taskEntity.getValue(Task, "id")!;
        this.applyNameTagForTask(taskId);
        this.applyActionNameTagForTask(taskId);
      }),

      this.queries.activeTask.subscribe("disqualify", (taskEntity) => {
        const taskId = taskEntity.getValue(Task, "id")!;
        this.removeNameTagForTask(taskId);
        this.removeActionNameTagForTask(taskId);
        if (taskId === TaskId.RecordingSpeakNarrate) {
          const brake = this.partById("brake");
          if (brake) this.removeRecordingBrakeNameTag(brake);
        }
        this.cancelDetailAutoClose?.();
        this.cancelDetailAutoClose = null;
      }),

      this.queries.brakeRecordingStopArmed.subscribe("qualify", (brake) => {
        if (!this.isRecordingSpeakNarrateActive()) return;
        this.applyRecordingBrakeNameTag(brake);
      }),

      this.queries.brakeRecordingStopArmed.subscribe("disqualify", (brake) => {
        this.removeRecordingBrakeNameTag(brake);
      }),

      this.queries.partDetailPendingRelease.subscribe("qualify", (part) => {
        const panel = part.getValue(DetailPendingCloseAfterRelease, "panel");
        part.removeComponent(DetailPendingCloseAfterRelease);
        if (panel?.active && !panel.hasComponent(PartInfoDetailSwappingOut)) {
          this.beginCloseDetail(panel);
        }
      }),

      this.queries.snappedParts.subscribe("qualify", (part) => {
        this.removePartNameTag(part);
        this.removePartActionNameTag(part);
      }),

      this.queries.taggedParts.subscribe("qualify", (part) => {
        this.trySpawnNameTag(part);
      }),

      this.queries.actionTaggedParts.subscribe("qualify", (part) => {
        this.trySpawnActionNameTag(part);
      }),

      this.queries.actionTaggedParts.subscribe("disqualify", (part) => {
        part.removeComponent(PartActionNameTagPendingSpawn);
        this.destroyActionNameTagPanelsForPart(part);
      }),

      this.queries.actionNameTagPendingSpawn.subscribe("qualify", () => {
        for (const part of this.queries.actionNameTagPendingSpawn.entities) {
          this.trySpawnActionNameTag(part);
        }
      }),

      this.queries.actionTaggedPartsGrabbed.subscribe("qualify", (part) => {
        this.hideActionNameTag(part);
      }),

      this.queries.actionTaggedPartsGrabbed.subscribe("disqualify", (part) => {
        this.showActionNameTag(part);
      }),

      this.queries.actionNameTagDocs.subscribe("qualify", (panel) => {
        this.popInPanel(panel);
      }),

      this.queries.taggedPartsPopInDone.subscribe("qualify", (part) => {
        this.trySpawnNameTag(part);
      }),

      this.queries.taggedParts.subscribe("disqualify", (part) => {
        part.removeComponent(PartNameTagPendingSpawn);
        this.destroyNameTagPanelsForPart(part);
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

        const part = panel.getValue(PartNameTagInstance, "part");
        if (
          part?.active &&
          this.isInfoNameTag(part) &&
          !panel.hasComponent(PartNameTagSwappingOut)
        ) {
          this.pendingNameTagPoke.push(panel);
        }
      }),

      this.queries.detailDocs.subscribe("qualify", (panel) => {
        this.popInPanel(panel);
        this.pendingDetailWiring.push(panel);
        this.pendingDetailNarration.push(panel);
      }),

      this.queries.nameTagPopInDone.subscribe("qualify", (panel) => {
        const part = panel.getValue(PartNameTagInstance, "part");
        if (
          part?.active &&
          this.isInfoNameTag(part) &&
          !panel.hasComponent(PartNameTagSwappingOut)
        ) {
          this.pendingNameTagPoke.push(panel);
        }
      }),

      this.queries.detailPopInDone.subscribe("qualify", (panel) => {
        if (!this.pendingDetailNarration.includes(panel)) {
          this.pendingDetailNarration.push(panel);
        }
      }),
    );

    for (const part of this.queries.taggedParts.entities) {
      this.trySpawnNameTag(part);
    }
    for (const part of this.queries.actionTaggedParts.entities) {
      this.trySpawnActionNameTag(part);
    }
  }

  update() {
    this.processNameTagSwapOut();
    this.processDetailSwapOut();
    this.processPendingWiring();
    this.processPendingDetailNarration();
    this.processPendingNameTagPoke();

    for (const part of this.queries.taggedParts.entities) {
      if (!part.object3D?.visible) {
        this.destroyNameTagPanelsForPart(part);
        continue;
      }

      if (
        this.canSpawnNameTag(part) &&
        !this.findNameTagForPart(part) &&
        !this.hasActiveDetailForPart(part) &&
        !this.isDetailClosingForPart(part) &&
        !this.isNameTagSwappingOut(part)
      ) {
        part.removeComponent(PartNameTagPendingSpawn);
        this.spawnNameTag(part);
      }
    }

    for (const part of this.queries.actionTaggedParts.entities) {
      if (!part.object3D?.visible) {
        this.destroyActionNameTagPanelsForPart(part);
        continue;
      }

      if (
        this.canSpawnActionNameTag(part) &&
        !this.findActionNameTagForPart(part)
      ) {
        part.removeComponent(PartActionNameTagPendingSpawn);
        this.spawnActionNameTag(part);
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
        this.onInfoDetailOpened(part);
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
        if (!this.shouldSkipNameTagRestore(part)) {
          this.restoreNameTag(part);
        }
        this.onInfoDetailClosed(part);
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

  private processPendingDetailNarration(): void {
    for (const panel of this.pendingDetailNarration) {
      if (!panel.active || panel.hasComponent(PartInfoDetailSwappingOut)) continue;
      if (panel.hasComponent(PartInfoDetailNarrationActive)) continue;

      const part = panel.getValue(PartInfoDetailInstance, "part");
      if (part?.active) {
        this.startDetailAutoClose(part, panel);
      }
    }
    this.pendingDetailNarration.length = 0;
  }

  private processPendingNameTagPoke(): void {
    for (const panel of this.pendingNameTagPoke) {
      if (
        !panel.active ||
        panel.hasComponent(PartNameTagSwappingOut) ||
        panel.hasComponent(PokeInteractable)
      ) {
        continue;
      }
      panel.addComponent(PokeInteractable);
    }
    this.pendingNameTagPoke.length = 0;
  }

  private canSpawnNameTag(part: Entity): boolean {
    return isPartPopInComplete(part);
  }

  private canSpawnActionNameTag(part: Entity): boolean {
    return isPartPopInComplete(part);
  }

  private trySpawnNameTag(part: Entity): void {
    if (!part.object3D?.visible) {
      if (!part.hasComponent(PartNameTagPendingSpawn)) {
        part.addComponent(PartNameTagPendingSpawn);
      }
      return;
    }

    const existing = this.findNameTagForPart(part);
    if (existing) {
      if (this.needsNameTagRestore(part, existing)) {
        this.restoreNameTag(part);
      }
      part.removeComponent(PartNameTagPendingSpawn);
      return;
    }

    if (
      this.canSpawnNameTag(part) &&
      !this.findNameTagForPart(part) &&
      !this.hasActiveDetailForPart(part) &&
      !this.isDetailClosingForPart(part) &&
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

  private needsNameTagRestore(part: Entity, nameTag: Entity): boolean {
    if (this.hasActiveDetailForPart(part)) return false;
    if (nameTag.hasComponent(PartNameTagSwappingOut)) return false;
    if (!nameTag.object3D) return false;
    // UI still loading — initial spawn is in progress, not a restore case.
    if (!nameTag.hasComponent(PanelDocument)) return false;
    // 2D pop-in animates the UIKit root; object3D scale stays at 0.001.
    if (nameTag.hasComponent(PopIn2D) || nameTag.hasComponent(PopOut2D)) {
      return false;
    }
    return !nameTag.object3D.visible;
  }

  private trySpawnActionNameTag(part: Entity): void {
    if (!part.object3D?.visible) {
      if (!part.hasComponent(PartActionNameTagPendingSpawn)) {
        part.addComponent(PartActionNameTagPendingSpawn);
      }
      return;
    }

    if (this.canSpawnActionNameTag(part) && !this.findActionNameTagForPart(part)) {
      part.removeComponent(PartActionNameTagPendingSpawn);
      this.spawnActionNameTag(part);
      return;
    }

    if (!part.hasComponent(PartActionNameTagPendingSpawn)) {
      part.addComponent(PartActionNameTagPendingSpawn);
    }
  }

  private partPanelOffset(
    part: Entity,
    offsetX: number,
    offsetY: number,
    offsetZ: number,
  ): [number, number, number] {
    return [offsetX, offsetY, offsetZ];
  }

  private nameTagPanelOffset(part: Entity): [number, number, number] {
    return this.partPanelOffset(
      part,
      part.getValue(PartNameTag, "offsetX") ?? 0,
      part.getValue(PartNameTag, "offsetY") ?? PANEL_OFFSET_Y,
      part.getValue(PartNameTag, "offsetZ") ?? 0,
    );
  }

  private actionNameTagPanelOffset(part: Entity): [number, number, number] {
    return this.partPanelOffset(
      part,
      part.getValue(PartActionNameTag, "offsetX") ?? 0,
      part.getValue(PartActionNameTag, "offsetY") ?? PANEL_OFFSET_Y,
      part.getValue(PartActionNameTag, "offsetZ") ?? 0,
    );
  }

  private partPanelFollower(
    part: Entity,
    target: Object3D,
    offsetPosition: [number, number, number],
  ) {
    return {
      behavior: FollowBehavior.NoRotation,
      target,
      offsetPosition,
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
      .addComponent(
        Follower,
        this.partPanelFollower(part, partObj, this.nameTagPanelOffset(part)),
      )
      .addComponent(Billboard);

    panel.object3D!.scale.setScalar(0.001);
    panel.object3D!.visible = true;
  }

  private spawnActionNameTag(part: Entity): void {
    const partObj = part.object3D;
    if (!partObj?.visible) return;

    const existing = this.findActionNameTagForPart(part);
    if (existing) {
      this.teardownActionNameTag(existing);
    }

    const config = part.getValue(PartActionNameTag, "nameTagConfig")!;
    const maxWidth =
      part.getValue(PartActionNameTag, "maxWidth") ?? NAME_TAG_MAX_WIDTH;

    const panel = this.world
      .createTransformEntity(undefined, { parent: this.world.sceneEntity })
      .addComponent(PanelUI, { config, maxWidth })
      .addComponent(PartActionNameTagInstance, { part })
      .addComponent(
        Follower,
        this.partPanelFollower(part, partObj, this.actionNameTagPanelOffset(part)),
      )
      .addComponent(Billboard);

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
    if (!detailConfig) return;

    const maxWidth =
      part.getValue(PartNameTag, "detailMaxWidth") ?? DETAIL_PANEL_MAX_WIDTH;

    const panel = this.world
      .createTransformEntity(undefined, { parent: this.world.sceneEntity })
      .addComponent(PanelUI, { config: detailConfig, maxWidth })
      .addComponent(PartInfoDetailInstance, { part })
      .addComponent(
        Follower,
        this.partPanelFollower(part, partObj, this.nameTagPanelOffset(part)),
      )
      .addComponent(Billboard);

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

    button.addEventListener("pointerdown", () => {
      void resumeAudioContext();
      this.beginOpenDetail(part, panel);
    });

    panel.addComponent(PartNameTagWired);
  }

  private wireDetailPanel(panel: Entity): void {
    if (!panel.active || this.isDetailWired(panel)) return;
    if (!panel.hasComponent(PartInfoDetailInstance)) return;
    panel.addComponent(PartInfoDetailWired);
  }

  private beginOpenDetail(part: Entity, nameTagPanel: Entity): void {
    if (
      !nameTagPanel.active ||
      nameTagPanel.hasComponent(PartNameTagSwappingOut) ||
      this.hasActiveDetailForPart(part)
    ) {
      return;
    }

    if (this.getActiveTaskId() === TaskId.AssemblyPhonographInfo) {
      this.world.sceneEntity.addComponent(DismissTaskInstruction, {
        taskId: TaskId.AssemblyPhonographInfo,
      });
    }

    nameTagPanel.addComponent(PartNameTagSwappingOut, {
      part,
      popOutStarted: true,
    });
    beginPanelPopOut(nameTagPanel);
  }

  private beginCloseDetail(detailPanel: Entity): void {
    if (!detailPanel.active || detailPanel.hasComponent(PartInfoDetailSwappingOut)) {
      return;
    }

    const part = detailPanel.getValue(PartInfoDetailInstance, "part");
    if (part?.active) {
      this.finalizeInfoTutorialBeforeDetailClose(part);
    }

    detailPanel.addComponent(PartInfoDetailSwappingOut, {
      part,
      popOutStarted: true,
    });
    beginPanelPopOut(detailPanel);
  }

  private restoreNameTag(part: Entity): void {
    if (!part.hasComponent(PartNameTag)) return;

    const nameTag = this.findNameTagForPart(part);
    if (!nameTag?.active || !nameTag.object3D) {
      this.spawnNameTag(part);
      return;
    }

    nameTag.object3D.visible = true;
    nameTag.removeComponent(PartNameTagSwappingOut);
    this.popInPanel(nameTag);
  }

  private hideActionNameTag(part: Entity): void {
    if (DISABLE_NAME_TAG_GRAB_POPOUT) return;
    const actionTag = this.findActionNameTagForPart(part);
    if (actionTag) this.popOutPanelOnGrab(actionTag);
  }

  private showActionNameTag(part: Entity): void {
    if (DISABLE_NAME_TAG_GRAB_POPOUT) return;
    const actionTag = this.findActionNameTagForPart(part);
    if (!actionTag?.object3D) return;

    actionTag.object3D.visible = true;
    if (actionTag.hasComponent(PopOut2D) || !actionTag.hasComponent(PopIn2D)) {
      this.popInPanel(actionTag);
    }
  }

  private hidePartPanels(part: Entity): void {
    if (DISABLE_NAME_TAG_GRAB_POPOUT) return;

    const nameTag = this.findNameTagForPart(part);
    if (nameTag && !nameTag.hasComponent(PartNameTagSwappingOut)) {
      this.popOutPanelOnGrab(nameTag);
    }

    this.hideActionNameTag(part);
  }

  private popOutPanelOnGrab(panel: Entity): void {
    if (!panel.active || !panel.object3D?.visible) return;
    if (panel.hasComponent(PopOut2D)) return;
    beginPanelPopOut(panel);
  }

  private showPartPanels(part: Entity): void {
    if (this.hasActiveDetailForPart(part)) {
      const detail = this.findDetailForPart(part);
      if (
        detail?.object3D &&
        !detail.hasComponent(PartInfoDetailSwappingOut) &&
        (detail.hasComponent(PopOut2D) || !detail.object3D.visible)
      ) {
        detail.object3D.visible = true;
        this.popInPanel(detail);
      }
      return;
    }

    if (DISABLE_NAME_TAG_GRAB_POPOUT) return;

    const nameTag = this.findNameTagForPart(part);
    if (nameTag?.object3D && !nameTag.hasComponent(PartNameTagSwappingOut)) {
      nameTag.object3D.visible = true;
      if (nameTag.hasComponent(PopOut2D) || !nameTag.hasComponent(PopIn2D)) {
        this.popInPanel(nameTag);
      }
    }

    this.showActionNameTag(part);
  }

  private onInfoDetailOpened(part: Entity): void {
    const taskId = this.getActiveTaskId();
    const task = taskId ? TASK_BY_ID[taskId] : undefined;
    if (!task?.completeOnInfoDetailClose) return;

    for (const taskEntity of this.queries.activeTask.entities) {
      if (!taskEntity.hasComponent(InfoTutorialCompleteOnDetailClose)) {
        taskEntity.addComponent(InfoTutorialCompleteOnDetailClose);
      }
    }
  }

  private onInfoDetailClosed(part: Entity): void {
    this.cancelDetailAutoClose?.();
    this.cancelDetailAutoClose = null;

    // Complete any task that was waiting for this detail panel to close.
    for (const task of this.queries.infoTutorialTask.entities) {
      task.addComponent(CompletedTask);
      break;
    }
  }

  /**
   * Hide tutorial chrome when the info panel starts closing; task advances
   * after the pop-out completes via `onInfoDetailClosed`.
   *
   * NOTE: We intentionally do NOT remove `PartNameTag` here. Removing it
   * would fire `taggedParts.disqualify` → `destroyNameTagPanelsForPart` →
   * `teardownDetailPanel`, which strips `PartInfoDetailInstance` from the
   * panel before `PartInfoDetailSwappingOut` is added. That would exclude the
   * panel from `detailSwappingOut`, so `processDetailSwapOut` would never fire
   * `onInfoDetailClosed` and the task machine would stall. `PartNameTag` is
   * cleaned up by `removeNameTagForTask` when the task disqualifies after
   * `onInfoDetailClosed` completes it.
   */
  private finalizeInfoTutorialBeforeDetailClose(part: Entity): void {
    const taskId = this.getActiveTaskId();
    const task = taskId ? TASK_BY_ID[taskId] : undefined;
    if (!task?.completeOnInfoDetailClose) return;

    const nameTag = this.findNameTagForPart(part);
    if (nameTag) this.teardownNameTag(nameTag);
  }

  private getActiveTaskId(): string | undefined {
    for (const task of this.queries.activeTask.entities) {
      return task.getValue(Task, "id") ?? undefined;
    }
    return undefined;
  }

  private startDetailAutoClose(part: Entity, panel: Entity): void {
    if (panel.hasComponent(PartInfoDetailNarrationActive)) return;

    panel.addComponent(PartInfoDetailNarrationActive);

    // Read narration URL if the part still has a name tag; otherwise play silence.
    const narration = part.hasComponent(PartNameTag)
      ? (part.getValue(PartNameTag, "detailNarration") ?? "")
      : "";

    this.cancelDetailAutoClose = playInfoDetailNarration(narration, () => {
      if (!panel.active || panel.hasComponent(PartInfoDetailSwappingOut)) return;
      panel.removeComponent(PartInfoDetailNarrationActive);
      this.cancelDetailAutoClose = null;

      const linkedPart = panel.getValue(PartInfoDetailInstance, "part");
      if (linkedPart?.active) {
        this.scheduleOrCloseDetail(linkedPart, panel);
      } else {
        this.beginCloseDetail(panel);
      }
    });
  }

  /** Close the detail panel now, or defer until the part is released. */
  private scheduleOrCloseDetail(part: Entity, panel: Entity): void {
    if (!panel.active || panel.hasComponent(PartInfoDetailSwappingOut)) return;

    if (part.hasComponent(Grabbed)) {
      if (part.hasComponent(DetailPendingCloseAfterRelease)) {
        part.setValue(DetailPendingCloseAfterRelease, "panel", panel);
      } else {
        part.addComponent(DetailPendingCloseAfterRelease, { panel });
      }
      return;
    }

    this.beginCloseDetail(panel);
  }

  private shouldSkipNameTagRestore(_part: Entity): boolean {
    // Skip restoring the name tag if we're inside an info-tutorial flow that
    // will complete the task — the task transition handles any future UI.
    return [...this.queries.infoTutorialTask.entities].length > 0;
  }

  private destroyPanelsForPart(part: Entity): void {
    this.destroyNameTagPanelsForPart(part);
  }

  private destroyNameTagPanelsForPart(part: Entity): void {
    part.removeComponent(PartNameTagPendingSpawn);
    part.removeComponent(DetailPendingCloseAfterRelease);

    const nameTag = this.findNameTagForPart(part);
    if (nameTag) this.teardownNameTag(nameTag);

    const detail = this.findDetailForPart(part);
    // Never stomp a detail panel that is already in the close sequence — its
    // animation needs to finish so processDetailSwapOut can fire
    // onInfoDetailClosed and advance the task machine.
    if (detail && !detail.hasComponent(PartInfoDetailSwappingOut)) {
      this.teardownDetailPanel(detail);
    }
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

      part.addComponent(PartNameTag, spec);
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
    this.destroyNameTagPanelsForPart(part);
    part.removeComponent(PartNameTag);
  }

  private isRecordingSpeakNarrateActive(): boolean {
    for (const task of this.queries.activeTask.entities) {
      if (task.getValue(Task, "id") === TaskId.RecordingSpeakNarrate) return true;
    }
    return false;
  }

  private applyRecordingBrakeNameTag(brake: Entity): void {
    if (brake.hasComponent(Snapped) || brake.hasComponent(PartNameTag)) return;

    const spec = nameTagSpecForTaskPart(TaskId.RecordingSpeakNarrate, "brake");
    if (!spec) return;

    this.defer(() => {
      if (!brake.active || brake.hasComponent(PartNameTag)) return;
      brake.addComponent(PartNameTag, spec);
    });
  }

  private removeRecordingBrakeNameTag(brake: Entity): void {
    if (!brake.hasComponent(PartNameTag)) return;
    this.removePartNameTag(brake);
  }

  /** Avoid ECS mutations during query qualify/disqualify callbacks. */
  private defer(fn: () => void): void {
    queueMicrotask(fn);
  }

  private applyActionNameTagForTask(taskId: string): void {
    const partIds = ACTION_NAME_TAGS_BY_TASK[taskId];
    const activeIds = new Set(partIds ?? []);
    for (const part of [...this.queries.actionTaggedParts.entities]) {
      const taggedId = part.getValue(PhonographPart, "id");
      if (!taggedId || !activeIds.has(taggedId)) {
        this.removePartActionNameTag(part);
      }
    }

    if (!partIds?.length) return;

    for (const partId of partIds) {
      const part = this.partById(partId);
      if (!part || part.hasComponent(Snapped) || part.hasComponent(PartActionNameTag)) {
        continue;
      }

      const spec = actionNameTagSpecForTaskPart(taskId, partId);
      if (!spec) continue;

      part.addComponent(PartActionNameTag, spec);
    }
  }

  private removeActionNameTagForTask(taskId: string): void {
    const partIds = ACTION_NAME_TAGS_BY_TASK[taskId];
    if (!partIds?.length) return;

    for (const partId of partIds) {
      const part = this.partById(partId);
      if (part) this.removePartActionNameTag(part);
    }
  }

  private removePartActionNameTag(part: Entity): void {
    if (!part.hasComponent(PartActionNameTag)) return;
    this.destroyActionNameTagPanelsForPart(part);
    part.removeComponent(PartActionNameTag);
  }

  private destroyActionNameTagPanelsForPart(part: Entity): void {
    part.removeComponent(PartActionNameTagPendingSpawn);
    const actionTag = this.findActionNameTagForPart(part);
    if (actionTag) this.teardownActionNameTag(actionTag);
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
      .removeComponent(PartNameTagInstance);
    hidePanelEntity(panel);
  }

  private teardownActionNameTag(panel: Entity): void {
    panel.removeComponent(PartActionNameTagInstance);
    hidePanelEntity(panel);
  }

  private teardownDetailPanel(panel: Entity): void {
    if (!panel.active) return;
    this.cancelDetailAutoClose?.();
    this.cancelDetailAutoClose = null;
    panel.removeComponent(PartInfoDetailNarrationActive);
    panel
      .removeComponent(PartInfoDetailWired)
      .removeComponent(PartInfoDetailSwappingOut)
      .removeComponent(PartInfoDetailInstance);
    hidePanelEntity(panel);
  }

  private popInPanel(panel: Entity): void {
    if (!panel.active) return;

    const doc = panel.getValue(PanelDocument, "document") as UIKitDocument | null;
    const root = doc?.getElementById("panel-root") as UIKit.Component | undefined;
    if (root) root.scale.setScalar(0.001);

    stripPanelSurface(panel);
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

  private findActionNameTagForPart(part: Entity): Entity | undefined {
    for (const panel of this.queries.actionNameTagInstances.entities) {
      if (panel.getValue(PartActionNameTagInstance, "part") === part) {
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
    return this.hasActiveDetailForPart(part) && !!detail?.object3D?.visible;
  }

  private hasActiveDetailForPart(part: Entity): boolean {
    const detail = this.findDetailForPart(part);
    return (
      !!detail?.active &&
      !detail.hasComponent(PartInfoDetailSwappingOut)
    );
  }

  /** True while the detail panel exists but is actively popping out. */
  private isDetailClosingForPart(part: Entity): boolean {
    const detail = this.findDetailForPart(part);
    return !!detail?.active && detail.hasComponent(PartInfoDetailSwappingOut);
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
