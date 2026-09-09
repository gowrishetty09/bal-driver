import type { DriverJob } from '../api/driver';

const confirmedAt = new Map<string, string>();

export function rememberAssignmentConfirmation(jobId: string, acknowledgedAt: string) {
  confirmedAt.set(jobId, acknowledgedAt);
}

export function applyAssignmentConfirmation<T extends DriverJob>(job: T): T {
  const local = confirmedAt.get(job.id);
  if (!local || job.assignmentAcknowledgedAt) return job;
  if (job.assignmentNotifiedAt && Date.parse(job.assignmentNotifiedAt) > Date.parse(local)) {
    return job;
  }
  return {...job, assignmentAcknowledgedAt: local};
}

// Older snapshots and partial socket events must not undo a confirmed assignment.
export function mergeDriverJob(current: DriverJob, incoming: Partial<DriverJob>): DriverJob {
  const merged = {...current, ...incoming};
  const reassigned = current.assignmentNotifiedAt && incoming.assignmentNotifiedAt &&
    current.assignmentNotifiedAt !== incoming.assignmentNotifiedAt;
  if (!reassigned && current.assignmentAcknowledgedAt && !incoming.assignmentAcknowledgedAt) {
    merged.assignmentAcknowledgedAt = current.assignmentAcknowledgedAt;
  }
  return applyAssignmentConfirmation(merged);
}
