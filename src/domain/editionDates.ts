import { addCalendarDays, addCalendarMonths } from "./lineupBoard";

export type EditionDateFields = {
  applicationStartDate: string | null;
  applicationEndDate: string | null;
  resultDate: string | null;
  startDate: string | null;
  endDate: string | null;
};

export function fillEditionDates(input: EditionDateFields): EditionDateFields {
  let applicationEndDate = input.applicationEndDate;
  let resultDate = input.resultDate;
  let endDate = input.endDate;

  if (input.applicationStartDate) {
    if (!applicationEndDate) {
      applicationEndDate = addCalendarDays(input.applicationStartDate, 7);
    }
    if (!resultDate) {
      resultDate = addCalendarMonths(input.applicationStartDate, 1);
    }
  }

  if (input.startDate && !endDate) {
    endDate = addCalendarDays(input.startDate, 1);
  }

  return {
    applicationStartDate: input.applicationStartDate,
    applicationEndDate,
    resultDate,
    startDate: input.startDate,
    endDate,
  };
}
