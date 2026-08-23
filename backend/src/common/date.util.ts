export function calculateDateDiff(startDate: Date, endDate: Date): {
  years: number;
  months: number;
  days: number;
  totalMonths: number;
  totalDays: number;
  totalYears: number;
} {
  const start = new Date(startDate);
  const end = new Date(endDate);

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
    days += prevMonth.getDate();
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  const totalDays = Math.floor(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );

  const totalMonths = years * 12 + months;

  const totalYears = years + months / 12 + days / 365.25;

  return {
    years,
    months,
    days,
    totalMonths,
    totalDays,
    totalYears,
  };
}

export function formatTenure(diff: {
  years: number;
  months: number;
  days: number;
}): string {
  const parts: string[] = [];
  if (diff.years > 0) parts.push(`${diff.years}年`);
  if (diff.months > 0) parts.push(`${diff.months}个月`);
  if (diff.days > 0 && diff.years === 0) parts.push(`${diff.days}天`);
  return parts.length > 0 ? parts.join('') : '0天';
}

export function calculateTenure(hireDate: Date, now: Date = new Date()): {
  years: number;
  months: number;
  days: number;
  totalMonths: number;
  totalDays: number;
  totalYears: number;
  formatted: string;
} {
  const diff = calculateDateDiff(hireDate, now);
  return {
    ...diff,
    formatted: formatTenure(diff),
  };
}

export function formatAvgTenure(totalYears: number): string {
  const years = Math.floor(totalYears);
  const remainingMonths = (totalYears - years) * 12;
  const months = Math.round(remainingMonths);

  const parts: string[] = [];
  if (years > 0) parts.push(`${years}年`);
  if (months > 0) parts.push(`${months}个月`);
  return parts.length > 0 ? parts.join('') : '0个月';
}

export function isValidDate(date: Date | string): boolean {
  const d = date instanceof Date ? date : new Date(date);
  return d instanceof Date && !isNaN(d.getTime());
}

export function isStartBeforeEnd(
  startDate: Date | string,
  endDate: Date | string,
): boolean {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return start.getTime() <= end.getTime();
}

export function isDateNotTooFarFuture(
  date: Date | string,
  maxYearsAhead: number = 1,
): boolean {
  const d = new Date(date);
  const now = new Date();
  const maxDate = new Date(
    now.getFullYear() + maxYearsAhead,
    now.getMonth(),
    now.getDate(),
  );
  return d.getTime() <= maxDate.getTime();
}

export function isDateNotBeforeHireDate(
  date: Date | string,
  hireDate: Date | string,
): boolean {
  const d = new Date(date);
  const hire = new Date(hireDate);
  d.setHours(0, 0, 0, 0);
  hire.setHours(0, 0, 0, 0);
  return d.getTime() >= hire.getTime();
}

export function calculateLeaveDays(
  startDate: Date | string,
  endDate: Date | string,
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
}
