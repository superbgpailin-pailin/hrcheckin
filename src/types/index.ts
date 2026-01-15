export type Language = 'th' | 'en';

export type Role = 'Employee' | 'Supervisor' | 'Admin';

export interface Employee {
    id: string; // Employee ID (CRxxx)
    role: Role;
    photoUrl: string;

    // Names
    firstNameTH: string;
    lastNameTH: string;
    firstNameEN: string;
    lastNameEN: string;
    nickname: string;

    // Demographics
    gender: 'Male' | 'Female' | 'Other';
    nationality: 'Thai' | 'Laotian' | 'Cambodian' | 'Other';
    dateOfBirth: string; // ISO Date string

    // Work
    startDate: string;
    position: string;
    department: string;

    // Contact
    address: string;
    phoneNumber: string;
    email: string;

    // Emergency Contact
    emergencyContactName: string;
    emergencyContactPhone: string;
    emergencyContactRelation: string;

    // Status
    status: 'Active' | 'OnLeave' | 'Resigned';
    pin?: string;
    lineId?: string;
}

