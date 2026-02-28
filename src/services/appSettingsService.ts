import { supabase } from '../lib/supabaseClient';
import { DEFAULT_CONFIG, DEFAULT_EMPLOYEE_FIELD_OPTIONS, DEFAULT_LATE_RULES } from '../data/appDefaults';
import type { AppSystemConfig } from '../types/app';

const tableName = 'settings';
const settingsId = 'checkin_v2';
const READ_TIMEOUT_MS = 8000;
const READ_RETRY_COUNT = 1;
let settingsTableUnavailable = false;

interface SettingsRow {
    config: AppSystemConfig;
}

const isSchemaMissingError = (message: string): boolean => {
    const normalized = message.toLowerCase();
    return normalized.includes('could not find the table')
        || normalized.includes('schema cache')
        || normalized.includes('does not exist');
};

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }
    if (
        typeof error === 'object'
        && error !== null
        && 'message' in error
        && typeof (error as { message?: unknown }).message === 'string'
    ) {
        return (error as { message: string }).message;
    }
    return String(error || '');
};

const isTransportError = (message: string): boolean => {
    const normalized = message.trim().toLowerCase();
    return normalized === 'failed to fetch'
        || normalized.includes('fetch')
        || normalized.includes('timeout')
        || normalized.includes('connection timed out')
        || normalized.includes('connection terminated')
        || normalized.includes('status 522')
        || normalized.includes('error code 522');
};

const withReadRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= READ_RETRY_COUNT; attempt += 1) {
        try {
            return await Promise.race<T>([
                operation(),
                new Promise<T>((_, reject) => {
                    globalThis.setTimeout(() => reject(new Error('Settings request timeout')), READ_TIMEOUT_MS);
                }),
            ]);
        } catch (error) {
            lastError = error;
            const message = getErrorMessage(error);
            if (!isTransportError(message) || attempt >= READ_RETRY_COUNT) {
                throw error;
            }
            await new Promise<void>((resolve) => {
                globalThis.setTimeout(resolve, 350 * (attempt + 1));
            });
        }
    }

    throw lastError instanceof Error ? lastError : new Error('Settings request timeout');
};

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

const mergeConfig = (input?: Partial<AppSystemConfig>): AppSystemConfig => {
    if (!input) {
        return {
            ...DEFAULT_CONFIG,
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
            return mergeConfig();
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
                return mergeConfig();
            }

            return mergeConfig(rows[0].config);
        } catch (fetchError) {
            const message = getErrorMessage(fetchError);
            if (isSchemaMissingError(message)) {
                settingsTableUnavailable = true;
            }
            return mergeConfig();
        }
    },

    async saveSettings(config: AppSystemConfig): Promise<void> {
        if (settingsTableUnavailable) {
            return;
        }

        const merged = mergeConfig(config);
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