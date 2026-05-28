import { createComponent, Types } from "@iwsdk/core";

export const Task = createComponent("Task", {
  id: { type: Types.String, default: "main_menu" },
});
export const ActiveTask = createComponent("ActiveTask", {});
export const CompletedTask = createComponent("CompletedTask", {});
