import type { Status } from "./status";

export type StatusDateFields = {
  fromStatus: Status | string | null;
  toStatus: Status;
  submittedAt: string | null;
  resultDate: string | null;
  today: string;
};

export function fillStatusDates(input: StatusDateFields): {
  submittedAt: string | null;
  resultDate: string | null;
} {
  let submittedAt = input.submittedAt;
  let resultDate = input.resultDate;

  if (input.fromStatus !== input.toStatus) {
    if (input.toStatus === "submitted" && !submittedAt) {
      submittedAt = input.today;
    }
    if (
      (input.toStatus === "approved" || input.toStatus === "waitlisted" || input.toStatus === "rejected") &&
      !resultDate
    ) {
      resultDate = input.today;
    }
  }

  return { submittedAt, resultDate };
}
