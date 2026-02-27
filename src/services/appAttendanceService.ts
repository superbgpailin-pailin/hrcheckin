import { supabase } from '../lib/supabaseClient';
import { DEFAULT_SHIFTS } from '../data/appDefaults';
import type { AppEmployee, AttendanceSummaryRecord, ShiftDefinition } from '../types/app';
import { dayKey, estimatedCheckoutAt, lateMinutesForCheckIn, resolveShiftWindow } from '../utils/shiftUtils';

const tableName = 'attendance';
const localStorageKey = 'hrcheckin_attendance_v2';
const duplicateCheckInMessage = 'มีการเช็คอินกะนี้แล้ว';

interface AttendanceRow {
    id?: string | null;
    employee_id?: string | null;
    user_id?: string | null;
    timestamp?: string | null;
    check_in_time?: string | null;
    created_at?: string | null;
    status?: string | null;
    shift_name?: string | null;
    shift?: string | null;
    site_id?: string | null;
    site?: string | null;
    kiosk_id?: string | null;
    type?: string | null;
    attendance_type?: string | null;
}

interface NormalizedAttendanceRow {
    id: string;
    employee_id: string;
    timestamp: string;
    status: 'On Time' | 'Late' | null;
    shift_name: string | null;
    site_id: string | null;
    type: 'check_in' | 'check_out' | null;
}

interface LocalCheckInRow {
    id: string;
    employee_id: string;
    timestamp: string;
    status: 'On Time' | 'Late';
    shift_name: string;
    site_id: string;
    type: 'check_in';
}

interface AttendanceFilters {
    from?: string;
    to?: string;
    employeeId?: string;
}

const optionalInsertColumns = [
    'user_id',
    'site_name',
    'site',
    'kiosk_id',
    'lat',
    'lng',
    'photo_url',
    'type',
    'attendance_type',
    'status',
    'shift_name',
    'shift',
    'site_id',
    'timestamp',
    'check_in_time',
];

const asText = (value: unknown): string => {
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number') {
        return String(value);
    }
    return '';
};

const toIsoString = (value: unknown): string => {
    const raw = asText(value);
    if (!raw) {
        return new Date().toISOString();
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
        return new Date().toISOString();
    }
    return parsed.toISOString();
};

const normalizeStatus = (value: unknown): 'On Time' | 'Late' | null => {
    const normalized = asText(value).trim().toLowerCase();
    if (normalized === 'late') {
        return 'Late';
    }
    if (normalized === 'on time' || normalized === 'ontime') {
        return 'On Time';
    }
    return null;
};

const normalizeType = (value: unknown): 'check_in' | 'check_out' | null => {
    const normalized = asText(value).trim().toLowerCase();
    if (!normalized || normalized === 'check_in') {
        return 'check_in';
    }
    if (normalized === 'check_out') {
        return 'check_out';
    }
    return null;
};

const normalizeAttendanceRow = (row: AttendanceRow): NormalizedAttendanceRow => {
    const employeeId = asText(row.employee_id) || asText(row.user_id);
    const timestamp = toIsoString(row.timestamp || row.check_in_time || row.created_at);
    const shiftName = asText(row.shift_name) || asText(row.shift) || null;
    const siteId = asText(row.site_id) || asText(row.site) || asText(row.kiosk_id) || null;
    const type = normalizeType(row.type || row.attendance_type);
    const id = asText(row.id) || `ROW-${employeeId || 'UNKNOWN'}-${timestamp}`;

    return {
        id,
        employee_id: employeeId,
        timestamp,
        status: normalizeStatus(row.status),
        shift_name: shiftName,
        site_id: siteId,
        type,
    };
};

const normalizeLocalRow = (row: LocalCheckInRow): NormalizedAttendanceRow => {
    return {
        id: row.id,
        employee_id: row.employee_id,
        timestamp: toIsoString(row.timestamp),
        status: row.status,
        shift_name: row.shift_name,
        site_id: row.site_id,
        type: row.type,
    };
};

const withinFilters = (row: Pick<NormalizedAttendanceRow, 'employee_id' | 'timestamp'>, filters: AttendanceFilters): boolean => {
    if (filters.employeeId && row.employee_id !== filters.employeeId) {
        return false;
    }

    const date = dayKey(row.timestamp);
    if (filters.from && date < filters.from) {
        return false;
    }
    if (filters.to && date > filters.to) {
        return false;
    }

    return true;
};

const readLocalRows = (): LocalCheckInRow[] => {
    try {
        const raw = localStorage.getItem(localStorageKey);
        if (!raw) {
            return [];
        }
        return JSON.parse(raw) as LocalCheckInRow[];
    } catch {
        return [];
    }
};

const writeLocalRows = (rows: LocalCheckInRow[]): void => {
    localStorage.setItem(localStorageKey, JSON.stringify(rows));
};

const shiftByNameOrId = (nameOrId: string, shifts: ShiftDefinition[]): ShiftDefinition => {
    const source = shifts.length ? shifts : DEFAULT_SHIFTS;
    const byId = source.find((shift) => shift.id === nameOrId);
    if (byId) {
        return byId;
    }

    const byLabel = source.find((shift) => shift.label === nameOrId);
    if (byLabel) {
        return byLabel;
    }

    return source[0];
};

const toSummary = (
    row: Pick<NormalizedAttendanceRow, 'id' | 'employee_id' | 'timestamp' | 'status' | 'shift_name' | 'site_id'>,
    shifts: ShiftDefinition[],
    employeeMap: Map<string, AppEmployee>,
    graceMinutes: number,
): AttendanceSummaryRecord => {
    const employee = employeeMap.get(row.employee_id);
    const shift = shiftByNameOrId(row.shift_name || '', shifts);
    const checkInAt = new Date(row.timestamp);
    const lateMinutes = lateMinutesForCheckIn(checkInAt, shift, graceMinutes);

    return {
        id: row.id,
        employeeId: row.employee_id,
        employeeName: employee
            ? `${employee.firstNameTH} ${employee.lastNameTH}`
            : row.employee_id,
        department: employee?.department || '-',
        role: employee?.role || 'Employee',
        shiftId: shift.id,
        shiftLabel: shift.label,
        checkInAt: row.timestamp,
        estimatedCheckOutAt: estimatedCheckoutAt(checkInAt, shift).toISOString(),
        lateMinutes,
        status: row.status || (lateMinutes > 0 ? 'Late' : 'On Time'),
        source: 'QR',
        kioskId: row.site_id || 'kiosk',
    };
};

const hasDuplicateWithinShiftWindow = (
    rows: Array<Pick<NormalizedAttendanceRow, 'employee_id' | 'timestamp' | 'shift_name' | 'type'>>,
    employeeId: string,
    shift: ShiftDefinition,
    checkInAt: Date,
): boolean => {
    const { start, end } = resolveShiftWindow(checkInAt, shift);

    return rows.some((row) => {
        if (row.employee_id !== employeeId || row.type !== 'check_in') {
            return false;
        }

        const rowShift = row.shift_name || '';
        if (rowShift !== shift.id && rowShift !== shift.label) {
            return false;
        }

        const at = new Date(row.timestamp).getTime();
        return at >= start.getTime() && at <= end.getTime();
    });
};

const shouldRetryWithoutTimestampFilter = (message: string): boolean => {
    const normalized = message.toLowerCase();
    return normalized.includes('timestamp') && normalized.includes('column');
};

const loadRowsFromSupabase = async (filters: AttendanceFilters): Promise<NormalizedAttendanceRow[]> => {
    const queryRows = async (withTimestampFilter: boolean): Promise<AttendanceRow[]> => {
        let query = supabase
            .from(tableName)
            .select('*');

        if (filters.employeeId) {
            query = query.eq('employee_id', filters.employeeId);
        }

        if (withTimestampFilter && filters.from) {
            query = query.gte('timestamp', `${filters.from}T00:00:00`);
        }

        if (withTimestampFilter && filters.to) {
            query = query.lte('timestamp', `${filters.to}T23:59:59`);
        }

        const { data, error } = await query;
        if (error) {
            throw error;
        }

        return (data as AttendanceRow[]) || [];
    };

    let rows: AttendanceRow[] = [];

    try {
        rows = await queryRows(true);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error || '');
        if (!shouldRetryWithoutTimestampFilter(message)) {
            throw error;
        }
        rows = await queryRows(false);
    }

    return rows
        .map(normalizeAttendanceRow)
        .filter((row) => row.employee_id)
        .filter((row) => row.type !== 'check_out')
        .filter((row) => withinFilters(row, filters))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

const extractMissingColumn = (message: string): string | null => {
    const match = message.toLowerCase().match(/['"`]([a-z0-9_]+)['"`]\s+column/);
    if (match?.[1]) {
        return match[1];
    }

    const fallback = message.toLowerCase().match(/column ['"`]?([a-z0-9_]+)['"`]?/);
    return fallback?.[1] || null;
};

const removeColumnsByMessage = (
    source: Record<string, string | number>,
    message: string,
): { nextPayload: Record<string, string | number>; removedAny: boolean } => {
    const normalized = message.toLowerCase();
    const nextPayload: Record<string, string | number> = { ...source };
    let removedAny = false;

    optionalInsertColumns.forEach((column) => {
        if (normalized.includes(column) && column in nextPayload) {
            delete nextPayload[column];
            removedAny = true;
        }
    });

    const discoveredColumn = extractMissingColumn(normalized);
    if (discoveredColumn && discoveredColumn in nextPayload) {
        delete nextPayload[discoveredColumn];
        removedAny = true;
    }

    return { nextPayload, removedAny };
};

const isDuplicateInsertError = (message: string): boolean => {
    const normalized = message.toLowerCase();
    return normalized.includes('duplicate key')
        || normalized.includes('ux_attendance_checkin_per_shift_day');
};

const insertWithLegacyPayloadFallback = async (payload: Record<string, string | number>): Promise<void> => {
    let workingPayload = { ...payload };
    let lastMessage = '';

    for (let attempt = 0; attempt < 12; attempt += 1) {
        const { error } = await supabase.from(tableName).insert([workingPayload]);
        if (!error) {
            return;
        }

        if (isDuplicateInsertError(error.message)) {
            throw new Error(duplicateCheckInMessage);
        }

        lastMessage = error.message;
        const { nextPayload, removedAny } = removeColumnsByMessage(workingPayload, error.message);
        if (!removedAny) {
            throw error;
        }
        workingPayload = nextPayload;
    }

    throw new Error(lastMessage || 'ไม่สามารถบันทึกเช็คอินได้');
};

const dedupeRows = (rows: NormalizedAttendanceRow[]): NormalizedAttendanceRow[] => {
    const map = new Map<string, NormalizedAttendanceRow>();

    rows.forEach((row) => {
        const key = `${row.employee_id}|${row.timestamp}|${row.shift_name || ''}|${row.type || 'check_in'}`;
        if (!map.has(key)) {
            map.set(key, row);
        }
    });

    return Array.from(map.values())
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

export const appAttendanceService = {
    async recordCheckIn(
        employee: AppEmployee,
        shift: ShiftDefinition,
        kioskId: string,
        graceMinutes: number,
    ): Promise<AttendanceSummaryRecord> {
        const now = new Date();
        const nowIso = now.toISOString();
        const lateMinutes = lateMinutesForCheckIn(now, shift, graceMinutes);
        const status: 'On Time' | 'Late' = lateMinutes > 0 ? 'Late' : 'On Time';

        let existingRows: NormalizedAttendanceRow[] = [];
        try {
            existingRows = await loadRowsFromSupabase({ employeeId: employee.id });
        } catch {
            existingRows = [];
        }

        const localRows = readLocalRows().map(normalizeLocalRow);
        const rowsForDuplicateCheck = dedupeRows([...existingRows, ...localRows]);
        if (hasDuplicateWithinShiftWindow(rowsForDuplicateCheck, employee.id, shift, now)) {
            throw new Error(duplicateCheckInMessage);
        }

        const payload: Record<string, string | number> = {
            user_id: employee.id,
            employee_id: employee.id,
            timestamp: nowIso,
            check_in_time: nowIso,
            type: 'check_in',
            attendance_type: 'check_in',
            site_id: kioskId,
            site: kioskId,
            kiosk_id: kioskId,
            site_name: 'QR Kiosk',
            lat: 0,
            lng: 0,
            photo_url: '',
            status,
            shift_name: shift.id,
            shift: shift.id,
        };

        try {
            await insertWithLegacyPayloadFallback(payload);

            const remoteRow: NormalizedAttendanceRow = {
                id: `REMOTE-${Date.now()}`,
                employee_id: employee.id,
                timestamp: nowIso,
                status,
                shift_name: shift.id,
                site_id: kioskId,
                type: 'check_in',
            };

            return toSummary(remoteRow, [shift], new Map([[employee.id, employee]]), graceMinutes);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error || '');
            if (message === duplicateCheckInMessage || isDuplicateInsertError(message)) {
                throw new Error(duplicateCheckInMessage);
            }

            const freshLocalRows = readLocalRows().map(normalizeLocalRow);
            if (hasDuplicateWithinShiftWindow(freshLocalRows, employee.id, shift, now)) {
                throw new Error(duplicateCheckInMessage);
            }

            const localRow: LocalCheckInRow = {
                id: `LOCAL-${Date.now()}`,
                employee_id: employee.id,
                timestamp: nowIso,
                status,
                shift_name: shift.id,
                site_id: kioskId,
                type: 'check_in',
            };

            writeLocalRows([localRow, ...readLocalRows()]);
            return toSummary(normalizeLocalRow(localRow), [shift], new Map([[employee.id, employee]]), graceMinutes);
        }
    },

    async listCheckIns(
        shifts: ShiftDefinition[],
        employees: AppEmployee[],
        graceMinutes: number,
        filters: AttendanceFilters = {},
    ): Promise<AttendanceSummaryRecord[]> {
        const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));

        const localRows = readLocalRows()
            .map(normalizeLocalRow)
            .filter((row) => withinFilters(row, filters));

        let remoteRows: NormalizedAttendanceRow[] = [];
        try {
            remoteRows = await loadRowsFromSupabase(filters);
        } catch {
            remoteRows = [];
        }

        const mergedRows = dedupeRows([...remoteRows, ...localRows]);
        return mergedRows.map((row) => toSummary(row, shifts, employeeMap, graceMinutes));
    },
};
