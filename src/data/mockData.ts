import type { Employee } from '../types';

export const MOCK_EMPLOYEES: Employee[] = [
    {
        id: 'CR001',
        role: 'Admin',
        photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
        firstNameTH: 'สมชาย',
        lastNameTH: 'ใจดี',
        firstNameEN: 'Somchai',
        lastNameEN: 'Jaidee',
        nickname: 'ชาย',
        gender: 'Male',
        nationality: 'Thai',
        dateOfBirth: '1985-05-15',
        startDate: '2020-01-01',
        position: 'HR Manager',
        department: 'Human Resources',
        address: '123 ถ.สุขุมวิท กทม.',
        phoneNumber: '081-111-2222',
        email: 'somchai@company.com',
        emergencyContactName: 'สมหญิง ใจดี',
        emergencyContactPhone: '081-111-3333',
        emergencyContactRelation: 'Wife',
        status: 'Active',
    },
    {
        id: 'CR002',
        role: 'Supervisor',
        photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
        firstNameTH: 'วิภา',
        lastNameTH: 'รักงาน',
        firstNameEN: 'Wipa',
        lastNameEN: 'Rakngan',
        nickname: 'วิ',
        gender: 'Female',
        nationality: 'Thai',
        dateOfBirth: '1990-08-20',
        startDate: '2021-03-15',
        position: 'Team Lead',
        department: 'Operations',
        address: '456 ถ.สีลม กทม.',
        phoneNumber: '089-999-8888',
        email: 'wipa@company.com',
        emergencyContactName: 'คุณแม่',
        emergencyContactPhone: '089-999-7777',
        emergencyContactRelation: 'Mother',
        status: 'Active',
    },
    {
        id: 'CR003',
        role: 'Employee',
        photoUrl: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
        firstNameTH: 'ก้อง',
        lastNameTH: 'เกียรติ',
        firstNameEN: 'Kong',
        lastNameEN: 'Kiat',
        nickname: 'ก้อง',
        gender: 'Male',
        nationality: 'Thai',
        dateOfBirth: '1995-12-10',
        startDate: '2022-06-01',
        position: 'Staff',
        department: 'Operations',
        address: '789 ถ.ลาดพร้าว กทม.',
        phoneNumber: '090-555-4444',
        email: 'kong@company.com',
        emergencyContactName: 'สมศักดิ์',
        emergencyContactPhone: '090-555-5555',
        emergencyContactRelation: 'Father',
        status: 'Active',
    },
];

export const MOCK_ATTENDANCE = [
    // Today's records
    { date: new Date().toISOString().split('T')[0], employeeId: 'CR001', checkInTime: '08:05', checkOutTime: '17:30', status: 'On Time', site: 'Headquarters', shift: 'Morning Shift' },
    { date: new Date().toISOString().split('T')[0], employeeId: 'CR002', checkInTime: '09:00', checkOutTime: '-', status: 'Late', site: 'Pailin', shift: 'Morning Shift' },
    { date: new Date().toISOString().split('T')[0], employeeId: 'CR003', checkInTime: '07:55', checkOutTime: '17:00', status: 'On Time', site: 'Headquarters', shift: 'Morning Shift' },

    // Yesterday
    { date: new Date(Date.now() - 86400000).toISOString().split('T')[0], employeeId: 'CR001', checkInTime: '08:00', checkOutTime: '17:00', status: 'On Time', site: 'Headquarters', shift: 'Morning Shift' },
    { date: new Date(Date.now() - 86400000).toISOString().split('T')[0], employeeId: 'CR002', checkInTime: '08:15', checkOutTime: '17:15', status: 'Late', site: 'Pailin', shift: 'Morning Shift' },
    { date: new Date(Date.now() - 86400000).toISOString().split('T')[0], employeeId: 'CR003', checkInTime: '07:50', checkOutTime: '16:50', status: 'On Time', site: 'Headquarters', shift: 'Morning Shift' },

    // 2 days ago
    { date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0], employeeId: 'CR001', checkInTime: '08:10', checkOutTime: '17:10', status: 'Late', site: 'Headquarters', shift: 'Morning Shift' },
    { date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0], employeeId: 'CR002', checkInTime: '08:00', checkOutTime: '17:00', status: 'On Time', site: 'Pailin', shift: 'Morning Shift' },

    // 3 days ago
    { date: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0], employeeId: 'CR001', checkInTime: '07:55', checkOutTime: '17:00', status: 'On Time', site: 'Headquarters', shift: 'Morning Shift' },
    { date: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0], employeeId: 'CR002', checkInTime: '08:30', checkOutTime: '17:30', status: 'Late', site: 'Pailin', shift: 'Morning Shift' },
    { date: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0], employeeId: 'CR003', checkInTime: '08:00', checkOutTime: '17:00', status: 'On Time', site: 'Headquarters', shift: 'Morning Shift' },

    // 5 days ago
    { date: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0], employeeId: 'CR001', checkInTime: '08:00', checkOutTime: '17:00', status: 'On Time', site: 'Headquarters', shift: 'Morning Shift' },
    { date: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0], employeeId: 'CR003', checkInTime: '07:45', checkOutTime: '16:45', status: 'On Time', site: 'Headquarters', shift: 'Morning Shift' },

    // 7 days ago
    { date: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0], employeeId: 'CR001', checkInTime: '08:05', checkOutTime: '17:05', status: 'On Time', site: 'Headquarters', shift: 'Morning Shift' },
    { date: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0], employeeId: 'CR002', checkInTime: '08:20', checkOutTime: '17:20', status: 'Late', site: 'Pailin', shift: 'Morning Shift' },
    { date: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0], employeeId: 'CR003', checkInTime: '08:00', checkOutTime: '17:00', status: 'On Time', site: 'Headquarters', shift: 'Morning Shift' },
];
