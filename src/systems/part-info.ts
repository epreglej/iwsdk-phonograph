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
import {
  isPartPopInComplete,
  MICRO_INSTRUCTION_SPAWN_AFTER_NAME_TAG_MS,
  PANEL_SPAWN_AFTER_PART_POP_IN_MS,
  PANEL_SPAWN_DELAY_PENDING,
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
import { ACTION_NAME_TAGS_BY_TASK, NAME_TAGS_BY_TASK } from "./task-config.js";
import {
  actionNameTagSpecForTaskPart,
  DETAIL_PANEL_MAX_WIDTH,
  MICRO_INSTRUCTION_MAX_WIDTH,
  MICRO_INSTRUCTION_OFFSET_Y,
  MICRO_INSTRUCTIONS_BY_TASK,
  NAME_TAG_MAX_WIDTH,
  PANEL_OFFSET_Y,
  microInstructionBindingForTaskPart,
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
  panelSpawnDelayRemainingMs: { type: Types.Float32, default: -1 },
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

export const PartMicroInstruction = createComponent("PartMicroInstruction", {
  taskId: { type: Types.String, default: "" },
  stepIndex: { type: Types.Int8, default: 0 },
  panelConfig: { type: Types.String, default: "" },
  maxWidth: { type: Types.Float32, default: MICRO_INSTRUCTION_MAX_WIDTH },
  offsetX: { type: Types.Float32, default: 0 },
  offsetY: { type: Types.Float32, default: MICRO_INSTRUCTION_OFFSET_Y },
  offsetZ: { type: Types.Float32, default: 0 },
  spawnDelayRemainingMs: { type: Types.Float32, default: 0 },
});

export const PartMicroInstructionInstance = createComponent(
  "PartMicroInstructionInstance",
  {
    part: { type: Types.Entity, default: null },
  },
);
export const PartMicroInstructionPendingSpawn = createComponent(
  "PartMicroInstructionPendingSpawn",
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
  panelSpawnDelayRemainingMs: { type: Types.Float32, default: -1 },
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
  microInstructionParts: { required: [PartMicroInstruction] },
  microInstructionPendingSpawn: {
    required: [PartMicroInstruction, PartMicroInstructionPendingSpawn],
  },
  microInstructionInstances: { required: [PartMicroInstructionInstance] },
  microInstructionDocs: {
    required: [PartMicroInstructionInstance, PanelDocument],
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
        this.applyMicroInstructionForTask(taskId);
      }),

      this.queries.activeTask.subscribe("disqualify", (taskEntity) => {
        const taskId = taskEntity.getValue(Task, "id")!;
        this.removeNameTagForTask(taskId);
        this.removeActionNameTagForTask(taskId);
        this.removeMicroInstructionForTask(taskId);
        this.cancelDetailAutoClose?.();
        this.cancelDetailAutoClose = null;
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
        this.removePartMicroInstruction(part);
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
        const remaining =
          part.getValue(PartNameTag, "panelSpawnDelayRemainingMs") ??
          PANEL_SPAWN_DELAY_PENDING;
        if (remaining === PANEL_SPAWN_DELAY_PENDING) {
          part.setValue(
            PartNameTag,
            "panelSpawnDelayRemainingMs",
            PANEL_SPAWN_AFTER_PART_POP_IN_MS,
          );
        }
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
      }),

      this.queries.detailDocs.subscribe("qualify", (panel) => {
        this.popInPanel(panel);
        this.pendingDetailWiring.push(panel);
      }),

      this.queries.nameTagPopInDone.subscribe("qualify", (panel) => {
        const part = panel.getValue(PartNameTagInstance, "part");
        if (part?.active) {
          this.startMicroInstructionSpawnDelay(part);
          if (
            this.isInfoNameTag(part) &&
            !panel.hasComponent(PartNameTagSwappingOut)
          ) {
            this.pendingNameTagPoke.push(panel);
          }
        }
      }),

      this.queries.detailPopInDone.subscribe("qualify", (panel) => {
        this.pendingDetailNarration.push(panel);
      }),

      this.queries.microInstructionParts.subscribe("qualify", (part) => {
        const nameTag = this.findNameTagForPart(part);
        if (nameTag?.hasComponent(PopIn2DDone)) {
          this.startMicroInstructionSpawnDelay(part);
        }
        this.trySpawnMicroInstruction(part);
      }),

      this.queries.microInstructionParts.subscribe("disqualify", (part) => {
        part.removeComponent(PartMicroInstructionPendingSpawn);
        this.destroyMicroInstructionForPart(part);
      }),

      this.queries.microInstructionPendingSpawn.subscribe("qualify", () => {
        for (const part of this.queries.microInstructionPendingSpawn.entities) {
          this.trySpawnMicroInstruction(part);
        }
      }),

      this.queries.microInstructionDocs.subscribe("qualify", (panel) => {
        this.popInPanel(panel);
      }),
    );

    for (const part of this.queries.taggedParts.entities) {
      this.trySpawnNameTag(part);
    }
    for (const part of this.queries.actionTaggedParts.entities) {
      this.trySpawnActionNameTag(part);
    }
    for (const part of this.queries.microInstructionParts.entities) {
      this.trySpawnMicroInstruction(part);
    }
  }

  update(delta: number) {
    const dtMs = delta * 1000;
    for (const part of this.queries.taggedParts.entities) {
      this.tickNameTagSpawnDelay(part, dtMs);
    }
    for (const part of this.queries.actionTaggedParts.entities) {
      this.tickActionNameTagSpawnDelay(part, dtMs);
    }

    for (const part of this.queries.microInstructionParts.entities) {
      const remaining =
        part.getValue(PartMicroInstruction, "spawnDelayRemainingMs") ?? 0;
      if (remaining <= 0) continue;
      part.setValue(
        PartMicroInstruction,
        "spawnDelayRemainingMs",
        Math.max(0, remaining - dtMs),
      );
    }

    this.processNameTagSwapOut();
    this.processDetailSwapOut();
    this.processPendingWiring();
    this.processPendingDetailNarration();
    this.processPendingNameTagPoke();

    for (const part of this.queries.taggedParts.entities) {
      if (!part.object3D?.visible) {
        this.destroyNameTagPanelsForPart(part);
        if (part.hasComponent(PartMicroInstruction)) {
          this.destroyMicroInstructionForPart(part);
        }
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

    for (const part of this.queries.microInstructionParts.entities) {
      if (!part.object3D?.visible) {
        this.destroyMicroInstructionForPart(part);
        continue;
      }

      if (
        this.canSpawnNameTag(part) &&
        !this.findMicroInstructionForPart(part) &&
        !this.isMicroInstructionHidden(part) &&
        this.isMicroInstructionSpawnReady(part)
      ) {
        part.removeComponent(PartMicroInstructionPendingSpawn);
        this.spawnMicroInstruction(part);
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

  private tickNameTagSpawnDelay(part: Entity, dtMs: number): void {
    const remaining =
      part.getValue(PartNameTag, "panelSpawnDelayRemainingMs") ??
      PANEL_SPAWN_DELAY_PENDING;

    if (remaining === PANEL_SPAWN_DELAY_PENDING) {
      if (isPartPopInComplete(part)) {
        part.setValue(
          PartNameTag,
          "panelSpawnDelayRemainingMs",
          PANEL_SPAWN_AFTER_PART_POP_IN_MS,
        );
      }
      return;
    }

    if (remaining > 0) {
      part.setValue(
        PartNameTag,
        "panelSpawnDelayRemainingMs",
        Math.max(0, remaining - dtMs),
      );
    }
  }

  private startMicroInstructionSpawnDelay(part: Entity): void {
    if (!part.hasComponent(PartMicroInstruction)) return;

    const remaining =
      part.getValue(PartMicroInstruction, "spawnDelayRemainingMs") ??
      PANEL_SPAWN_DELAY_PENDING;
    if (remaining >= 0) return;

    part.setValue(
      PartMicroInstruction,
      "spawnDelayRemainingMs",
      MICRO_INSTRUCTION_SPAWN_AFTER_NAME_TAG_MS,
    );
    this.trySpawnMicroInstruction(part);
  }

  private trySpawnNameTag(part: Entity): void {
    if (!part.object3D?.visible) {
      if (!part.hasComponent(PartNameTagPendingSpawn)) {
        part.addComponent(PartNameTagPendingSpawn);
      }
      return;
    }

    const existing = this.findNameTagForPart(part);
    if (existing && this.needsNameTagRestore(part, existing)) {
      this.restoreNameTag(part);
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
    return (
      !nameTag.object3D.visible ||
      nameTag.hasComponent(PopOut2D) ||
      nameTag.object3D.scale.x < 0.05
    );
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

  private canSpawnNameTag(part: Entity): boolean {
    if (!isPartPopInComplete(part)) return false;

    const remaining =
      part.getValue(PartNameTag, "panelSpawnDelayRemainingMs") ??
      PANEL_SPAWN_DELAY_PENDING;
    if (remaining < 0) return false;
    return remaining <= 0;
  }

  private canSpawnActionNameTag(part: Entity): boolean {
    if (!isPartPopInComplete(part)) return false;

    const remaining =
      part.getValue(PartActionNameTag, "panelSpawnDelayRemainingMs") ??
      PANEL_SPAWN_DELAY_PENDING;
    if (remaining < 0) return false;
    return remaining <= 0;
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

  private microInstructionPanelOffset(part: Entity): [number, number, number] {
    return this.partPanelOffset(
      part,
      part.getValue(PartMicroInstruction, "offsetX") ?? 0,
      part.getValue(PartMicroInstruction, "offsetY") ?? MICRO_INSTRUCTION_OFFSET_Y,
      part.getValue(PartMicroInstruction, "offsetZ") ?? 0,
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

  private spawnMicroInstruction(part: Entity): void {
    const partObj = part.object3D;
    if (!partObj?.visible) return;

    const existing = this.findMicroInstructionForPart(part);
    if (existing) {
      this.teardownMicroInstruction(existing);
    }

    const config = part.getValue(PartMicroInstruction, "panelConfig")!;
    const maxWidth =
      part.getValue(PartMicroInstruction, "maxWidth") ??
      MICRO_INSTRUCTION_MAX_WIDTH;

    const panel = this.world
      .createTransformEntity(undefined, { parent: this.world.sceneEntity })
      .addComponent(PanelUI, { config, maxWidth })
      .addComponent(PartMicroInstructionInstance, { part })
      .addComponent(
        Follower,
        this.partPanelFollower(
          part,
          partObj,
          this.microInstructionPanelOffset(part),
        ),
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

    button.addEventListener("click", () => {
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
    const actionTag = this.findActionNameTagForPart(part);
    if (actionTag) this.popOutPanelOnGrab(actionTag);
  }

  private showActionNameTag(part: Entity): void {
    const actionTag = this.findActionNameTagForPart(part);
    if (!actionTag?.object3D) return;

    actionTag.object3D.visible = true;
    if (actionTag.hasComponent(PopOut2D) || !actionTag.hasComponent(PopIn2D)) {
      this.popInPanel(actionTag);
    }
  }

  private hidePartPanels(part: Entity): void {
    const nameTag = this.findNameTagForPart(part);
    if (nameTag && !nameTag.hasComponent(PartNameTagSwappingOut)) {
      this.popOutPanelOnGrab(nameTag);
    }

    const microInstruction = this.findMicroInstructionForPart(part);
    if (microInstruction) {
      this.popOutPanelOnGrab(microInstruction);
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

    const nameTag = this.findNameTagForPart(part);
    if (nameTag?.object3D && !nameTag.hasComponent(PartNameTagSwappingOut)) {
      nameTag.object3D.visible = true;
      if (nameTag.hasComponent(PopOut2D) || !nameTag.hasComponent(PopIn2D)) {
        this.popInPanel(nameTag);
      }
    }

    const microInstruction = this.findMicroInstructionForPart(part);
    if (
      microInstruction?.object3D &&
      !this.isMicroInstructionHidden(part)
    ) {
      microInstruction.object3D.visible = true;
      if (
        microInstruction.hasComponent(PopOut2D) ||
        !microInstruction.hasComponent(PopIn2D)
      ) {
        this.popInPanel(microInstruction);
      }
    }

    this.showActionNameTag(part);
  }

  private isMicroInstructionHidden(part: Entity): boolean {
    return this.hasActiveDetailForPart(part);
  }

  private onInfoDetailOpened(part: Entity): void {
    const binding = this.infoTutorialBindingForPart(part);
    if (binding?.flow !== "info-tutorial") return;

    if (binding.completeTaskOnInfoClose) {
      // Mark the active task entity so it knows to complete when the panel closes.
      for (const task of this.queries.activeTask.entities) {
        if (!task.hasComponent(InfoTutorialCompleteOnDetailClose)) {
          task.addComponent(InfoTutorialCompleteOnDetailClose);
        }
      }
    }
    this.destroyMicroInstructionForPart(part);
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
    const binding = this.infoTutorialBindingForPart(part);
    if (!(binding?.flow === "info-tutorial" && binding.completeTaskOnInfoClose)) {
      return;
    }

    this.removePartMicroInstruction(part);

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

  /** Info-tutorial binding from the active task (micro instruction may already be torn down). */
  private infoTutorialBindingForPart(part: Entity) {
    const taskId = this.getActiveTaskId();
    const partId = part.getValue(PhonographPart, "id") ?? "";
    if (!taskId || !partId) return undefined;
    return microInstructionBindingForTaskPart(taskId, partId);
  }

  private destroyPanelsForPart(part: Entity): void {
    this.destroyNameTagPanelsForPart(part);
    this.destroyMicroInstructionForPart(part);
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

  private destroyMicroInstructionForPart(part: Entity): void {
    part.removeComponent(PartMicroInstructionPendingSpawn);

    const panel = this.findMicroInstructionForPart(part);
    if (panel) this.teardownMicroInstruction(panel);
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

      part.addComponent(PartNameTag, {
        ...spec,
        panelSpawnDelayRemainingMs: isPartPopInComplete(part)
          ? PANEL_SPAWN_AFTER_PART_POP_IN_MS
          : PANEL_SPAWN_DELAY_PENDING,
      });
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

      part.addComponent(PartActionNameTag, {
        ...spec,
        panelSpawnDelayRemainingMs: isPartPopInComplete(part)
          ? PANEL_SPAWN_AFTER_PART_POP_IN_MS
          : PANEL_SPAWN_DELAY_PENDING,
      });
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

  private tickActionNameTagSpawnDelay(part: Entity, dtMs: number): void {
    const remaining =
      part.getValue(PartActionNameTag, "panelSpawnDelayRemainingMs") ??
      PANEL_SPAWN_DELAY_PENDING;

    if (remaining === PANEL_SPAWN_DELAY_PENDING) {
      if (isPartPopInComplete(part)) {
        part.setValue(
          PartActionNameTag,
          "panelSpawnDelayRemainingMs",
          PANEL_SPAWN_AFTER_PART_POP_IN_MS,
        );
      }
      return;
    }

    if (remaining > 0) {
      part.setValue(
        PartActionNameTag,
        "panelSpawnDelayRemainingMs",
        Math.max(0, remaining - dtMs),
      );
    }
  }

  private applyMicroInstructionForTask(taskId: string): void {
    const partIds = MICRO_INSTRUCTIONS_BY_TASK[taskId];
    const activeIds = new Set(partIds ?? []);
    for (const part of [...this.queries.microInstructionParts.entities]) {
      const partId = part.getValue(PhonographPart, "id");
      if (!partId || !activeIds.has(partId)) {
        this.removePartMicroInstruction(part);
      }
    }

    if (!partIds?.length) return;

    for (const partId of partIds) {
      const part = this.partById(partId);
      if (
        !part ||
        part.hasComponent(Snapped) ||
        part.hasComponent(PartMicroInstruction)
      ) {
        continue;
      }

      const binding = microInstructionBindingForTaskPart(taskId, partId);
      if (!binding?.steps.length) continue;

      const firstStep = binding.steps[0];
      part.addComponent(PartMicroInstruction, {
        taskId,
        stepIndex: 0,
        panelConfig: firstStep.panelConfig,
        maxWidth: firstStep.maxWidth,
        offsetX: firstStep.offsetX,
        offsetY: firstStep.offsetY,
        offsetZ: firstStep.offsetZ,
        spawnDelayRemainingMs: PANEL_SPAWN_DELAY_PENDING,
      });
    }
  }

  private removeMicroInstructionForTask(taskId: string): void {
    const partIds = MICRO_INSTRUCTIONS_BY_TASK[taskId];
    if (!partIds?.length) return;

    for (const partId of partIds) {
      const part = this.partById(partId);
      if (part) this.removePartMicroInstruction(part);
    }
  }

  private removePartMicroInstruction(part: Entity): void {
    if (!part.hasComponent(PartMicroInstruction)) return;
    this.cancelDetailAutoClose?.();
    this.cancelDetailAutoClose = null;
    this.destroyMicroInstructionForPart(part);
    part.removeComponent(PartMicroInstruction);
  }

  private trySpawnMicroInstruction(part: Entity): void {
    if (!part.object3D?.visible) {
      if (!part.hasComponent(PartMicroInstructionPendingSpawn)) {
        part.addComponent(PartMicroInstructionPendingSpawn);
      }
      return;
    }

    if (
      this.canSpawnNameTag(part) &&
      !this.findMicroInstructionForPart(part) &&
      !this.isMicroInstructionHidden(part) &&
      this.isMicroInstructionSpawnReady(part)
    ) {
      part.removeComponent(PartMicroInstructionPendingSpawn);
      this.spawnMicroInstruction(part);
      return;
    }

    if (!part.hasComponent(PartMicroInstructionPendingSpawn)) {
      part.addComponent(PartMicroInstructionPendingSpawn);
    }
  }

  private isMicroInstructionSpawnReady(part: Entity): boolean {
    const remaining =
      part.getValue(PartMicroInstruction, "spawnDelayRemainingMs") ??
      PANEL_SPAWN_DELAY_PENDING;
    return remaining >= 0 && remaining <= 0;
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

  private teardownMicroInstruction(panel: Entity): void {
    panel.removeComponent(PartMicroInstructionInstance);
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

  private findMicroInstructionForPart(part: Entity): Entity | undefined {
    for (const panel of this.queries.microInstructionInstances.entities) {
      if (panel.getValue(PartMicroInstructionInstance, "part") === part) {
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
