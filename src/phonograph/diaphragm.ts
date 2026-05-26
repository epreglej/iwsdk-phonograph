import {
  createSystem,
  eq,
  Entity,
  createComponent,
  Grabbed,
  OneHandGrabbable,
} from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../task.js";
import { PopIn, PopOut, SnapAnimation } from "../animations/animation.js";
import { Highlight } from "../utils/highlight.js";
import { Snappable, SnapGhost, Snapped } from "../utils/snap.js";
import {
  Unmounting,
  UnmountPopping,
  UNMOUNT_HIGHLIGHT_COLOR,
} from "../utils/unmounting.js";
import { forceReleaseGrab } from "../utils/grab-release.js";
import { playPop } from "../audio/sfx.js";
import { PlacardTarget } from "../utils/object-placard.js";

export const RecordingDiaphragm = createComponent("RecordingDiaphragm", {});
export const PlaybackDiaphragm = createComponent("PlaybackDiaphragm", {});

export class DiaphragmSystem extends createSystem({
  activeRecordingDiaphragmMountTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "recording_diaphragm_mount")],
  },
  activeRecordingDiaphragmUnmountTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "recording_diaphragm_unmount")],
  },
  activePlaybackDiaphragmMountTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "playback_diaphragm_mount")],
  },
  recordingDiaphragm: { required: [RecordingDiaphragm] },
  snappedRecordingDiaphragm: { required: [RecordingDiaphragm, Snapped] },
  recordingDiaphragmGrabbedWhileUnmounting: {
    required: [RecordingDiaphragm, Unmounting, Grabbed],
    excluded: [PopOut, UnmountPopping],
  },
  recordingDiaphragmUnmountPopOut: {
    required: [RecordingDiaphragm, Unmounting, PopOut],
  },
  playbackDiaphragm: { required: [PlaybackDiaphragm] },
  snappedPlaybackDiaphragm: { required: [PlaybackDiaphragm, Snapped] },
}) {
  init() {
    const [recordingDiaphragm] = this.queries.recordingDiaphragm.entities;
    const [playbackDiaphragm] = this.queries.playbackDiaphragm.entities;

    this.cleanupFuncs.push(
      this.queries.activeRecordingDiaphragmMountTask.subscribe(
        "qualify",
        () => {
          recordingDiaphragm.object3D!.visible = true;
          recordingDiaphragm.addComponent(PopIn);
          recordingDiaphragm
            .addComponent(OneHandGrabbable)
            .addComponent(Snappable, { snapPointId: "diaphragm_snap_point" })
            .addComponent(SnapGhost)
            .addComponent(Highlight);
          recordingDiaphragm.addComponent(PlacardTarget, {
            panelConfig: "./ui/recording-diaphragm-mount-instruction.json",
            offsetX: 0,
            offsetY: 0.2,
            offsetZ: 0,
            dismissOnGrab: false,
            dismissOnSnap: true,
            autoDismissMs: 0,
          });
        },
      ),

      this.queries.snappedRecordingDiaphragm.subscribe("qualify", (entity) => {
        entity.removeComponent(Highlight).removeComponent(SnapGhost);
        for (const task of this.queries.activeRecordingDiaphragmMountTask
          .entities) {
          task.addComponent(CompletedTask);
        }
      }),

      this.queries.activeRecordingDiaphragmUnmountTask.subscribe(
        "qualify",
        () => {
          recordingDiaphragm.object3D!.visible = true;
          recordingDiaphragm
            .addComponent(Unmounting)
            .removeComponent(SnapGhost)
            .removeComponent(Snappable)
            .addComponent(OneHandGrabbable)
            .addComponent(Highlight, { color: UNMOUNT_HIGHLIGHT_COLOR });
          recordingDiaphragm.addComponent(PlacardTarget, {
            panelConfig: "./ui/recording-diaphragm-unmount-instruction.json",
            offsetX: 0,
            offsetY: 0.2,
            offsetZ: 0,
            dismissOnGrab: true,
            dismissOnSnap: false,
            autoDismissMs: 0,
          });
        },
      ),

      this.queries.activeRecordingDiaphragmUnmountTask.subscribe(
        "disqualify",
        () => {
          recordingDiaphragm.removeComponent(Unmounting);
        },
      ),

      this.queries.recordingDiaphragmGrabbedWhileUnmounting.subscribe(
        "qualify",
        (entity) => {
          this.finishUnmount(entity);
        },
      ),

      this.queries.recordingDiaphragmUnmountPopOut.subscribe(
        "disqualify",
        (entity) => {
          this.completeUnmount(entity);
        },
      ),

      this.queries.activePlaybackDiaphragmMountTask.subscribe("qualify", () => {
        playbackDiaphragm.object3D!.visible = true;
        playbackDiaphragm
          .addComponent(PopIn)
          .addComponent(OneHandGrabbable)
          .addComponent(Snappable, { snapPointId: "diaphragm_snap_point" })
          .addComponent(SnapGhost)
          .addComponent(Highlight);
        playbackDiaphragm.addComponent(PlacardTarget, {
          panelConfig: "./ui/playback-diaphragm-mount-instruction.json",
          offsetX: 0,
          offsetY: 0.2,
          offsetZ: 0,
          dismissOnGrab: false,
          dismissOnSnap: true,
          autoDismissMs: 0,
        });
      }),

      this.queries.snappedPlaybackDiaphragm.subscribe("qualify", (entity) => {
        entity.removeComponent(Highlight).removeComponent(SnapGhost);
        for (const task of this.queries.activePlaybackDiaphragmMountTask
          .entities) {
          task.addComponent(CompletedTask);
        }
      }),
    );
  }

  private finishUnmount(recordingDiaphragm: Entity) {
    if (!recordingDiaphragm.hasComponent(Unmounting)) return;
    if (recordingDiaphragm.hasComponent(UnmountPopping)) return;

    recordingDiaphragm.addComponent(UnmountPopping);
    forceReleaseGrab(recordingDiaphragm);

    recordingDiaphragm
      .removeComponent(Highlight)
      .removeComponent(Snappable)
      .removeComponent(SnapGhost)
      .removeComponent(Snapped)
      .removeComponent(SnapAnimation)
      .addComponent(PopOut);

    playPop();
  }

  private completeUnmount(recordingDiaphragm: Entity) {
    forceReleaseGrab(recordingDiaphragm);
    recordingDiaphragm
      .removeComponent(Unmounting)
      .removeComponent(UnmountPopping);

    const obj = recordingDiaphragm.object3D;
    if (obj) {
      obj.scale.setScalar(0.001);
      obj.visible = false;
    }

    for (const task of this.queries.activeRecordingDiaphragmUnmountTask
      .entities) {
      task.addComponent(CompletedTask);
    }
  }
}
