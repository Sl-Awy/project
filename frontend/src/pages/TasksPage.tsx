import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getTasks, updateTaskPriority } from "../api/tasks";
import Menu from "../components/Menu";
import type {
  Task,
  TaskComplexity,
  TaskStatus,
  TaskUrgency,
} from "../types/task";

const URGENCY_OPTIONS: TaskUrgency[] = ["low", "medium", "high", "critical"];

const URGENCY_STYLES: Record<TaskUrgency, string> = {
  low: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  high: "bg-orange-500/15 text-orange-300 border-orange-500/40",
  critical: "bg-red-500/15 text-red-300 border-red-500/40",
};

const COMPLEXITY_STYLES: Record<TaskComplexity, string> = {
  simple: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
  moderate: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  complex: "bg-purple-500/10 text-purple-300 border-purple-500/30",
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  done: "Done",
};

const URGENCY_RANK: Record<TaskUrgency, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function formatDue(due: string | null): string | null {
  if (!due) return null;
  const date = new Date(due.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

interface TaskCardProps {
  task: Task;
  saving: boolean;
  onPriorityChange: (id: number, urgency: TaskUrgency) => void;
}

const TaskCard = ({ task, saving, onPriorityChange }: TaskCardProps) => {
  const due = formatDue(task.due_date);
  return (
    <div className="forms1 w-full rounded-lg p-4 shadow-lg border border-gray-700/60">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-gray-100 font-semibold leading-snug">{task.title}</h3>
        <span className="text-xs text-gray-400 whitespace-nowrap mt-1">
          {STATUS_LABELS[task.status] ?? task.status}
        </span>
      </div>

      {task.description && (
        <p className="text-sm text-gray-400 mt-2">{task.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <label
          className={`flex items-center gap-1.5 text-xs font-medium pl-2 pr-1 py-0.5 rounded-full border ${URGENCY_STYLES[task.urgency]}`}
        >
          <span>Priority</span>
          <select
            value={task.urgency}
            disabled={saving}
            onChange={(e) =>
              onPriorityChange(task.id, e.target.value as TaskUrgency)
            }
            className="bg-transparent text-inherit text-xs font-semibold outline-none cursor-pointer disabled:opacity-50 [&>option]:text-black"
            aria-label="Change task priority"
          >
            {URGENCY_OPTIONS.map((u) => (
              <option key={u} value={u}>
                {capitalize(u)}
              </option>
            ))}
          </select>
        </label>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full border ${COMPLEXITY_STYLES[task.complexity]}`}
        >
          {capitalize(task.complexity)}
        </span>
        {due && (
          <span className="text-xs text-gray-400 ml-auto">Due {due}</span>
        )}
      </div>
    </div>
  );
};

const TasksPage = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const res = await getTasks();
      if (!active) return;
      if (res.success && res.data) {
        setTasks(res.data);
      } else {
        setError(res.error || "Could not load tasks.");
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const handlePriorityChange = async (id: number, urgency: TaskUrgency) => {
    const previous = tasks.find((t) => t.id === id)?.urgency;
    if (previous === urgency) return;

    setNotice(null);
    setSavingId(id);
    // Optimistic update for an immediate, real-time feel.
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, urgency } : t))
    );

    const res = await updateTaskPriority(id, urgency);
    setSavingId(null);

    if (res.success && res.data) {
      setTasks((prev) => prev.map((t) => (t.id === id ? res.data : t)));
      setNotice("Priority updated.");
    } else {
      // Roll back on failure.
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id && previous ? { ...t, urgency: previous } : t
        )
      );
      setNotice(res.error || "Could not update priority.");
    }
  };

  const sortByUrgency = (list: Task[]) =>
    [...list].sort((a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency]);

  const dayTasks = useMemo(
    () => sortByUrgency(tasks.filter((t) => t.scope === "day")),
    [tasks]
  );
  const weekTasks = useMemo(
    () => sortByUrgency(tasks.filter((t) => t.scope === "week")),
    [tasks]
  );

  const renderSection = (
    title: string,
    subtitle: string,
    list: Task[]
  ) => (
    <section className="w-full max-w-2xl">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xl font-semibold text-gray-100">{title}</h2>
        <span className="text-sm text-gray-500">
          {list.length} {list.length === 1 ? "task" : "tasks"}
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-3">{subtitle}</p>
      {list.length === 0 ? (
        <p className="text-gray-500 text-sm py-4">No tasks here. Nice work.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              saving={savingId === task.id}
              onPriorityChange={handlePriorityChange}
            />
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div className="mt-10 gap-6 flex flex-col items-center px-4 pb-28">
      <div className="w-full max-w-2xl flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/profile")}
          className="px-3 py-1.5 rounded-lg border border-gray-600 text-gray-300 hover:text-white hover:border-cyan-400 transition-colors"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-bold text-gray-50">My Tasks</h1>
      </div>

      <p className="w-full max-w-2xl text-sm text-gray-500 -mt-2">
        You can adjust the priority of any task. Status changes are managed by
        your administrator.
      </p>

      {notice && (
        <p className="w-full max-w-2xl text-sm text-cyan-400" role="status">
          {notice}
        </p>
      )}

      {loading ? (
        <span className="text-gray-400 text-lg py-10">Loading tasks...</span>
      ) : error ? (
        <span className="text-red-400 text-lg py-10">{error}</span>
      ) : (
        <>
          {renderSection("Today", "Tasks scheduled for the day.", dayTasks)}
          {renderSection("This Week", "Tasks planned for the week ahead.", weekTasks)}
        </>
      )}

      <Menu />
    </div>
  );
};

export default TasksPage;
