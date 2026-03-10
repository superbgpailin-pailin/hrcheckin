/**
 * Shared Supabase utility functions
 * Previously duplicated across appAttendanceService,
 * appEmployeeService, appSettingsService, PortalAuthContext,
 * and appProfileRequestService.
 */

const READ_TIMEOUT_MS = 15000;
const READ_RETRY_COUNT = 2;
const TIMEOUT_MESSAGE = 'Database request timed out. Server is slow or unavailable. Please try again.';

export const getErrorMessage = (error: unknown): string => {
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

export const isTransportError = (message: string): boolean => {
    const normalized = message.trim().toLowerCase();
    const timeoutMessage = TIMEOUT_MESSAGE.toLowerCase();
    return normalized === 'failed to fetch'
        || normalized === timeoutMessage
        || normalized.includes('fetch')
        || normalized.includes('timeout')
        || normalized.includes('timed out')
        || normalized.includes('slow or unavailable')
        || normalized.includes('connection timed out')
        || normalized.includes('connection terminated')
        || normalized.includes('status 522')
        || normalized.includes('error code 522');
};

export const isSchemaMissingError = (message: string): boolean => {
    const normalized = message.toLowerCase();
    return normalized.includes('could not find the table')
        || normalized.includes('schema cache')
        || normalized.includes('does not exist');
};

export const withReadRetry = async <T>(
    operation: () => Promise<T>,
    timeoutMs = READ_TIMEOUT_MS,
    retryCount = READ_RETRY_COUNT,
): Promise<T> => {
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
        let timeoutHandle: ReturnType<typeof globalThis.setTimeout> | null = null;
        try {
            const result = await Promise.race<T>([
                operation(),
                new Promise<T>((_, reject) => {
                    timeoutHandle = globalThis.setTimeout(() => reject(new Error(TIMEOUT_MESSAGE)), timeoutMs);
                }),
            ]);
            if (timeoutHandle) {
                globalThis.clearTimeout(timeoutHandle);
            }
            return result;
        } catch (error) {
            if (timeoutHandle) {
                globalThis.clearTimeout(timeoutHandle);
            }
            lastError = error;
            const message = getErrorMessage(error);
            if (!isTransportError(message) || attempt >= retryCount) {
                throw error;
            }

            await new Promise<void>((resolve) => {
                globalThis.setTimeout(resolve, 350 * (attempt + 1));
            });
        }
    }

    throw lastError instanceof Error ? lastError : new Error(TIMEOUT_MESSAGE);
};
