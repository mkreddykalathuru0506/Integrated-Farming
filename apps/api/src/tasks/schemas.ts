import { z } from 'zod';
import { TaskType, Frequency } from '@prisma/client';

export const CreateScheduleSchema = z.object({
  name: z.string().min(1).max(120),
  taskType: z.nativeEnum(TaskType),
  frequency: z.nativeEnum(Frequency),
  unitId: z.string().min(1).optional(),
  timeOfDay: z.string().regex(/^\d{2}:\d{2}$/, 'timeOfDay must be HH:MM').optional(),
  assignedWorkerId: z.string().min(1).optional(),
});

export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(160),
  taskType: z.nativeEnum(TaskType),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dueDate must be YYYY-MM-DD'),
  unitId: z.string().min(1).optional(),
  assignedWorkerId: z.string().min(1).optional(),
});

export const CompleteTaskSchema = z.object({ notes: z.string().max(500).optional() });

/** Assign body — `workerId: null` unassigns. Strict: unknown keys → 400. */
export const AssignTaskSchema = z.object({ workerId: z.string().min(1).nullable() }).strict();

export type CreateScheduleInput = z.infer<typeof CreateScheduleSchema>;
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
