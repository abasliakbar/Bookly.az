const dateParts = (
  value: Date,
  timeZone: string,
): Record<string, string> => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  return Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
};

export function localDateString(value: Date, timeZone: string): string {
  const parts = dateParts(value, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function localTimeString(value: Date, timeZone: string): string {
  const parts = dateParts(value, timeZone);
  return `${parts.hour}:${parts.minute}`;
}

export function localDateTimeToUtc(
  date: string,
  time: string,
  timeZone: string,
): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const requestedWallTime = Date.UTC(year, month - 1, day, hour, minute);
  const local = dateParts(new Date(requestedWallTime), timeZone);
  const representedWallTime = Date.UTC(
    Number(local.year),
    Number(local.month) - 1,
    Number(local.day),
    Number(local.hour),
    Number(local.minute),
  );
  return new Date(requestedWallTime - (representedWallTime - requestedWallTime));
}

export function addLocalCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

export function weekdayKey(date: string): string {
  const noonUtc = new Date(`${date}T12:00:00.000Z`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "UTC",
  })
    .format(noonUtc)
    .toLowerCase();
}
