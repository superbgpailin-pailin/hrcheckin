import { supabase } from '../lib/supabaseClient';
import { DEFAULT_CONFIG, DEFAULT_EMPLOYEE_FIELD_OPTIONS, DEFAULT_LATE_RULES } from '../data/appDefaults';
import type { AppSystemConfig } from '../types/app';
import { getErrorMessage, isSchemaMissingError, withReadRetry } from '../utils/supabaseUtils';

const tableName = 'settings';
const settingsId = 'checkin_v2';
let settingsTableUnavailable = false;
export const MIN_QR_REFRESH_LEAD_SECONDS = 2;
export const MIN_QR_TOKEN_VALIDITY_BUFFER_SECONDS = 10;

interface SettingsRow {
    config: AppSystemConfig;
}

const normalizeNullableNumber = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return null;
    }

    return Math.max(0, Math.floor(parsed));
};

const normalizePositiveWholeNumber = (value: unknown, fallback: number): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    return Math.max(1, Math.floor(parsed));
};

export const clampQrRefreshSeconds = (refreshSeconds: number, lifetimeSeconds: number): number => {
    const safeLifetime = Math.max(1, Math.floor(lifetimeSeconds));
    const maxRefresh = safeLifetime > MIN_QR_REFRESH_LEAD_SECONDS
        ? safeLifetime - MIN_QR_REFRESH_LEAD_SECONDS
        : safeLifetime;

    return Math.min(Math.max(1, Math.floor(refreshSeconds)), maxRefresh);
};

export const minimumQrTokenLifetimeSeconds = (refreshSeconds: number): number => {
    return Math.max(1, Math.floor(refreshSeconds)) + MIN_QR_TOKEN_VALIDITY_BUFFER_SECONDS;
};

const cloneDefaultShifts = (): AppSystemConfig['shifts'] => {
    return DEFAULT_CONFIG.shifts.map((shift) => ({ ...shift }));
};

const cloneDefaultLateRules = (): AppSystemConfig['lateRules'] => {
    return DEFAULT_LATE_RULES.map((rule) => ({ ...rule }));
};

const cloneDefaultEmployeeFieldOptions = (): AppSystemConfig['employeeFieldOptions'] => {
    return {
        departments: [...DEFAULT_EMPLOYEE_FIELD_OPTIONS.departments],
        positions: [...DEFAULT_EMPLOYEE_FIELD_OPTIONS.positions],
        roles: [...DEFAULT_EMPLOYEE_FIELD_OPTIONS.roles],
        statuses: [...DEFAULT_EMPLOYEE_FIELD_OPTIONS.statuses],
    };
};

const normalizeOptionValues = (values: unknown, fallback: string[]): string[] => {
    if (!Array.isArray(values)) {
        return [...fallback];
    }

    const seen = new Set<string>();
    const normalized = values
        .map((value) => String(value || '').trim())
        .filter((value) => {
            if (!value) {
                return false;
            }
            const key = value.toLowerCase();
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });

    return normalized.length > 0 ? normalized : [...fallback];
};

const normalizeEmployeeFieldOptions = (
    options?: Partial<AppSystemConfig['employeeFieldOptions']>,
): AppSystemConfig['employeeFieldOptions'] => {
    const defaults = cloneDefaultEmployeeFieldOptions();
    return {
        departments: normalizeOptionValues(options?.departments, defaults.departments),
        positions: normalizeOptionValues(options?.positions, defaults.positions),
        roles: normalizeOptionValues(options?.roles, defaults.roles),
        statuses: normalizeOptionValues(options?.statuses, defaults.statuses),
    };
};

const normalizeLateRules = (rules?: AppSystemConfig['lateRules']): AppSystemConfig['lateRules'] => {
    if (!rules?.length) {
        return cloneDefaultLateRules();
    }

    return rules
        .map((rule, index) => {
            const minMinutes = Math.max(0, Math.floor(Number(rule.minMinutes) || 0));
            const parsedMax = normalizeNullableNumber(rule.maxMinutes);
            const maxMinutes = parsedMax === null ? null : Math.max(minMinutes, parsedMax);
            const monthlyAccumulatedMinutesThreshold = normalizeNullableNumber(rule.monthlyAccumulatedMinutesThreshold);
            const monthlyAccumulatedDeduction = normalizeNullableNumber(rule.monthlyAccumulatedDeduction);

            return {
                id: rule.id || `late-rule-${index + 1}`,
                label: rule.label?.trim() || `Rule ${index + 1}`,
                minMinutes,
                maxMinutes,
                deductionAmount: Math.max(0, Math.floor(Number(rule.deductionAmount) || 0)),
                monthlyAccumulatedMinutesThreshold,
                monthlyAccumulatedDeduction: monthlyAccumulatedMinutesThreshold === null
                    ? null
                    : Math.max(0, monthlyAccumulatedDeduction || 0),
            };
        })
        .sort((a, b) => a.minMinutes - b.minMinutes);
};

export const normalizeAppSystemConfig = (input?: Partial<AppSystemConfig>): AppSystemConfig => {
    const requestedRefreshSeconds = normalizePositiveWholeNumber(
        input?.qrRefreshSeconds,
        DEFAULT_CONFIG.qrRefreshSeconds,
    );
    const qrTokenLifetimeSeconds = Math.max(
        normalizePositiveWholeNumber(input?.qrTokenLifetimeSeconds, DEFAULT_CONFIG.qrTokenLifetimeSeconds),
        minimumQrTokenLifetimeSeconds(requestedRefreshSeconds),
    );
    const qrRefreshSeconds = clampQrRefreshSeconds(requestedRefreshSeconds, qrTokenLifetimeSeconds);

    if (!input) {
        return {
            ...DEFAULT_CONFIG,
            qrTokenLifetimeSeconds,
            qrRefreshSeconds,
            shifts: cloneDefaultShifts(),
            lateRules: cloneDefaultLateRules(),
            controlShiftPolicy: {
                ...DEFAULT_CONFIG.controlShiftPolicy,
                overrides: { ...DEFAULT_CONFIG.controlShiftPolicy.overrides },
            },
            employeeFieldOptions: cloneDefaultEmployeeFieldOptions(),
        };
    }

    return {
        ...DEFAULT_CONFIG,
        ...input,
        qrTokenLifetimeSeconds,
        qrRefreshSeconds,
        lateRules: normalizeLateRules(input.lateRules),
        controlShiftPolicy: {
            ...DEFAULT_CONFIG.controlShiftPolicy,
            ...input.controlShiftPolicy,
            overrides: {
                ...DEFAULT_CONFIG.controlShiftPolicy.overrides,
                ...(input.controlShiftPolicy?.overrides || {}),
            },
        },
        shifts: input.shifts?.length
            ? input.shifts.map((shift) => ({ ...shift }))
            : cloneDefaultShifts(),
        employeeFieldOptions: normalizeEmployeeFieldOptions(input.employeeFieldOptions),
    };
};

export const appSettingsService = {
    async getSettings(): Promise<AppSystemConfig> {
        if (settingsTableUnavailable) {
            return normalizeAppSystemConfig();
        }

        try {
            const { data, error } = await withReadRetry(async () => {
                return await supabase
                    .from(tableName)
                    .select('config')
                    .eq('id', settingsId)
                    .limit(1);
            });

            if (error) {
                throw error;
            }

            const rows = (data as SettingsRow[] | null) || [];
            if (!rows.length) {
                return normalizeAppSystemConfig();
            }

            return normalizeAppSystemConfig(rows[0].config);
        } catch (fetchError) {
            const message = getErrorMessage(fetchError);
            if (isSchemaMissingError(message)) {
                settingsTableUnavailable = true;
            }
            return normalizeAppSystemConfig();
        }
    },

    async saveSettings(config: AppSystemConfig): Promise<void> {
        if (settingsTableUnavailable) {
            return;
        }

        const merged = normalizeAppSystemConfig(config);
        const { error } = await supabase
            .from(tableName)
            .upsert({ id: settingsId, config: merged });

        if (error) {
            if (isSchemaMissingError(error.message)) {
                settingsTableUnavailable = true;
                return;
            }
            throw new Error(error.message);
        }
    },
};
