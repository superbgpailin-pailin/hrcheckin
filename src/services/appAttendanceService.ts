import { supabase } from '../lib/supabaseClient';
import type { AppEmployee, AttendanceSummaryRecord, ShiftDefinition } from '../types/app';
import { estimatedCheckoutAt, lateMinutesForCheckIn, resolveShiftWindow } from '../utils/shiftUtils';

const tableName = 'attendance';
const localStorageKey = 'hrcheckin_attendance_v2';

interface AttendanceRow {
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
    const byId = shifts.find((shift) => shift.id === nameOrId);
    if (byId) {
        return byId;
    }

    const byLabel = shifts.find((shift) => shift.label === nameOrId);
    if (byLabel) {
        return byLabel;
    }

    return shifts[0];
};

const toSummary = (
    row: Pick<AttendanceRow, 'id' | 'employee_id' | 'timestamp' | 'status' | 'shift_name' | 'site_id'>,
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
    rows: Array<Pick<AttendanceRow, 'employee_id' | 'timestamp' | 'shift_name' | 'type'>>,
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

const loadRowsFromSupabase = async (filters: AttendanceFilters): Promise<AttendanceRow[]> => {
    let query = supabase
        .from(tableName)
        .select('id, employee_id, timestamp, status, shift_name, site_id, type')
        .eq('type', 'check_in')
        .order('timestamp', { ascending: false });

    if (filters.employeeId) {
        query = query.eq('employee_id', filters.employeeId);
    }

    if (filters.from) {
        query = query.gte('timestamp', `${filters.from}T00:00:00`);
    }

    if (filters.to) {
        query = query.lte('timestamp', `${filters.to}T23:59:59`);
    }

    const { data, error } = await query;

    if (error) {
        throw error;
    }

    return (data as AttendanceRow[]) || [];
};

export const appAttendanceService = {
    async recordCheckIn(
        employee: AppEmployee,
        shift: ShiftDefinition,
        kioskId: string,
        graceMinutes: number,
    ): Promise<AttendanceSummaryRecord> {
        const now = new Date();
        const lateMinutes = lateMinutesForCheckIn(now, shift, graceMinutes);
        const status: 'On Time' | 'Late' = lateMinutes > 0 ? 'Late' : 'On Time';

        try {
            const existingRows = await loadRowsFromSupabase({ employeeId: employee.id });
            if (hasDuplicateWithinShiftWindow(existingRows, employee.id, shift, now)) {
                throw new Error('มีการเช็คอินกะนี้แล้ว');
            }

            const payload = {
                user_id: employee.id,
                employee_id: employee.id,
                timestamp: now.toISOString(),
                type: 'check_in',
                site_id: kioskId,
                site_name: 'QR Kiosk',
                lat: 0,
                lng: 0,
                photo_url: '',
                status,
                shift_name: shift.id,
            };

            const { data, error } = await supabase
                .from(tableName)
                .insert([payload])
                .select('id, employee_id, timestamp, status, shift_name, site_id, type')
                .single();

            if (error) {
                throw error;
            }

            const row = data as AttendanceRow;
            return toSummary(row, [shift], new Map([[employee.id, employee]]), graceMinutes);
        } catch (error) {
            const localRows = readLocalRows();
            if (hasDuplicateWithinShiftWindow(localRows, employee.id, shift, now)) {
                throw new Error('มีการเช็คอินกะนี้แล้ว');
            }

            const localRow: LocalCheckInRow = {
                id: `LOCAL-${Date.now()}`,
                employee_id: employee.id,
                timestamp: now.toISOString(),
                status,
                shift_name: shift.id,
                site_id: kioskId,
                type: 'check_in',
            };

            writeLocalRows([localRow, ...localRows]);

            if (error instanceof Error && error.message === 'มีการเช็คอินกะนี้แล้ว') {
                throw error;
            }

            return toSummary(localRow, [shift], new Map([[employee.id, employee]]), graceMinutes);
        }
    },

    async listCheckIns(
        shifts: ShiftDefinition[],
        employees: AppEmployee[],
        graceMinutes: number,
        filters: AttendanceFilters = {},
    ): Promise<AttendanceSummaryRecord[]> {
        const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));

        try {
            const rows = await loadRowsFromSupabase(filters);
            return rows.map((row) => toSummary(row, shifts, employeeMap, graceMinutes));
        } catch {
            const localRows = readLocalRows()
                .filter((row) => !filters.employeeId || row.employee_id === filters.employeeId)
                .filter((row) => {
                    if (!filters.from && !filters.to) {
                        return true;
                    }
                    const date = row.timestamp.slice(0, 10);
                    if (filters.from && date < filters.from) {
                        return false;
                    }
                    if (filters.to && date > filters.to) {
                        return false;
                    }
                    return true;
                });

            return localRows.map((row) => toSummary(row, shifts, employeeMap, graceMinutes));
        }
    },
};
