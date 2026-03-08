import { createClient } from '@supabase/supabase-js';

const SETTINGS_TABLE = 'settings';
const SETTINGS_ID = 'checkin_v2';
const ATTENDANCE_TABLE = 'attendance';
const LOG_TABLE = 'telegram_checkin_summary_logs';
const BANGKOK_TIMEZONE = 'Asia/Bangkok';
const BANGKOK_UTC_OFFSET = '+07:00';
const SEND_WINDOW_MINUTES = 1;
const TELEGRAM_HTTP_TIMEOUT_MS = 8000;

interface TelegramCheckInRound {
    id: string;
    label: string;
    startTime: string;
    endTime: string;
    sendTime: string;
    enabled: boolean;
}

interface TelegramCheckInSummaryConfig {
    enabled: boolean;
    rounds: TelegramCheckInRound[];
}

interface SettingsPayload {
    companyName?: string;
    telegramCheckInSummary?: Partial<TelegramCheckInSummaryConfig>;
}

const toMinutes = (timeInput: string): number | null => {
    const match = String(timeInput || '').trim().match(/^(\d{2}):(\d{2})$/);
    if (!match) {
        return null;
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (
        !Number.isFinite(hours)
        || !Number.isFinite(minutes)
        || hours < 0
        || hours > 23
        || minutes < 0
        || minutes > 59
    ) {
        return null;
    }

    return (hours * 60) + minutes;
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

const bangkokNow = (): { dateInput: string; timeInput: string; minutes: number } => {
    const now = new Date();
    const dateInput = now.toLocaleDateString('en-CA', { timeZone: BANGKOK_TIMEZONE });
    const timeInput = now.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: BANGKOK_TIMEZONE,
    });

    return {
        dateInput,
        timeInput,
        minutes: toMinutes(timeInput) || 0,
    };
};

const shouldSendNow = (nowMinutes: number, sendMinutes: number): boolean => {
    return Math.abs(nowMinutes - sendMinutes) <= SEND_WINDOW_MINUTES;
};

const buildRange = (
    dateInput: string,
    startTime: string,
    endTime: string,
    nowMinutes: number,
): { rangeDate: string; startIso: string; endIso: string } | null => {
    const startMinutes = toMinutes(startTime);
    const endMinutes = toMinutes(endTime);
    if (startMinutes === null || endMinutes === null) {
        return null;
    }

    let startDate = dateInput;
    let endDate = dateInput;
    if (endMinutes <= startMinutes) {
        const usePreviousStartDate = nowMinutes <= endMinutes;
        startDate = usePreviousStartDate ? shiftDateInputByDays(dateInput, -1) : dateInput;
        endDate = shiftDateInputByDays(startDate, 1);
    }

    return {
        rangeDate: startDate,
        startIso: `${startDate}T${startTime}:00${BANGKOK_UTC_OFFSET}`,
        endIso: `${endDate}T${endTime}:00${BANGKOK_UTC_OFFSET}`,
    };
};

const normalizeSummaryConfig = (input?: Partial<TelegramCheckInSummaryConfig>): TelegramCheckInSummaryConfig => {
    if (!input?.rounds?.length) {
        return {
            enabled: false,
            rounds: [],
        };
    }

    return {
        enabled: Boolean(input.enabled),
        rounds: input.rounds
            .map((round) => ({
                id: String(round.id || ''),
                label: String(round.label || ''),
                startTime: String(round.startTime || ''),
                endTime: String(round.endTime || ''),
                sendTime: String(round.sendTime || ''),
                enabled: Boolean(round.enabled),
            }))
            .filter((round) => round.id && round.startTime && round.endTime && round.sendTime),
    };
};

const sendTelegramMessage = async (
    botToken: string,
    chatId: string,
    text: string,
): Promise<void> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TELEGRAM_HTTP_TIMEOUT_MS);
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chat_id: chatId,
            text,
        }),
        signal: controller.signal,
    }).finally(() => {
        clearTimeout(timeout);
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Telegram API error (${response.status}): ${body}`);
    }
};

const isDuplicateLogError = (message: string, code?: string): boolean => {
    const normalized = String(message || '').toLowerCase();
    return code === '23505'
        || normalized.includes('duplicate key')
        || normalized.includes('ux_telegram_checkin_summary_logs_date_round');
};

export default async function handler(
    req: { method?: string; headers?: Record<string, string | string[] | undefined> },
    res: { status: (code: number) => { json: (payload: unknown) => void } },
): Promise<void> {
    if (req.method !== 'POST') {
        res.status(405).json({ ok: false, message: 'Method not allowed' });
        return;
    }

    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        res.status(500).json({ ok: false, message: 'CRON_SECRET is required' });
        return;
    }

    const authHeaderRaw = req.headers?.authorization || req.headers?.Authorization;
    const authHeader = Array.isArray(authHeaderRaw) ? authHeaderRaw[0] : authHeaderRaw;
    if (authHeader !== `Bearer ${cronSecret}`) {
        res.status(401).json({ ok: false, message: 'Unauthorized' });
        return;
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;

    if (!supabaseUrl || !serviceRoleKey || !telegramBotToken || !telegramChatId) {
        res.status(500).json({
            ok: false,
            message: 'Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID',
        });
        return;
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
    });

    const now = bangkokNow();
    const sent: Array<{ roundId: string; count: number }> = [];
    const skipped: Array<{ roundId: string; reason: string }> = [];

    const settingsResult = await supabase
        .from(SETTINGS_TABLE)
        .select('config')
        .eq('id', SETTINGS_ID)
        .limit(1)
        .maybeSingle();

    if (settingsResult.error) {
        res.status(500).json({ ok: false, message: settingsResult.error.message });
        return;
    }

    const payload = (settingsResult.data?.config || {}) as SettingsPayload;
    const summaryConfig = normalizeSummaryConfig(payload.telegramCheckInSummary);
    if (!summaryConfig.enabled || summaryConfig.rounds.length === 0) {
        res.status(200).json({
            ok: true,
            message: 'Telegram summary is disabled',
            now,
        });
        return;
    }

    for (const round of summaryConfig.rounds) {
        if (!round.enabled) {
            skipped.push({ roundId: round.id, reason: 'round_disabled' });
            continue;
        }

        const sendMinutes = toMinutes(round.sendTime);
        if (sendMinutes === null || !shouldSendNow(now.minutes, sendMinutes)) {
            skipped.push({ roundId: round.id, reason: 'outside_send_window' });
            continue;
        }

        const range = buildRange(now.dateInput, round.startTime, round.endTime, now.minutes);
        if (!range) {
            skipped.push({ roundId: round.id, reason: 'invalid_time_range' });
            continue;
        }

        const claimLog = await supabase
            .from(LOG_TABLE)
            .insert([{
                sent_date: range.rangeDate,
                round_id: round.id,
                round_label: round.label,
                start_time: round.startTime,
                end_time: round.endTime,
                send_time: round.sendTime,
                checkin_count: 0,
                telegram_chat_id: '',
                message_text: 'PENDING',
            }])
            .select('id')
            .limit(1)
            .maybeSingle();

        if (claimLog.error) {
            if (isDuplicateLogError(claimLog.error.message, claimLog.error.code)) {
                skipped.push({ roundId: round.id, reason: 'already_sent' });
                continue;
            }
            skipped.push({ roundId: round.id, reason: claimLog.error.message });
            continue;
        }

        const claimLogId = claimLog.data?.id;
        if (!claimLogId) {
            skipped.push({ roundId: round.id, reason: 'log_claim_missing_id' });
            continue;
        }

        let countQuery = supabase
            .from(ATTENDANCE_TABLE)
            .select('id', { count: 'exact', head: true })
            .gte('timestamp', range.startIso)
            .lt('timestamp', range.endIso);

        countQuery = countQuery.or('type.eq.check_in,type.is.null');

        const countResult = await countQuery;
        if (countResult.error) {
            await supabase.from(LOG_TABLE).delete().eq('id', claimLogId);
            skipped.push({ roundId: round.id, reason: countResult.error.message });
            continue;
        }

        const checkInCount = countResult.count || 0;
        const dateLabel = new Date(`${range.rangeDate}T00:00:00${BANGKOK_UTC_OFFSET}`).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: BANGKOK_TIMEZONE,
        });

        const message = [
            `${payload.companyName || 'HR CheckIn'} - สรุปเช็กอิน`,
            `รอบ: ${round.label}`,
            `ช่วงเวลา: ${round.startTime}-${round.endTime}`,
            `วันที่: ${dateLabel}`,
            `จำนวนคนเช็กอิน: ${checkInCount} คน`,
        ].join('\n');

        try {
            await sendTelegramMessage(telegramBotToken, telegramChatId, message);
        } catch (error) {
            await supabase.from(LOG_TABLE).delete().eq('id', claimLogId);
            skipped.push({
                roundId: round.id,
                reason: error instanceof Error ? error.message : 'telegram_send_failed',
            });
            continue;
        }

        const updateLog = await supabase
            .from(LOG_TABLE)
            .update({
                checkin_count: checkInCount,
                telegram_chat_id: telegramChatId,
                message_text: message,
            })
            .eq('id', claimLogId);

        if (updateLog.error) {
            skipped.push({ roundId: round.id, reason: updateLog.error.message });
            continue;
        }

        sent.push({ roundId: round.id, count: checkInCount });
    }

    res.status(200).json({
        ok: true,
        now,
        sent,
        skipped,
    });
}
