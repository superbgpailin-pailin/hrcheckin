import type { AppEmployee, AppSystemConfig, ShiftDefinition } from '../types/app';

const MINUTES_PER_DAY = 24 * 60;

export const parseTimeToMinutes = (time: string): number => {
    const [hourRaw, minuteRaw] = time.split(':');
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);

    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
        return 0;
    }

    if (hour === 24 && minute === 0) {
        return MINUTES_PER_DAY;
    }

    return Math.max(0, Math.min(MINUTES_PER_DAY - 1, hour * 60 + minute));
};

export const monthKey = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
};

const dateString = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const dayBeforeMonthEnd = (baseMonth: Date): string => {
    const year = baseMonth.getFullYear();
    const month = baseMonth.getMonth();
    const lastDay = new Date(year, month + 1, 0);
    const controlDay = new Date(lastDay);
    controlDay.setDate(lastDay.getDate() - 1);
    return dateString(controlDay);
};

export const controlDayForMonth = (dateInMonth: Date, config: AppSystemConfig): string => {
    const key = monthKey(dateInMonth);
    const manual = config.controlShiftPolicy.overrides[key];
    return manual || dayBeforeMonthEnd(dateInMonth);
};

export const isControlDay = (target: Date, config: AppSystemConfig): boolean => {
    if (!config.controlShiftPolicy.enabled) {
        return false;
    }
    return dateString(target) === controlDayForMonth(target, config);
};

export const getShiftById = (shifts: ShiftDefinition[], shiftId: string): ShiftDefinition | undefined => {
    return shifts.find((shift) => shift.id === shiftId);
};

export const getAvailableShifts = (
    atDate: Date,
    employeeRole: AppEmployee['role'],
    config: AppSystemConfig,
): ShiftDefinition[] => {
    void atDate;
    void employeeRole;

    const seen = new Set<string>();
    return config.shifts.filter((shift) => {
        if (seen.has(shift.id)) {
            return false;
        }
        seen.add(shift.id);
        return true;
    });
};

export const resolveShiftWindow = (checkInAt: Date, shift: ShiftDefinition): { start: Date; end: Date } => {
    const startMinutes = parseTimeToMinutes(shift.start);
    const endMinutes = parseTimeToMinutes(shift.end);
    const crossesMidnight = endMinutes <= startMinutes;

    const dayStart = new Date(checkInAt);
    dayStart.setHours(0, 0, 0, 0);

    const startToday = new Date(dayStart);
    startToday.setMinutes(startMinutes);

    let start = startToday;
    if (crossesMidnight) {
        const startYesterday = new Date(startToday);
        startYesterday.setDate(startYesterday.getDate() - 1);

        const diffToday = Math.abs(checkInAt.getTime() - startToday.getTime());
        const diffYesterday = Math.abs(checkInAt.getTime() - startYesterday.getTime());

        start = diffYesterday < diffToday ? startYesterday : startToday;
    }

    const durationMinutes = crossesMidnight
        ? (MINUTES_PER_DAY - startMinutes) + endMinutes
        : Math.max(0, endMinutes - startMinutes);

    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    return { start, end };
};

export const lateMinutesForCheckIn = (checkInAt: Date, shift: ShiftDefinition, graceMinutes: number): number => {
    const { start } = resolveShiftWindow(checkInAt, shift);
    const diff = Math.floor((checkInAt.getTime() - start.getTime()) / 60000);
    return Math.max(0, diff - graceMinutes);
};

export const estimatedCheckoutAt = (checkInAt: Date, shift: ShiftDefinition): Date => {
    const { end } = resolveShiftWindow(checkInAt, shift);
    return end;
};

export const formatThaiDateTime = (iso: string): string => {
    const parsed = new Date(iso);
    return parsed.toLocaleString('th-TH', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export const dayKey = (iso: string): string => {
    const parsed = new Date(iso);
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
};
