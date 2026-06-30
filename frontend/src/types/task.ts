export type TaskUrgency = "low" | "medium" | "high" | "critical";
export type TaskComplexity = "simple" | "moderate" | "complex";
export type TaskScope = "day" | "week";
export type TaskStatus = "pending" | "in_progress" | "done";

/** A construction-crew task/assignment as returned by GET /api/tasks. */
export interface Task {
  id: number;
  title: string;
  description: string | null;
  urgency: TaskUrgency;
  complexity: TaskComplexity;
  scope: TaskScope;
  status: TaskStatus;
  due_date: string | null;
  created_at: string;
}
