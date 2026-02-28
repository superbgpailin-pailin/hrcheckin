export type ShiftId =
    | 'morning'
    | 'supervisor_afternoon'
    | 'night'
    | 'control_night'
    | 'control_day';

export type PortalPage =
    | 'dashboard'
    | 'attendance'
    | 'employees'
    | 'requests'
    | 'settings'
    | 'admins';

export type CheckInStatus = 'On Time' | 'Late';

export interface LatePenaltyRule {
    id: string;
    label: string;
    minMinutes: number;
    maxMinutes: number | null;
    deductionAmount: number;
    monthlyAccumulatedMinutesThreshold: number | null;
    monthlyAccumulatedDeduction: number | null;
}

export interface ShiftDefinition {
    id: ShiftId;
    label: string;
    start: string;
    end: string;
    supervisorOnly?: boolean;
    isControlShift?: boolean;
}

export interface ControlShiftPolicy {
    enabled: boolean;
    // key: YYYY-MM, value: YYYY-MM-DD
    overrides: Record<string, string>;
}

export interface EmployeeFieldOptions {
    departments: string[];
    positions: string[];
    roles: string[];
    statuses: string[];
}

export interface AppSystemConfig {
    companyName: string;
    qrSecret: string;
    qrTokenLifetimeSeconds: number;
    qrRefreshSeconds: number;
    lateGraceMinutes: number;
    lateRules: LatePenaltyRule[];
    shifts: ShiftDefinition[];
    controlShiftPolicy: ControlShiftPolicy;
    employeeFieldOptions: EmployeeFieldOptions;
}

export interface AppEmployee {
    id: string;
    role: 'Employee' | 'Supervisor';
    firstNameTH: string;
    lastNameTH: string;
    firstNameEN: string;
    lastNameEN: string;
    nickname: string;
    position: string;
    department: string;
    status: 'Active' | 'OnLeave' | 'Resigned';
    photoUrl: string;
    pin: string;
    email: string;
    phoneNumber: string;
    birthDate: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    selfieUrl: string;
    idCardUrl: string;
    passportUrl: string;
    startDate: string;
    defaultShiftId?: ShiftId;
}

export interface EmployeeProfileDraft {
    employeeId: string;
    pin: string;
    firstNameTH: string;
    lastNameTH: string;
    firstNameEN: string;
    lastNameEN: string;
    nickname: string;
    position: string;
    department: string;
    email: string;
    phoneNumber: string;
    birthDate: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    selfieUrl: string;
    idCardUrl: string;
    passportUrl: string;
    startDate: string;
}

export type EmployeeProfileRequestType = 'register' | 'update';
export type EmployeeProfileRequestStatus = 'pending' | 'approved' | 'rejected';

export interface EmployeeProfileRequest extends EmployeeProfileDraft {
    id: string;
    requestType: EmployeeProfileRequestType;
    status: EmployeeProfileRequestStatus;
    reviewNote: string;
    reviewedBy: string;
    reviewedAt: string;
    createdAt: string;
    updatedAt: string;
}

export interface PortalUser {
    username: string;
    displayName: string;
    role: 'Master' | 'Admin';
    photoUrl: string;
}

export interface AttendanceSummaryRecord {
    id: string;
    employeeId: string;
    employeeName: string;
    department: string;
    role: AppEmployee['role'];
    shiftId: ShiftId;
    shiftLabel: string;
    checkInAt: string;
    estimatedCheckOutAt: string;
    lateMinutes: number;
    status: CheckInStatus;
    source: 'QR';
    kioskId: string;
    photoUrl: string;
}

export interface AttendanceEmployeeReportRow {
    employeeId: string;
    employeeName: string;
    department: string;
    role: AppEmployee['role'];
    employmentStatus: AppEmployee['status'];
    checkInCount: number;
    onTimeCount: number;
    lateCount: number;
    totalLateMinutes: number;
    averageLateMinutes: number;
    absentDays: number;
    leaveDays: number;
    latePenaltyAmount: number;
}

export interface QrTokenPayload {
    kioskId: string;
    nonce: string;
    issuedAt: number;
    expiresAt: number;
    signature: string;
}
