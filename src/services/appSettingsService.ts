import { supabase } from '../lib/supabaseClient';
import { DEFAULT_CONFIG } from '../data/appDefaults';
import type { AppSystemConfig } from '../types/app';

const tableName = 'settings';
const settingsId = 'checkin_v2';
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

const mergeConfig = (input?: Partial<AppSystemConfig>): AppSystemConfig => {
    if (!input) {
        return DEFAULT_CONFIG;
    }

    return {
        ...DEFAULT_CONFIG,
        ...input,
        controlShiftPolicy: {
            ...DEFAULT_CONFIG.controlShiftPolicy,
            ...input.controlShiftPolicy,
            overrides: {
                ...DEFAULT_CONFIG.controlShiftPolicy.overrides,
                ...(input.controlShiftPolicy?.overrides || {}),
            },
        },
        shifts: input.shifts?.length ? input.shifts : DEFAULT_CONFIG.shifts,
    };
};

export const appSettingsService = {
    async getSettings(): Promise<AppSystemConfig> {
        if (settingsTableUnavailable) {
            return DEFAULT_CONFIG;
        }

        try {
            const { data, error } = await supabase
                .from(tableName)
                .select('config')
                .eq('id', settingsId)
                .limit(1);

            if (error) {
                throw error;
            }

            const rows = (data as SettingsRow[] | null) || [];
            if (!rows.length) {
                return DEFAULT_CONFIG;
            }

            return mergeConfig(rows[0].config);
        } catch (fetchError) {
            const message = fetchError instanceof Error ? fetchError.message : String(fetchError || '');
            if (isSchemaMissingError(message)) {
                settingsTableUnavailable = true;
            }
            return DEFAULT_CONFIG;
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
