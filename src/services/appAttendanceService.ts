import { supabase } from '../lib/supabaseClient';
import { DEFAULT_SHIFTS } from '../data/appDefaults';
import type { AppEmployee, AttendanceSummaryRecord, ShiftDefinition } from '../types/app';
import { auditLogService } from './auditLogService';
import { estimatedCheckoutAt, lateMinutesForCheckIn } from '../utils/shiftUtils';
import { getErrorMessage, isTransportError, withReadRetry } from '../utils/supabaseUtils';

const tableName = 'attendance';
type AttendanceColumnProfile = 'full' | 'lite';

const attendanceSelectColumnsByProfile: Record<AttendanceColumnProfile, string[]> = {
    full: [
        'id',
        'employee_id',
        'user_id',
        'timestamp',
        'created_at',
        'status',
        'shift_name',
        'site_id',
        'type',
        'photo_url',
    ],
    lite: [
        'id',
        'employee_id',
        'user_id',
        'timestamp',
        'created_at',
        'status',
        'shift_name',
        'type',
    ],
};
const duplicateCheckInMessage = 'You already checked in today.';
const saveFailedMessage = 'Check-in could not be saved on the server. Please try again or contact admin.';
const readFailedMessage = 'Database server is slow or unavailable. Please try again.';
const BANGKOK_UTC_OFFSET = '+07:00';



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
    photo_url?: string | null;
}

interface NormalizedAttendanceRow {
    id: string;
    employee_id: string;
    timestamp: string;
    status: 'On Time' | 'Late' | null;
    shift_name: string | null;
    site_id: string | null;
    type: 'check_in' | 'check_out' | null;
    photo_url: string | null;
}

interface AttendanceFilters {
    from?: string;
    to?: string;
    employeeId?: string;
}

interface AttendanceLoadOptions {
    useCache?: boolean;
    rowLimit?: number;
    profile?: AttendanceColumnProfile;
}

interface ListCheckInOptions {
    detailLevel?: AttendanceColumnProfile;
    useCache?: boolean;
    rowLimit?: number;
}

interface AttendanceCacheEntry {
    savedAt: number;
    rows: NormalizedAttendanceRow[];
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

const optionalUpdateColumns = [
    'shift',
    'shift_name',
    'timestamp',
    'check_in_time',
    'status',
    'photo_url',
];

const LEGACY_ATTENDANCE_CACHE_PREFIXES = ['hrcheckin_attendance_cache_v1'];
const LEGACY_ATTENDANCE_SELECT_COLUMNS_CACHE_KEYS = [
    'hrcheckin_attendance_select_columns_v2',
    'hrcheckin_attendance_select_columns_v3',
    'hrcheckin_attendance_select_columns_v4',
];
const ATTENDANCE_CACHE_PREFIX = 'hrcheckin_attendance_cache_v2';
const ATTENDANCE_CACHE_TTL_MS_BY_PROFILE: Record<AttendanceColumnProfile, number> = {
    full: 30 * 1000,
    lite: 2 * 60 * 1000,
};
const ATTENDANCE_SELECT_COLUMNS_CACHE_PREFIX = 'hrcheckin_attendance_select_columns_v5';
const ATTENDANCE_DEFAULT_ROW_LIMIT = 10000;
const ATTENDANCE_MAX_RANGE_DAYS = 120;
const ATTENDANCE_NO_TIMESTAMP_MAX_RANGE_DAYS = 3;
const ATTENDANCE_NO_TIMESTAMP_ROW_LIMIT = 1500;
const resolvedAttendanceSelectColumnsByProfile: Record<AttendanceColumnProfile, string[]> = {
    full: [...attendanceSelectColumnsByProfile.full],
    lite: [...attendanceSelectColumnsByProfile.lite],
};
let legacyAttendanceCacheCleared = false;

const selectColumnsCacheKey = (profile: AttendanceColumnProfile): string => {
    return `${ATTENDANCE_SELECT_COLUMNS_CACHE_PREFIX}:${profile}`;
};

const attendanceCacheKey = (filters: AttendanceFilters, profile: AttendanceColumnProfile): string => {
    return [
        ATTENDANCE_CACHE_PREFIX,
        profile,
        filters.from || '*',
        filters.to || '*',
        filters.employeeId || '*',
    ].join(':');
};

const clearLegacyAttendanceCache = (): void => {
    if (legacyAttendanceCacheCleared || typeof localStorage === 'undefined') {
        return;
    }

    const keysToDelete: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key) {
            continue;
        }

        if (LEGACY_ATTENDANCE_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
            keysToDelete.push(key);
        }
    }

    LEGACY_ATTENDANCE_SELECT_COLUMNS_CACHE_KEYS.forEach((key) => {
        if (localStorage.getItem(key)) {
            keysToDelete.push(key);
        }
    });

    keysToDelete.forEach((key) => localStorage.removeItem(key));
    legacyAttendanceCacheCleared = true;
};

const readAttendanceCache = (
    filters: AttendanceFilters,
    profile: AttendanceColumnProfile,
): NormalizedAttendanceRow[] | null => {
    clearLegacyAttendanceCache();
    const ttlMs = ATTENDANCE_CACHE_TTL_MS_BY_PROFILE[profile];
    try {
        const raw = localStorage.getItem(attendanceCacheKey(filters, profile));
        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw) as AttendanceCacheEntry;
        if (!parsed?.savedAt || !Array.isArray(parsed.rows)) {
            return null;
        }

        if (Date.now() - parsed.savedAt > ttlMs) {
            localStorage.removeItem(attendanceCacheKey(filters, profile));
            return null;
        }

        return parsed.rows;
    } catch {
        return null;
    }
};

const readAttendanceSelectColumnsCache = (profile: AttendanceColumnProfile): string[] | null => {
    clearLegacyAttendanceCache();
    try {
        const raw = localStorage.getItem(selectColumnsCacheKey(profile));
        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw) as string[];
        if (!Array.isArray(parsed) || parsed.length === 0) {
            return null;
        }

        return parsed.filter((value): value is string => typeof value === 'string' && value.length > 0);
    } catch {
        return null;
    }
};

const writeAttendanceSelectColumnsCache = (profile: AttendanceColumnProfile, columns: string[]): void => {
    resolvedAttendanceSelectColumnsByProfile[profile] = [...columns];

    try {
        localStorage.setItem(selectColumnsCacheKey(profile), JSON.stringify(columns));
    } catch {
        // Ignore cache write failures. Query will still work with the in-memory list.
    }
};

const writeAttendanceCache = (
    filters: AttendanceFilters,
    profile: AttendanceColumnProfile,
    rows: NormalizedAttendanceRow[],
): void => {
    const entry: AttendanceCacheEntry = {
        savedAt: Date.now(),
        rows,
    };
    try {
        localStorage.setItem(attendanceCacheKey(filters, profile), JSON.stringify(entry));
    } catch {
        // Ignore cache write failures. The live query result is already available.
    }
};

const clearAttendanceCache = (): void => {
    const keysToDelete: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key?.startsWith(ATTENDANCE_CACHE_PREFIX)) {
            keysToDelete.push(key);
        }
    }
    keysToDelete.forEach((key) => localStorage.removeItem(key));
};

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
        photo_url: asText(row.photo_url) || null,
    };
};

const withinFilters = (row: Pick<NormalizedAttendanceRow, 'employee_id' | 'timestamp'>, filters: AttendanceFilters): boolean => {
    if (filters.employeeId && row.employee_id !== filters.employeeId) {
        return false;
    }

    const date = dayKeyBangkok(row.timestamp);
    if (filters.from && date < filters.from) {
        return false;
    }
    if (filters.to && date > filters.to) {
        return false;
    }

    return true;
};

const shiftByNameOrId = (nameOrId: string, shifts: ShiftDefinition[]): ShiftDefinition => {
    const source = shifts.length ? shifts : DEFAULT_SHIFTS;
    const normalized = nameOrId.trim().toLowerCase();
    const byId = source.find((shift) => shift.id.toLowerCase() === normalized);
    if (byId) {
        return byId;
    }

    const byLabel = source.find((shift) => shift.label.toLowerCase() === normalized);
    if (byLabel) {
        return byLabel;
    }

    return source[0];
};

const toSummary = (
    row: Pick<NormalizedAttendanceRow, 'id' | 'employee_id' | 'timestamp' | 'status' | 'shift_name' | 'site_id' | 'photo_url'>,
    shifts: ShiftDefinition[],
    employeeMap: Map<string, AppEmployee>,
    graceMinutes: number,
): AttendanceSummaryRecord => {
    const employee = employeeMap.get(row.employee_id);
    const shift = shiftByNameOrId(row.shift_name || '', shifts);
    const checkInAt = new Date(row.timestamp);
    const lateMinutes = lateMinutesForCheckIn(checkInAt, shift, graceMinutes);
    const status: 'On Time' | 'Late' = lateMinutes > 0 ? 'Late' : 'On Time';

    return {
        id: row.id,
        employeeId: row.employee_id,
        employeeName: employee
            ? `${employee.firstNameTH} ${employee.lastNameTH}${employee.nickname ? ` (${employee.nickname})` : ''}`
            : row.employee_id,
        department: employee?.department || '-',
        role: employee?.role || 'Employee',
        shiftId: shift.id,
        shiftLabel: shift.label,
        checkInAt: row.timestamp,
        estimatedCheckOutAt: estimatedCheckoutAt(checkInAt, shift).toISOString(),
        lateMinutes,
        status,
        source: 'QR',
        kioskId: row.site_id || 'kiosk',
        photoUrl: row.photo_url || '',
    };
};

const dayKeyBangkok = (iso: string): string => {
    return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
};

const shiftDateInputByDays = (dateInput: string, days: number): string => {
    const [yearRaw, monthRaw, dayRaw] = dateInput.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);

    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
        return dateInput;
    }

    const shifted = new Date(Date.UTC(year, month - 1, day + days));
    return shifted.toISOString().slice(0, 10);
};

const dateInputToUtcDate = (dateInput: string): Date => {
    const [yearRaw, monthRaw, dayRaw] = dateInput.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);

    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
        return new Date(Number.NaN);
    }

    return new Date(Date.UTC(year, month - 1, day));
};

const rangeDaysInclusive = (fromDateInput: string, toDateInput: string): number => {
    const fromDate = dateInputToUtcDate(fromDateInput);
    const toDate = dateInputToUtcDate(toDateInput);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
        throw new Error('Invalid date filter.');
    }

    return Math.floor((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
};

const normalizeFilters = (filters: AttendanceFilters): AttendanceFilters => {
    const today = dayKeyBangkok(new Date().toISOString());
    const from = filters.from || filters.to || today;
    const to = filters.to || filters.from || today;

    if (from > to) {
        throw new Error('Invalid date range: from must be on or before to.');
    }

    const days = rangeDaysInclusive(from, to);
    if (days > ATTENDANCE_MAX_RANGE_DAYS) {
        throw new Error(`Date range cannot exceed ${ATTENDANCE_MAX_RANGE_DAYS} days.`);
    }

    return {
        ...filters,
        from,
        to,
    };
};

const bangkokRangeStartIso = (dateInput: string): string => {
    return `${dateInput}T00:00:00${BANGKOK_UTC_OFFSET}`;
};

const bangkokRangeEndExclusiveIso = (dateInput: string): string => {
    return `${shiftDateInputByDays(dateInput, 1)}T00:00:00${BANGKOK_UTC_OFFSET}`;
};

const hasDuplicateOnDay = (
    rows: Array<Pick<NormalizedAttendanceRow, 'employee_id' | 'timestamp' | 'type'>>,
    employeeId: string,
    checkInAtIso: string,
): boolean => {
    const targetDay = dayKeyBangkok(checkInAtIso);
    return rows.some((row) => {
        if (row.employee_id !== employeeId || row.type !== 'check_in') {
            return false;
        }
        return dayKeyBangkok(row.timestamp) === targetDay;
    });
};

const shouldRetryWithoutTimestampFilter = (message: string): boolean => {
    const normalized = message.toLowerCase();
    return normalized.includes('timestamp') && normalized.includes('column');
};

const canUseNoTimestampFallback = (filters: AttendanceFilters): boolean => {
    if (!filters.employeeId || !filters.from || !filters.to) {
        return false;
    }

    const days = rangeDaysInclusive(filters.from, filters.to);
    return days <= ATTENDANCE_NO_TIMESTAMP_MAX_RANGE_DAYS;
};

const removeMissingSelectColumn = (
    columns: string[],
    message: string,
): { nextColumns: string[]; removedAny: boolean } => {
    const discoveredColumn = extractMissingColumn(message);
    if (!discoveredColumn || !columns.includes(discoveredColumn)) {
        return { nextColumns: columns, removedAny: false };
    }

    return {
        nextColumns: columns.filter((column) => column !== discoveredColumn),
        removedAny: true,
    };
};

const loadRowsFromSupabase = async (
    filters: AttendanceFilters,
    options: AttendanceLoadOptions = {},
): Promise<NormalizedAttendanceRow[]> => {
    const useCache = options.useCache ?? true;
    const rowLimit = Math.max(1, Math.min(options.rowLimit ?? ATTENDANCE_DEFAULT_ROW_LIMIT, ATTENDANCE_DEFAULT_ROW_LIMIT));
    const profile = options.profile ?? 'full';
    const normalizedFilters = normalizeFilters(filters);
    const defaultSelectColumns = attendanceSelectColumnsByProfile[profile];
    const cachedSelectColumns = readAttendanceSelectColumnsCache(profile);
    if (cachedSelectColumns?.length) {
        resolvedAttendanceSelectColumnsByProfile[profile] = cachedSelectColumns;
    }

    if (useCache) {
        const cached = readAttendanceCache(normalizedFilters, profile);
        if (cached) {
            return cached;
        }
    }

    let rows: AttendanceRow[] = [];
    let selectColumns = [...resolvedAttendanceSelectColumnsByProfile[profile]];
    let withTimestampFilter = true;

    const queryRows = async (withTimestampFilter: boolean): Promise<AttendanceRow[]> => {
        const queryRowLimit = withTimestampFilter
            ? rowLimit
            : Math.min(rowLimit, ATTENDANCE_NO_TIMESTAMP_ROW_LIMIT);
        let query = supabase
            .from(tableName)
            .select(selectColumns.join(', '))
            .limit(queryRowLimit);

        if (withTimestampFilter) {
            query = query.order('timestamp', { ascending: false });
        }

        if (normalizedFilters.employeeId) {
            query = query.eq('employee_id', normalizedFilters.employeeId);
        }

        // Filter check_in only at the database level to reduce bandwidth
        // Use .or to ensure we don't accidentally filter out legacy rows where type is null
        if (selectColumns.includes('type')) {
            query = query.or('type.neq.check_out,type.is.null');
        }

        if (withTimestampFilter && normalizedFilters.from) {
            query = query.gte('timestamp', bangkokRangeStartIso(normalizedFilters.from));
        }

        if (withTimestampFilter && normalizedFilters.to) {
            query = query.lt('timestamp', bangkokRangeEndExclusiveIso(normalizedFilters.to));
        }

        const { data, error } = await withReadRetry(async () => {
            return await query;
        });
        if (error) {
            throw error;
        }

        return (data as AttendanceRow[]) || [];
    };

    for (let attempt = 0; attempt < defaultSelectColumns.length + 2; attempt += 1) {
        try {
            rows = await queryRows(withTimestampFilter);
            writeAttendanceSelectColumnsCache(profile, selectColumns);
            break;
        } catch (error) {
            const message = getErrorMessage(error);
            const selectFallback = removeMissingSelectColumn(selectColumns, message);

            if (selectFallback.removedAny && selectFallback.nextColumns.length > 0) {
                selectColumns = selectFallback.nextColumns;
                continue;
            }

            if (withTimestampFilter && shouldRetryWithoutTimestampFilter(message)) {
                if (!canUseNoTimestampFallback(normalizedFilters)) {
                    throw new Error(
                        `Missing timestamp column. Fallback is restricted to employee-specific ranges up to ${ATTENDANCE_NO_TIMESTAMP_MAX_RANGE_DAYS} days to limit egress.`,
                    );
                }
                withTimestampFilter = false;
                continue;
            }

            throw error;
        }
    }

    const normalizedRows = rows
        .map(normalizeAttendanceRow)
        .filter((row) => row.employee_id)
        // check_out rows are filtered at DB level; this is a safety net for legacy data
        .filter((row) => row.type !== 'check_out')
        .filter((row) => withinFilters(row, normalizedFilters))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (useCache) {
        writeAttendanceCache(normalizedFilters, profile, normalizedRows);
    }

    return normalizedRows;
};

const extractMissingColumn = (message: string): string | null => {
    const match = message.toLowerCase().match(/['"`]([a-z0-9_]+)['"`]\s+column/);
    if (match?.[1]) {
        return match[1];
    }

    const fallback = message.toLowerCase().match(/column\s+(?:[a-z0-9_]+\.)?['"`]?([a-z0-9_]+)['"`]?/);
    return fallback?.[1] || null;
};

const removeColumnsByMessage = (
    source: Record<string, string | number>,
    message: string,
    removableColumns = optionalInsertColumns,
): { nextPayload: Record<string, string | number>; removedAny: boolean } => {
    const normalized = message.toLowerCase();
    const nextPayload: Record<string, string | number> = { ...source };
    let removedAny = false;

    removableColumns.forEach((column) => {
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
        || normalized.includes('ux_attendance_checkin_per_shift_day')
        || normalized.includes('ux_attendance_checkin_per_day');
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

    throw new Error(lastMessage || saveFailedMessage);
};

const updateWithLegacyPayloadFallback = async (
    recordId: string,
    updates: Record<string, string | number>,
): Promise<void> => {
    let workingPayload = { ...updates };
    let lastMessage = '';

    for (let attempt = 0; attempt < 8; attempt += 1) {
        const { error } = await supabase
            .from(tableName)
            .update(workingPayload)
            .eq('id', recordId);

        if (!error) {
            return;
        }

        lastMessage = error.message;
        const { nextPayload, removedAny } = removeColumnsByMessage(workingPayload, error.message, optionalUpdateColumns);
        if (!removedAny) {
            throw error;
        }

        workingPayload = nextPayload;
    }

    throw new Error(lastMessage || 'Unable to update check-in.');
};

export const appAttendanceService = {
    async recordCheckIn(
        employee: AppEmployee,
        selectedShift: ShiftDefinition,
        kioskId: string,
        graceMinutes: number,
        checkInPhotoUrl = '',
    ): Promise<AttendanceSummaryRecord> {
        const now = new Date();
        const nowIso = now.toISOString();
        const todayKey = dayKeyBangkok(nowIso);
        const lateMinutes = lateMinutesForCheckIn(now, selectedShift, graceMinutes);
        const status: 'On Time' | 'Late' = lateMinutes > 0 ? 'Late' : 'On Time';

        const existingRows = await loadRowsFromSupabase(
            { employeeId: employee.id, from: todayKey, to: todayKey },
            { useCache: false, rowLimit: 50, profile: 'lite' },
        ).catch(() => null);
        if (existingRows && hasDuplicateOnDay(existingRows, employee.id, nowIso)) {
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
            photo_url: checkInPhotoUrl || '',
            status,
            shift_name: selectedShift.id,
            shift: selectedShift.id,
        };

        try {
            await insertWithLegacyPayloadFallback(payload);
        } catch (error) {
            const message = getErrorMessage(error);
            if (message === duplicateCheckInMessage || isDuplicateInsertError(message)) {
                throw new Error(duplicateCheckInMessage);
            }
            throw new Error(saveFailedMessage);
        }

        clearAttendanceCache();

        const remoteRow: NormalizedAttendanceRow = {
            id: `REMOTE-${Date.now()}`,
            employee_id: employee.id,
            timestamp: nowIso,
            status,
            shift_name: selectedShift.id,
            site_id: kioskId,
            type: 'check_in',
            photo_url: checkInPhotoUrl || '',
        };

        return toSummary(remoteRow, [selectedShift], new Map([[employee.id, employee]]), graceMinutes);
    },

    async listCheckIns(
        shifts: ShiftDefinition[],
        employees: AppEmployee[],
        graceMinutes: number,
        filters: AttendanceFilters = {},
        options: ListCheckInOptions = {},
    ): Promise<AttendanceSummaryRecord[]> {
        const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));
        try {
            const remoteRows = await loadRowsFromSupabase(filters, {
                useCache: options.useCache,
                rowLimit: options.rowLimit,
                profile: options.detailLevel || 'full',
            });
            return remoteRows.map((row) => toSummary(row, shifts, employeeMap, graceMinutes));
        } catch (error) {
            const message = getErrorMessage(error);
            if (isTransportError(message)) {
                throw new Error(readFailedMessage);
            }
            throw new Error(message || saveFailedMessage);
        }
    },

    async deleteCheckIn(recordId: string): Promise<void> {
        const { error } = await supabase
            .from(tableName)
            .delete()
            .eq('id', recordId);

        if (error) {
            throw new Error(error.message);
        }

        clearAttendanceCache();

        await auditLogService.record({
            action: 'attendance.deleted',
            entityType: 'attendance',
            entityId: recordId,
            summary: `Deleted attendance record ${recordId}.`,
        });
    },

    async deleteCheckIns(recordIds: string[]): Promise<void> {
        if (!recordIds || recordIds.length === 0) {
            return;
        }

        const { error } = await supabase
            .from(tableName)
            .delete()
            .in('id', recordIds);

        if (error) {
            throw new Error(error.message);
        }

        clearAttendanceCache();

        await auditLogService.record({
            action: 'attendance.bulk_deleted',
            entityType: 'attendance',
            entityId: `${recordIds.length}-records`,
            summary: `Deleted ${recordIds.length} attendance records.`,
            details: {
                count: recordIds.length,
                recordIds: recordIds.slice(0, 50),
            },
        });
    },

    async updateCheckIn(recordId: string, updates: { shift_name?: string; timestamp?: string; status?: string; photo_url?: string }): Promise<void> {
        const payload: Record<string, string | number> = {};

        if (updates.shift_name) {
            payload.shift_name = updates.shift_name;
            payload.shift = updates.shift_name;
        }
        if (updates.timestamp) {
            payload.timestamp = updates.timestamp;
            payload.check_in_time = updates.timestamp;
        }
        if (updates.status) {
            payload.status = updates.status;
        }
        if (updates.photo_url) {
            payload.photo_url = updates.photo_url;
        }

        await updateWithLegacyPayloadFallback(recordId, payload);
        clearAttendanceCache();

        await auditLogService.record({
            action: 'attendance.updated',
            entityType: 'attendance',
            entityId: recordId,
            summary: `Updated attendance record ${recordId}.`,
            details: payload,
        });
    },
};
