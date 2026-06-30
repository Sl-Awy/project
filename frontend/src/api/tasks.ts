import { apiRequest } from "./client";
import type { Task, TaskScope, TaskUrgency } from "../types/task";

/** Fetch the current user's tasks (optionally limited to a single scope). */
export function getTasks(scope?: TaskScope) {
  const query = scope ? `?scope=${scope}` : "";
  return apiRequest<Task[]>(`/api/tasks${query}`);
}

export function updateTaskPriority(id: number, urgency: TaskUrgency) {
  return apiRequest<Task>(`/api/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ urgency }),
  });
}
