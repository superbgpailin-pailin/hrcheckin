import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

export interface LeaveType {
    id: string;
    name: string;
    nameTH: string;
    deductDays: number;
    requireDoc: boolean;
}

export interface LeaveRequest {
    id: string;
    employeeId: string;
    type: 'leave' | 'timeCorrection';
    leaveTypeId?: string;
    date: string;
    newCheckIn?: string;
    newCheckOut?: string;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: string;
    reviewedAt?: string;
    reviewedBy?: string;
    rejectReason?: string;
}

interface LeaveState {
    leaveTypes: LeaveType[];
    unexcusedPenalty: number; // จำนวนแรงที่หักเมื่อขาดไม่แจ้ง
    requests: LeaveRequest[];
}

interface LeaveContextType extends LeaveState {
    addLeaveType: (type: Omit<LeaveType, 'id'>) => void;
    updateLeaveType: (id: string, updates: Partial<LeaveType>) => void;
    removeLeaveType: (id: string) => void;
    setUnexcusedPenalty: (days: number) => void;
    addRequest: (req: Omit<LeaveRequest, 'id' | 'status' | 'createdAt'>) => void;
    approveRequest: (id: string, reviewerId: string) => void;
    rejectRequest: (id: string, reviewerId: string, reason: string) => void;
    getRequestsByEmployee: (employeeId: string) => LeaveRequest[];
    getPendingRequests: () => LeaveRequest[];
}

const defaultLeaveTypes: LeaveType[] = [
    { id: '1', name: 'Sick Leave', nameTH: 'ลาป่วย', deductDays: 1, requireDoc: false },
    { id: '2', name: 'Personal Leave', nameTH: 'ลากิจ', deductDays: 1, requireDoc: false },
    { id: '3', name: 'Annual Leave', nameTH: 'ลาพักร้อน', deductDays: 1, requireDoc: false },
    { id: '4', name: 'Emergency Leave', nameTH: 'ลาฉุกเฉิน', deductDays: 1, requireDoc: true },
];

const defaultState: LeaveState = {
    leaveTypes: defaultLeaveTypes,
    unexcusedPenalty: 2,
    requests: []
};

const LeaveContext = createContext<LeaveContextType | undefined>(undefined);

export const LeaveProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<LeaveState>(() => {
        const saved = localStorage.getItem('leaveState');
        return saved ? JSON.parse(saved) : defaultState;
    });

    useEffect(() => {
        localStorage.setItem('leaveState', JSON.stringify(state));
    }, [state]);

    const addLeaveType = (type: Omit<LeaveType, 'id'>) => {
        const id = Date.now().toString();
        setState(prev => ({
            ...prev,
            leaveTypes: [...prev.leaveTypes, { ...type, id }]
        }));
    };

    const updateLeaveType = (id: string, updates: Partial<LeaveType>) => {
        setState(prev => ({
            ...prev,
            leaveTypes: prev.leaveTypes.map(t => t.id === id ? { ...t, ...updates } : t)
        }));
    };

    const removeLeaveType = (id: string) => {
        setState(prev => ({
            ...prev,
            leaveTypes: prev.leaveTypes.filter(t => t.id !== id)
        }));
    };

    const setUnexcusedPenalty = (days: number) => {
        setState(prev => ({ ...prev, unexcusedPenalty: days }));
    };

    const addRequest = (req: Omit<LeaveRequest, 'id' | 'status' | 'createdAt'>) => {
        const id = Date.now().toString();
        setState(prev => ({
            ...prev,
            requests: [...prev.requests, { ...req, id, status: 'pending', createdAt: new Date().toISOString() }]
        }));
    };

    const approveRequest = (id: string, reviewerId: string) => {
        setState(prev => ({
            ...prev,
            requests: prev.requests.map(r =>
                r.id === id
                    ? { ...r, status: 'approved' as const, reviewedAt: new Date().toISOString(), reviewedBy: reviewerId }
                    : r
            )
        }));
    };

    const rejectRequest = (id: string, reviewerId: string, reason: string) => {
        setState(prev => ({
            ...prev,
            requests: prev.requests.map(r =>
                r.id === id
                    ? { ...r, status: 'rejected' as const, reviewedAt: new Date().toISOString(), reviewedBy: reviewerId, rejectReason: reason }
                    : r
            )
        }));
    };

    const getRequestsByEmployee = (employeeId: string) => {
        return state.requests.filter(r => r.employeeId === employeeId);
    };

    const getPendingRequests = () => {
        return state.requests.filter(r => r.status === 'pending');
    };

    return (
        <LeaveContext.Provider value={{
            ...state,
            addLeaveType,
            updateLeaveType,
            removeLeaveType,
            setUnexcusedPenalty,
            addRequest,
            approveRequest,
            rejectRequest,
            getRequestsByEmployee,
            getPendingRequests
        }}>
            {children}
        </LeaveContext.Provider>
    );
};

export const useLeave = () => {
    const context = useContext(LeaveContext);
    if (!context) {
        throw new Error('useLeave must be used within LeaveProvider');
    }
    return context;
};
