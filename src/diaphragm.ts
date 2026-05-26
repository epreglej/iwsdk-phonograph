// import {
//   createSystem,
//   eq,
//   Entity,
//   createComponent,
//   OneHandGrabbable,
// } from "@iwsdk/core";
// import { Task, ActiveTask, CompletedTask } from "../task.js";
// import { PopIn, PopOut } from "../animations/animation.js";
// import { Highlight } from "../utils/highlight.js";
// import {
//   InSnapZone,
//   Snappable,
//   SnapGhost,
//   Snapped,
//   TrackSnapZone,
// } from "../utils/snap.js";
// import { ForceRelease, Grabbed } from "../utils/grab.js";
// import { Unmounting } from "../utils/unmounting.js";

// export const RecordingDiaphragm = createComponent("RecordingDiaphragm", {});
// export const PlaybackDiaphragm = createComponent("PlaybackDiaphragm", {});

// export class DiaphragmSystem extends createSystem({
//   activeRecordingDiaphragmDescriptionTask: {
//     required: [Task, ActiveTask],
//     excluded: [CompletedTask],
//     where: [eq(Task, "id", "recording_diaphragm_description")],
//   },
//   activeRecordingDiaphragmMountTask: {
//     required: [Task, ActiveTask],
//     excluded: [CompletedTask],
//     where: [eq(Task, "id", "recording_diaphragm_mount")],
//   },
//   activeRecordingDiaphragmUnmountTask: {
//     required: [Task, ActiveTask],
//     excluded: [CompletedTask],
//     where: [eq(Task, "id", "recording_diaphragm_unmount")],
//   },
//   activePlaybackDiaphragmMountTask: {
//     required: [Task, ActiveTask],
//     excluded: [CompletedTask],
//     where: [eq(Task, "id", "playback_diaphragm_mount")],
//   },
//   recordingDiaphragm: { required: [RecordingDiaphragm] },
//   snappedRecordingDiaphragm: { required: [RecordingDiaphragm, Snapped] },
//   recordingDiaphragmLeftSnapZoneWhileUnmounting: {
//     required: [RecordingDiaphragm, Unmounting, Snappable, Grabbed],
//     excluded: [Snapped, InSnapZone],
//   },
//   recordingDiaphragmReleasedWhileUnmounting: {
//     required: [RecordingDiaphragm, Unmounting],
//     excluded: [Snapped, Grabbed],
//   },
//   recordingDiaphragmUnmountPopOut: {
//     required: [RecordingDiaphragm, Unmounting, PopOut],
//   },
//   playbackDiaphragm: { required: [PlaybackDiaphragm] },
//   snappedPlaybackDiaphragm: { required: [PlaybackDiaphragm, Snapped] },
// }) {
//   init() {
//     const [recordingDiaphragm] = this.queries.recordingDiaphragm.entities;
//     const [playbackDiaphragm] = this.queries.playbackDiaphragm.entities;

//     this.cleanupFuncs.push(
//       this.queries.activeRecordingDiaphragmDescriptionTask.subscribe(
//         "qualify",
//         () => {
//           recordingDiaphragm.addComponent(PopIn);
//           recordingDiaphragm.object3D!.visible = true;
//         },
//       ),

//       this.queries.activeRecordingDiaphragmMountTask.subscribe("qualify", () => {
//         recordingDiaphragm
//           .addComponent(OneHandGrabbable)
//           .addComponent(Snappable, { snapPointId: "diaphragm_snap_point" })
//           .addComponent(SnapGhost)
//           .addComponent(Highlight);
//       }),

//       this.queries.snappedRecordingDiaphragm.subscribe("qualify", (entity) => {
//         entity.removeComponent(Highlight).removeComponent(SnapGhost);
//         for (const task of this.queries.activeRecordingDiaphragmMountTask
//           .entities) {
//           task.addComponent(CompletedTask);
//         }
//       }),

//       this.queries.activeRecordingDiaphragmUnmountTask.subscribe("qualify", () => {
//         recordingDiaphragm.object3D!.visible = true;
//         recordingDiaphragm
//           .addComponent(Unmounting)
//           .addComponent(TrackSnapZone)
//           .addComponent(OneHandGrabbable)
//           .addComponent(Highlight);
//       }),

//       this.queries.activeRecordingDiaphragmUnmountTask.subscribe(
//         "disqualify",
//         () => {
//           recordingDiaphragm.removeComponent(Unmounting).removeComponent(
//             TrackSnapZone,
//           );
//         },
//       ),

//       this.queries.recordingDiaphragmLeftSnapZoneWhileUnmounting.subscribe(
//         "qualify",
//         () => {
//           this.finishUnmount(recordingDiaphragm);
//         },
//       ),

//       this.queries.recordingDiaphragmReleasedWhileUnmounting.subscribe(
//         "qualify",
//         () => {
//           this.finishUnmount(recordingDiaphragm);
//         },
//       ),

//       this.queries.recordingDiaphragmUnmountPopOut.subscribe(
//         "disqualify",
//         (entity) => {
//           this.completeUnmount(entity);
//         },
//       ),

//       this.queries.activePlaybackDiaphragmMountTask.subscribe("qualify", () => {
//         playbackDiaphragm.object3D!.visible = true;
//         playbackDiaphragm
//           .addComponent(PopIn)
//           .addComponent(OneHandGrabbable)
//           .addComponent(Snappable, { snapPointId: "diaphragm_snap_point" })
//           .addComponent(SnapGhost)
//           .addComponent(Highlight);
//       }),

//       this.queries.snappedPlaybackDiaphragm.subscribe("qualify", (entity) => {
//         entity.removeComponent(Highlight).removeComponent(SnapGhost);
//         for (const task of this.queries.activePlaybackDiaphragmMountTask
//           .entities) {
//           task.addComponent(CompletedTask);
//         }
//       }),
//     );
//   }

//   private finishUnmount(recordingDiaphragm: Entity) {
//     if (!recordingDiaphragm.hasComponent(Unmounting)) return;
//     if (recordingDiaphragm.hasComponent(PopOut)) return;

//     recordingDiaphragm
//       .removeComponent(Highlight)
//       .removeComponent(TrackSnapZone)
//       .removeComponent(Snappable)
//       .removeComponent(InSnapZone)
//       .addComponent(PopOut);
//   }

//   private completeUnmount(recordingDiaphragm: Entity) {
//     recordingDiaphragm
//       .addComponent(ForceRelease)
//       .removeComponent(OneHandGrabbable)
//       .removeComponent(Unmounting);

//     const obj = recordingDiaphragm.object3D;
//     if (obj) {
//       obj.scale.setScalar(0.001);
//       obj.visible = false;
//     }

//     for (const task of this.queries.activeRecordingDiaphragmUnmountTask
//       .entities) {
//       task.addComponent(CompletedTask);
//     }
//   }
// }
