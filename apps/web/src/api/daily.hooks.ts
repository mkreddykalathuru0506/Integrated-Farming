/**
 * Daily-ops domain hooks (slice 11.6a) — workers / attendance / tasks /
 * schedules / daily logs on the shared TanStack Query kit. The attendance and
 * task-complete mutations apply optimistic cache updates (low-stakes,
 * idempotent server writes) so the phone flows never flash a full-list reload.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { qs } from '../lib/http';
import { useApiMutation } from '../lib/useApiMutation';
import type { AttendanceRow, DailyLog, Schedule, Task, Worker } from '../farm/api';
import { useFarmApi } from './FarmContext';
import { farmKeys } from './keys';

/** Schedule row incl. the optional unit the API returns (dormant field). */
export type ScheduleRow = Schedule & { unitId?: string | null };
/** Task row incl. unit/worker assignment fields the API returns. */
export type TaskRow = Task & { unitId?: string | null; assignedWorkerId?: string | null };

// ---------- workers & attendance ----------

export function useWorkers() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'workers'),
    queryFn: async () => (await fetchJson<{ workers: Worker[] }>('/api/farm/workers')).workers,
  });
}

export type CreateWorkerInput = {
  name: string;
  phone?: string;
  designation?: string;
  wageType?: string;
  dailyWageRatePaise?: string;
};

export function useCreateWorker() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ worker: Worker }, CreateWorkerInput>({
    mutationFn: (data) =>
      fetchJson('/api/farm/workers', { method: 'POST', body: JSON.stringify(data) }),
    successKey: 'workers.added',
    invalidate: [farmKeys.list(farmId, 'workers')],
  });
}

export function useAttendance(date: string) {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'attendance', { date }),
    queryFn: async () =>
      (await fetchJson<{ attendance: AttendanceRow[] }>(`/api/farm/attendance${qs({ date })}`))
        .attendance,
  });
}

/**
 * Mark attendance with an optimistic cache update on the day's list — the
 * toggle reflects instantly and only the attendance key is invalidated
 * (targeted; the workers list never reloads).
 */
export function useMarkAttendance(date: string) {
  const { farmId, fetchJson } = useFarmApi();
  const queryClient = useQueryClient();
  const key = farmKeys.list(farmId, 'attendance', { date });
  return useApiMutation<{ attendance: AttendanceRow }, { workerId: string; status: string }>({
    mutationFn: (data) =>
      fetchJson('/api/farm/attendance', { method: 'POST', body: JSON.stringify({ ...data, date }) }),
    onMutate: async ({ workerId, status }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<AttendanceRow[]>(key);
      queryClient.setQueryData<AttendanceRow[]>(key, (rows) => {
        const next = (rows ?? []).filter((r) => r.workerId !== workerId);
        next.push({ id: `optimistic-${workerId}`, workerId, date, status, notes: null });
        return next;
      });
      return { previous };
    },
    onError: (_err, _vars, onMutateResult) => {
      const ctx = onMutateResult as { previous?: AttendanceRow[] } | undefined;
      if (ctx) queryClient.setQueryData(key, ctx.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

// ---------- tasks & schedules ----------

export function useTasks(date: string) {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'tasks', { date }),
    queryFn: async () => (await fetchJson<{ tasks: TaskRow[] }>(`/api/farm/tasks${qs({ date })}`)).tasks,
  });
}

/** Complete a task with an optimistic status flip on the day's list. */
export function useCompleteTask(date: string) {
  const { farmId, fetchJson } = useFarmApi();
  const queryClient = useQueryClient();
  const key = farmKeys.list(farmId, 'tasks', { date });
  return useApiMutation<{ task: TaskRow }, string>({
    mutationFn: (id) =>
      fetchJson(`/api/farm/tasks/${encodeURIComponent(id)}/complete`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    successKey: 'tasks.completed',
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TaskRow[]>(key);
      queryClient.setQueryData<TaskRow[]>(key, (rows) =>
        (rows ?? []).map((task) =>
          task.id === id ? { ...task, status: 'DONE', completedAt: new Date().toISOString() } : task,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, onMutateResult) => {
      const ctx = onMutateResult as { previous?: TaskRow[] } | undefined;
      if (ctx) queryClient.setQueryData(key, ctx.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

export function useGenerateTasks() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ generated: number; missed: number }, string>({
    mutationFn: (date) => fetchJson(`/api/farm/tasks/generate${qs({ date })}`, { method: 'POST' }),
    invalidate: [farmKeys.list(farmId, 'tasks')],
  });
}

export function useSchedules() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'schedules'),
    queryFn: async () =>
      (await fetchJson<{ schedules: ScheduleRow[] }>('/api/farm/schedules')).schedules,
  });
}

export type CreateScheduleInput = {
  name: string;
  taskType: string;
  frequency: string;
  unitId?: string;
  timeOfDay?: string;
  assignedWorkerId?: string;
};

export function useCreateSchedule() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ schedule: ScheduleRow }, CreateScheduleInput>({
    mutationFn: (data) =>
      fetchJson('/api/farm/schedules', { method: 'POST', body: JSON.stringify(data) }),
    successKey: 'tasks.scheduleAdded',
    invalidate: [farmKeys.list(farmId, 'schedules')],
  });
}

// ---------- daily logs ----------

export function useLogs(type?: string) {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'logs', { type: type ?? 'ALL' }),
    queryFn: async () =>
      (await fetchJson<{ logs: DailyLog[] }>(`/api/farm/logs${qs({ type: type || undefined })}`))
        .logs,
  });
}
