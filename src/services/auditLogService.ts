import { supabase } from '../lib/supabaseClient';
import type { AuditLogEntry } from '../types/app';
import { getErrorMessage, isSchemaMissingError } from '../utils/supabaseUtils';

const AUDIT_LOGS_TABLE = 'audit_logs';
const PORTAL_USER_STORAGE_KEY = 'hrcheckin_portal_user_v3';
const PORTAL_ACCOUNTS_STORAGE_KEY = 'hrcheckin_portal_accounts_v4';

type AuditActorType = 'portal_admin' | 'employee' | 'system';
type AuditActorSource = 'portal' | 'self-service' | 'system';

interface PortalAccountCacheRow {
    username?: string;
    displayName?: string;
    role?: string;
}

interface AuditLogRow {
    id: string;
    actor_type: string | null;
    actor_id: string | null;
    actor_name: string | null;
    actor_role: string | null;
    actor_source: string | null;
    action: string | null;
    entity_type: string | null;
    entity_id: string | null;
    summary: string | null;
    details: Record<string, unknown> | null;
    created_at: string | null;
}

export interface AuditActorOverride {
    type?: AuditActorType;
    id: string;
    name?: string;
    role?: string;
    source?: AuditActorSource;
}

export interface AuditLogInput {
    action: string;
    entityType: string;
    entityId: string;
    summary: string;
    details?: Record<string, unknown>;
    actor?: AuditActorOverride;
}

let auditLogsTableUnavailable = false;

const sanitizeText = (value: unknown): string => String(value || '').trim();

const readStoredPortalAccounts = (): PortalAccountCacheRow[] => {
    if (typeof localStorage === 'undefined') {
        return [];
    }

    try {
        const raw = localStorage.getItem(PORTAL_ACCOUNTS_STORAGE_KEY);
        if (!raw) {
            return [];
        }

        const parsed = JSON.parse(raw) as unknown;
        return Array.isArray(parsed) ? (parsed as PortalAccountCacheRow[]) : [];
    } catch {
        return [];
    }
};

const resolvePortalActor = (): AuditActorOverride | null => {
    if (typeof localStorage === 'undefined') {
        return null;
    }

    const username = sanitizeText(localStorage.getItem(PORTAL_USER_STORAGE_KEY)).toLowerCase();
    if (!username) {
        return null;
    }

    const matchingAccount = readStoredPortalAccounts().find((account) => {
        return sanitizeText(account.username).toLowerCase() === username;
    });

    return {
        type: 'portal_admin',
        id: username,
        name: sanitizeText(matchingAccount?.displayName) || username,
        role: sanitizeText(matchingAccount?.role) || 'Admin',
        source: 'portal',
    };
};

const resolveActor = (override?: AuditActorOverride): Required<AuditActorOverride> => {
    const merged = override && sanitizeText(override.id)
        ? override
        : resolvePortalActor();

    if (merged && sanitizeText(merged.id)) {
        const actorId = sanitizeText(merged.id);
        return {
            type: merged.type || 'portal_admin',
            id: actorId,
            name: sanitizeText(merged.name) || actorId,
            role: sanitizeText(merged.role),
            source: merged.source || 'portal',
        };
    }

    return {
        type: 'system',
        id: 'unknown',
        name: 'Unknown',
        role: '',
        source: 'system',
    };
};

const toAuditLogEntry = (row: AuditLogRow): AuditLogEntry => {
    return {
        id: row.id,
        createdAt: sanitizeText(row.created_at),
        actorType: sanitizeText(row.actor_type) || 'system',
        actorId: sanitizeText(row.actor_id) || 'unknown',
        actorName: sanitizeText(row.actor_name) || sanitizeText(row.actor_id) || 'Unknown',
        actorRole: sanitizeText(row.actor_role),
        actorSource: sanitizeText(row.actor_source) || 'system',
        action: sanitizeText(row.action),
        entityType: sanitizeText(row.entity_type),
        entityId: sanitizeText(row.entity_id),
        summary: sanitizeText(row.summary),
        details: row.details || {},
    };
};

export const auditLogService = {
    async record(input: AuditLogInput): Promise<void> {
        if (auditLogsTableUnavailable) {
            return;
        }

        const actor = resolveActor(input.actor);
        const payload = {
            actor_type: actor.type,
            actor_id: actor.id,
            actor_name: actor.name || actor.id,
            actor_role: actor.role || null,
            actor_source: actor.source,
            action: sanitizeText(input.action),
            entity_type: sanitizeText(input.entityType),
            entity_id: sanitizeText(input.entityId),
            summary: sanitizeText(input.summary),
            details: input.details || {},
        };

        try {
            const { error } = await supabase.from(AUDIT_LOGS_TABLE).insert([payload]);
            if (error) {
                throw error;
            }
        } catch (error) {
            const message = getErrorMessage(error);
            if (isSchemaMissingError(message)) {
                auditLogsTableUnavailable = true;
                return;
            }

            console.warn('Failed to write audit log:', message);
        }
    },

    async listRecent(limit = 100): Promise<AuditLogEntry[]> {
        if (auditLogsTableUnavailable) {
            return [];
        }

        try {
            const { data, error } = await supabase
                .from(AUDIT_LOGS_TABLE)
                .select('id, actor_type, actor_id, actor_name, actor_role, actor_source, action, entity_type, entity_id, summary, details, created_at')
                .order('created_at', { ascending: false })
                .limit(Math.max(1, Math.min(limit, 200)));

            if (error) {
                throw error;
            }

            return ((data as AuditLogRow[]) || []).map(toAuditLogEntry);
        } catch (error) {
            const message = getErrorMessage(error);
            if (isSchemaMissingError(message)) {
                auditLogsTableUnavailable = true;
                return [];
            }

            throw new Error(message || 'Unable to load audit logs.');
        }
    },
};
