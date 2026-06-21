export const WEEKDAY_DICT_KEYS = [
  "weekdaySunday",
  "weekdayMonday",
  "weekdayTuesday",
  "weekdayWednesday",
  "weekdayThursday",
  "weekdayFriday",
  "weekdaySaturday",
] as const;

export type WeekdayDictKey = (typeof WEEKDAY_DICT_KEYS)[number];
