import React, { useMemo, useState } from 'react';
import { useAppSettings } from '../context/AppSettingsContext';
import { usePortalAuth } from '../context/PortalAuthContext';
import {
    clampQrRefreshSeconds,
    MIN_QR_REFRESH_LEAD_SECONDS,
    MIN_QR_TOKEN_VALIDITY_BUFFER_SECONDS,
    minimumQrTokenLifetimeSeconds,
} from '../services/appSettingsService';
import type { AppSystemConfig, LatePenaltyRule } from '../types/app';
import { controlDayForMonth, monthKey } from '../utils/shiftUtils';

type SettingsTab = 'shift' | 'late' | 'office-holiday' | 'employee-options' | 'telegram';
type EmployeeOptionKey = 'departments' | 'positions' | 'statuses';

const todayBangkokDateInput = (): string => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
};

const createLateRuleId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `late-rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const parseNumberOr = (value: string, fallback: number): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.max(0, Math.floor(parsed));
};

const parsePositiveNumberOr = (value: string, fallback: number): number => {
    return Math.max(1, parseNumberOr(value, fallback));
};

const parseNullableNumber = (value: string): number | null => {
    if (!value.trim()) {
        return null;
    }
    return parseNumberOr(value, 0);
};

const sortOfficeHolidays = (holidays: AppSystemConfig['officeHolidays']): AppSystemConfig['officeHolidays'] => {
    return [...holidays].sort((a, b) => a.date.localeCompare(b.date));
};

const defaultLateRule = (fromMinutes = 0): LatePenaltyRule => {
    return {
        id: createLateRuleId(),
        label: `กฎใหม่ ${fromMinutes}+ นาที`,
        minMinutes: fromMinutes,
        maxMinutes: null,
        deductionAmount: 0,
        monthlyAccumulatedMinutesThreshold: null,
        monthlyAccumulatedDeduction: null,
    };
};

export const AppSettings: React.FC = () => {
    const { config, setConfig, saveConfig } = useAppSettings();
    const { portalUser } = usePortalAuth();

    const [activeTab, setActiveTab] = useState<SettingsTab>('shift');
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(monthKey(new Date()));

    const computedDefaultDate = useMemo(() => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const date = new Date(year, (month || 1) - 1, 1);
        return controlDayForMonth(date, config);
    }, [config, selectedMonth]);
    const minimumQrLifetime = useMemo(() => {
        return minimumQrTokenLifetimeSeconds(config.qrRefreshSeconds);
    }, [config.qrRefreshSeconds]);

    const manualDate = config.controlShiftPolicy.overrides[selectedMonth] || computedDefaultDate;

    const updateOverride = (value: string) => {
        setConfig((prev) => ({
            ...prev,
            controlShiftPolicy: {
                ...prev.controlShiftPolicy,
                overrides: {
                    ...prev.controlShiftPolicy.overrides,
                    [selectedMonth]: value,
                },
            },
        }));
    };

    const clearOverride = () => {
        setConfig((prev) => {
            const overrides = { ...prev.controlShiftPolicy.overrides };
            delete overrides[selectedMonth];
            return {
                ...prev,
                controlShiftPolicy: {
                    ...prev.controlShiftPolicy,
                    overrides,
                },
            };
        });
    };

    const updateQrLifetime = (value: string) => {
        const nextLifetime = parsePositiveNumberOr(value, 20);
        setConfig((prev) => ({
            ...prev,
            qrTokenLifetimeSeconds: Math.max(nextLifetime, minimumQrTokenLifetimeSeconds(prev.qrRefreshSeconds)),
            qrRefreshSeconds: clampQrRefreshSeconds(
                prev.qrRefreshSeconds,
                Math.max(nextLifetime, minimumQrTokenLifetimeSeconds(prev.qrRefreshSeconds)),
            ),
        }));
    };

    const updateQrRefresh = (value: string) => {
        const requestedRefresh = parsePositiveNumberOr(value, 8);
        setConfig((prev) => {
            const nextLifetime = Math.max(prev.qrTokenLifetimeSeconds, minimumQrTokenLifetimeSeconds(requestedRefresh));
            return {
                ...prev,
                qrTokenLifetimeSeconds: nextLifetime,
                qrRefreshSeconds: clampQrRefreshSeconds(requestedRefresh, nextLifetime),
            };
        });
    };

    const updateLateRule = (ruleId: string, updater: (rule: LatePenaltyRule) => LatePenaltyRule) => {
        setConfig((prev) => ({
            ...prev,
            lateRules: prev.lateRules.map((rule) => (rule.id === ruleId ? updater(rule) : rule)),
        }));
    };

    const addLateRule = () => {
        setConfig((prev) => {
            const maxMinute = prev.lateRules.reduce((max, rule) => {
                const candidate = rule.maxMinutes ?? rule.minMinutes;
                return Math.max(max, candidate);
            }, 0);

            return {
                ...prev,
                lateRules: [...prev.lateRules, defaultLateRule(maxMinute + 1)],
            };
        });
    };

    const removeLateRule = (ruleId: string) => {
        setConfig((prev) => {
            if (prev.lateRules.length <= 1) {
                return prev;
            }

            return {
                ...prev,
                lateRules: prev.lateRules.filter((rule) => rule.id !== ruleId),
            };
        });
    };

    const updateOfficeHoliday = (
        holidayId: string,
        updater: (holiday: AppSystemConfig['officeHolidays'][number]) => AppSystemConfig['officeHolidays'][number],
    ) => {
        setConfig((prev) => ({
            ...prev,
            officeHolidays: sortOfficeHolidays(
                prev.officeHolidays.map((holiday) => (holiday.id === holidayId ? updater(holiday) : holiday)),
            ),
        }));
    };

    const addOfficeHoliday = () => {
        setConfig((prev) => ({
            ...prev,
            officeHolidays: sortOfficeHolidays([
                ...prev.officeHolidays,
                {
                    id: createLateRuleId(),
                    date: todayBangkokDateInput(),
                    label: 'Office Holiday',
                },
            ]),
        }));
    };

    const removeOfficeHoliday = (holidayId: string) => {
        setConfig((prev) => ({
            ...prev,
            officeHolidays: prev.officeHolidays.filter((holiday) => holiday.id !== holidayId),
        }));
    };

    const submit = async () => {
        setSaving(true);
        setNotice('');
        try {
            await saveConfig();
            setNotice('บันทึกการตั้งค่าเรียบร้อยแล้ว');
        } catch (error) {
            setNotice(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ');
        } finally {
            setSaving(false);
        }
    };

    const canEditAdvanced = portalUser?.role === 'Master' || portalUser?.role === 'Admin';

    const updateEmployeeOption = (key: EmployeeOptionKey, index: number, value: string) => {
        setConfig((prev) => {
            const nextValues = [...prev.employeeFieldOptions[key]];
            nextValues[index] = value;
            return {
                ...prev,
                employeeFieldOptions: {
                    ...prev.employeeFieldOptions,
                    [key]: nextValues,
                },
            };
        });
    };

    const addEmployeeOption = (key: EmployeeOptionKey) => {
        setConfig((prev) => ({
            ...prev,
            employeeFieldOptions: {
                ...prev.employeeFieldOptions,
                [key]: [...prev.employeeFieldOptions[key], ''],
            },
        }));
    };

    const removeEmployeeOption = (key: EmployeeOptionKey, index: number) => {
        setConfig((prev) => {
            const values = prev.employeeFieldOptions[key];
            if (values.length <= 1) {
                return prev;
            }

            return {
                ...prev,
                employeeFieldOptions: {
                    ...prev.employeeFieldOptions,
                    [key]: values.filter((_, itemIndex) => itemIndex !== index),
                },
            };
        });
    };

    const updateTelegramRound = (
        roundId: string,
        updater: (round: AppSystemConfig['telegramCheckInSummary']['rounds'][number]) => AppSystemConfig['telegramCheckInSummary']['rounds'][number],
    ) => {
        setConfig((prev) => ({
            ...prev,
            telegramCheckInSummary: {
                ...prev.telegramCheckInSummary,
                rounds: prev.telegramCheckInSummary.rounds.map((round) => (round.id === roundId ? updater(round) : round)),
            },
        }));
    };

    const optionGroups: Array<{ key: EmployeeOptionKey; label: string }> = [
        { key: 'departments', label: 'แผนก' },
        { key: 'positions', label: 'ตำแหน่ง' },
        { key: 'statuses', label: 'สถานะ' },
    ];

    return (
        <div className="portal-grid reveal-up">
            <section className="panel">
                <div className="settings-subnav">
                    <button
                        type="button"
                        className={`settings-subnav-btn ${activeTab === 'shift' ? 'active' : ''}`}
                        onClick={() => setActiveTab('shift')}
                    >
                        ตั้งค่ากะ
                    </button>
                    <button
                        type="button"
                        className={`settings-subnav-btn ${activeTab === 'late' ? 'active' : ''}`}
                        onClick={() => setActiveTab('late')}
                    >
                        ตั้งค่ามาสาย
                    </button>
                    <button
                        type="button"
                        className={`settings-subnav-btn ${activeTab === 'office-holiday' ? 'active' : ''}`}
                        onClick={() => setActiveTab('office-holiday')}
                    >
                        วันหยุดออฟฟิศ
                    </button>
                    <button
                        type="button"
                        className={`settings-subnav-btn ${activeTab === 'employee-options' ? 'active' : ''}`}
                        onClick={() => setActiveTab('employee-options')}
                    >
                        ตั้งค่าตัวเลือก
                    </button>
                    <button
                        type="button"
                        className={`settings-subnav-btn ${activeTab === 'telegram' ? 'active' : ''}`}
                        onClick={() => setActiveTab('telegram')}
                    >
                        Telegram
                    </button>
                </div>
            </section>

            {activeTab === 'shift' ? (
                <>
                    <section className="panel">
                        <div className="panel-head">
                            <h3>ตั้งค่ากะและ QR</h3>
                        </div>

                        <div className="filter-grid">
                            <div>
                                <label>ชื่อบริษัท</label>
                                <input
                                    value={config.companyName}
                                    onChange={(event) => setConfig((prev) => ({ ...prev, companyName: event.target.value }))}
                                />
                            </div>
                            <div>
                                <label>QR Secret</label>
                                <input
                                    type="password"
                                    value={config.qrSecret}
                                    onChange={(event) => setConfig((prev) => ({ ...prev, qrSecret: event.target.value }))}
                                    disabled={!canEditAdvanced}
                                />
                            </div>
                            <div>
                                <label>QR อายุ (วินาที)</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={config.qrTokenLifetimeSeconds}
                                    onChange={(event) => updateQrLifetime(event.target.value)}
                                />
                            </div>
                            <div>
                                <label>QR Refresh ทุก (วินาที)</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={clampQrRefreshSeconds(config.qrTokenLifetimeSeconds, config.qrTokenLifetimeSeconds)}
                                    value={config.qrRefreshSeconds}
                                    onChange={(event) => updateQrRefresh(event.target.value)}
                                />
                            </div>
                        </div>
                        <p className="panel-muted">
                            QR จะเปลี่ยนบนจอทุก {config.qrRefreshSeconds} วินาทีตามที่ตั้งค่า และระบบจะบังคับอายุ QR ไม่น้อยกว่า {minimumQrLifetime} วินาที
                            เพื่อให้ช่วงคนสแกนหนาแน่นยังใช้ QR ที่เพิ่งเปลี่ยนรอบได้ต่ออีกอย่างน้อย {MIN_QR_TOKEN_VALIDITY_BUFFER_SECONDS} วินาที
                            โดยยังคงเปลี่ยนก่อนหมดอายุอย่างน้อย {MIN_QR_REFRESH_LEAD_SECONDS} วินาที
                        </p>
                    </section>

                    <section className="panel">
                        <div className="panel-head">
                            <h3>ตั้งค่าวันควบกะรายเดือน</h3>
                        </div>
                        <p className="panel-muted">
                            ค่าเริ่มต้นคือ "วันก่อนสิ้นเดือน" และลำดับเริ่มที่กะดึกก่อน (20:00-14:00)
                        </p>

                        <div className="filter-grid">
                            <div>
                                <label>เดือน (YYYY-MM)</label>
                                <input
                                    type="month"
                                    value={selectedMonth}
                                    onChange={(event) => setSelectedMonth(event.target.value)}
                                />
                            </div>
                            <div>
                                <label>วันที่ควบกะของเดือนนี้</label>
                                <input
                                    type="date"
                                    value={manualDate}
                                    onChange={(event) => updateOverride(event.target.value)}
                                />
                            </div>
                            <div>
                                <label>ค่าเริ่มต้นระบบ</label>
                                <input value={computedDefaultDate} readOnly />
                            </div>
                        </div>

                        <div className="inline-actions">
                            <button className="btn-muted" type="button" onClick={clearOverride}>ล้าง override เดือนนี้</button>
                        </div>
                    </section>

                    <section className="panel">
                        <div className="panel-head">
                            <h3>โครงสร้างกะที่ใช้งาน</h3>
                        </div>
                        <div className="shift-grid">
                            {config.shifts.map((shift) => (
                                <div key={shift.id} className="shift-pill active" style={{ textAlign: 'left' }}>
                                    <strong>{shift.label}</strong>
                                    <small>{shift.id}</small>
                                </div>
                            ))}
                        </div>
                    </section>
                </>
            ) : null}

            {activeTab === 'late' ? (
                <>
                    <section className="panel">
                        <div className="panel-head">
                            <h3>ตั้งค่าการมาสาย</h3>
                        </div>
                        <div className="filter-grid">
                            <div>
                                <label>Grace มาสาย (นาที)</label>
                                <input
                                    type="number"
                                    value={config.lateGraceMinutes}
                                    onChange={(event) => setConfig((prev) => ({ ...prev, lateGraceMinutes: parseNumberOr(event.target.value, 15) }))}
                                />
                            </div>
                        </div>
                        <p className="panel-muted">
                            ระบบจะคำนวณสถานะสายและนาทีสายย้อนหลังตามค่านี้อัตโนมัติทุกครั้งที่เปิดรายงาน
                        </p>
                    </section>

                    <section className="panel">
                        <div className="panel-head">
                            <h3>เมนูตั้งค่าการมาสาย</h3>
                            <button type="button" className="btn-muted" onClick={addLateRule}>เพิ่มกฎ</button>
                        </div>

                        <p className="panel-muted">
                            เพิ่มกฎได้เรื่อยๆ โดยกำหนดช่วงนาทีสาย, จำนวนเงินหักต่อครั้ง และกฎสะสมรายเดือน (ถ้ามี)
                        </p>

                        <div className="late-rule-list">
                            {config.lateRules.map((rule, index) => (
                                <div key={rule.id} className="late-rule-card">
                                    <div className="panel-head" style={{ marginBottom: '0.45rem' }}>
                                        <strong>กฎที่ {index + 1}</strong>
                                        <button
                                            type="button"
                                            className="btn-danger"
                                            onClick={() => removeLateRule(rule.id)}
                                            disabled={config.lateRules.length <= 1}
                                        >
                                            ลบกฎ
                                        </button>
                                    </div>

                                    <div className="filter-grid late-rule-grid">
                                        <div>
                                            <label>ชื่อกฎ</label>
                                            <input
                                                value={rule.label}
                                                onChange={(event) => updateLateRule(rule.id, (prev) => ({ ...prev, label: event.target.value }))}
                                            />
                                        </div>
                                        <div>
                                            <label>นาทีสายเริ่มต้น</label>
                                            <input
                                                type="number"
                                                value={rule.minMinutes}
                                                onChange={(event) => updateLateRule(rule.id, (prev) => {
                                                    const nextMin = parseNumberOr(event.target.value, prev.minMinutes);
                                                    const nextMax = prev.maxMinutes === null ? null : Math.max(nextMin, prev.maxMinutes);
                                                    return {
                                                        ...prev,
                                                        minMinutes: nextMin,
                                                        maxMinutes: nextMax,
                                                    };
                                                })}
                                            />
                                        </div>
                                        <div>
                                            <label>นาทีสายสิ้นสุด (เว้นว่าง = ไม่จำกัด)</label>
                                            <input
                                                type="number"
                                                value={rule.maxMinutes ?? ''}
                                                onChange={(event) => updateLateRule(rule.id, (prev) => {
                                                    const parsed = parseNullableNumber(event.target.value);
                                                    return {
                                                        ...prev,
                                                        maxMinutes: parsed === null ? null : Math.max(prev.minMinutes, parsed),
                                                    };
                                                })}
                                            />
                                        </div>
                                        <div>
                                            <label>หักต่อครั้ง (บาท)</label>
                                            <input
                                                type="number"
                                                value={rule.deductionAmount}
                                                onChange={(event) => updateLateRule(rule.id, (prev) => ({ ...prev, deductionAmount: parseNumberOr(event.target.value, 0) }))}
                                            />
                                        </div>
                                        <div>
                                            <label>ถ้าสะสมรายเดือนเกิน (นาที)</label>
                                            <input
                                                type="number"
                                                value={rule.monthlyAccumulatedMinutesThreshold ?? ''}
                                                onChange={(event) => updateLateRule(rule.id, (prev) => ({
                                                    ...prev,
                                                    monthlyAccumulatedMinutesThreshold: parseNullableNumber(event.target.value),
                                                }))}
                                            />
                                        </div>
                                        <div>
                                            <label>หักเพิ่มเมื่อเกิน (บาท)</label>
                                            <input
                                                type="number"
                                                value={rule.monthlyAccumulatedDeduction ?? ''}
                                                onChange={(event) => updateLateRule(rule.id, (prev) => ({
                                                    ...prev,
                                                    monthlyAccumulatedDeduction: parseNullableNumber(event.target.value),
                                                }))}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </>
            ) : null}

            {activeTab === 'office-holiday' ? (
                <section className="panel">
                    <div className="panel-head">
                        <h3>วันหยุดออฟฟิศ (ยกเว้นเช็กอิน)</h3>
                        <button type="button" className="btn-muted" onClick={addOfficeHoliday}>เพิ่มวันหยุด</button>
                    </div>

                    <p className="panel-muted">
                        วันที่ที่กำหนดในเมนูนี้จะถูกยกเว้นการเช็กอิน และไม่นับเป็น absent/leave ในรายงาน
                    </p>

                    {config.officeHolidays.length === 0 ? (
                        <p className="panel-muted">ยังไม่มีวันหยุดออฟฟิศที่ตั้งค่าไว้</p>
                    ) : (
                        <div className="late-rule-list">
                            {config.officeHolidays.map((holiday, index) => (
                                <div key={holiday.id} className="late-rule-card">
                                    <div className="panel-head" style={{ marginBottom: '0.45rem' }}>
                                        <strong>วันหยุดที่ {index + 1}</strong>
                                        <button
                                            type="button"
                                            className="btn-danger"
                                            onClick={() => removeOfficeHoliday(holiday.id)}
                                        >
                                            ลบ
                                        </button>
                                    </div>

                                    <div className="filter-grid late-rule-grid">
                                        <div>
                                            <label>วันที่</label>
                                            <input
                                                type="date"
                                                value={holiday.date}
                                                onChange={(event) => updateOfficeHoliday(holiday.id, (prev) => ({
                                                    ...prev,
                                                    date: event.target.value,
                                                }))}
                                            />
                                        </div>
                                        <div>
                                            <label>หมายเหตุ</label>
                                            <input
                                                value={holiday.label}
                                                onChange={(event) => updateOfficeHoliday(holiday.id, (prev) => ({
                                                    ...prev,
                                                    label: event.target.value,
                                                }))}
                                                placeholder="เช่น ระบบล่ม / วันหยุดพิเศษ"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            ) : null}

            {activeTab === 'employee-options' ? (
                <section className="panel">
                    <div className="panel-head">
                        <h3>ตั้งค่าตัวเลือกดรอปดาวน์ข้อมูลพนักงาน</h3>
                    </div>

                    <p className="panel-muted">
                        ใช้สำหรับตัวเลือกในฟอร์มพนักงาน: แผนก, ตำแหน่ง, สถานะ
                    </p>

                    {optionGroups.map((group) => (
                        <div key={group.key} className="late-rule-card" style={{ marginBottom: '1rem' }}>
                            <div className="panel-head" style={{ marginBottom: '0.45rem' }}>
                                <strong>{group.label}</strong>
                                <button
                                    type="button"
                                    className="btn-muted"
                                    onClick={() => addEmployeeOption(group.key)}
                                >
                                    เพิ่มตัวเลือก
                                </button>
                            </div>

                            <div className="filter-grid">
                                {config.employeeFieldOptions[group.key].map((value, index) => (
                                    <div key={`${group.key}-${index}`}>
                                        <label>{group.label} #{index + 1}</label>
                                        <div className="inline-actions">
                                            <input
                                                value={value}
                                                onChange={(event) => updateEmployeeOption(group.key, index, event.target.value)}
                                                placeholder={`ระบุ${group.label}`}
                                            />
                                            <button
                                                type="button"
                                                className="btn-danger"
                                                onClick={() => removeEmployeeOption(group.key, index)}
                                                disabled={config.employeeFieldOptions[group.key].length <= 1}
                                            >
                                                ลบ
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </section>
            ) : null}

            {activeTab === 'telegram' ? (
                <section className="panel">
                    <div className="panel-head">
                        <h3>Telegram แจ้งเตือนสรุปเช็กอิน</h3>
                    </div>

                    <p className="panel-muted">
                        ระบบจะส่งสรุปจำนวนคนเช็กอินตามช่วงเวลาแต่ละรอบ โดยใช้ Cron endpoint บน Vercel
                    </p>

                    <div className="filter-grid">
                        <div>
                            <label>เปิดใช้งานแจ้งเตือน Telegram</label>
                            <select
                                value={config.telegramCheckInSummary.enabled ? 'on' : 'off'}
                                onChange={(event) => setConfig((prev) => ({
                                    ...prev,
                                    telegramCheckInSummary: {
                                        ...prev.telegramCheckInSummary,
                                        enabled: event.target.value === 'on',
                                    },
                                }))}
                            >
                                <option value="off">ปิด</option>
                                <option value="on">เปิด</option>
                            </select>
                        </div>
                    </div>

                    <div className="late-rule-list" style={{ marginTop: '1rem' }}>
                        {config.telegramCheckInSummary.rounds.map((round, index) => (
                            <div key={round.id} className="late-rule-card">
                                <div className="panel-head" style={{ marginBottom: '0.45rem' }}>
                                    <strong>รอบที่ {index + 1}</strong>
                                </div>

                                <div className="filter-grid late-rule-grid">
                                    <div>
                                        <label>ชื่อรอบ</label>
                                        <input
                                            value={round.label}
                                            onChange={(event) => updateTelegramRound(round.id, (prev) => ({
                                                ...prev,
                                                label: event.target.value,
                                            }))}
                                        />
                                    </div>
                                    <div>
                                        <label>เริ่มต้น</label>
                                        <input
                                            type="time"
                                            value={round.startTime}
                                            onChange={(event) => updateTelegramRound(round.id, (prev) => ({
                                                ...prev,
                                                startTime: event.target.value,
                                            }))}
                                        />
                                    </div>
                                    <div>
                                        <label>ถึง</label>
                                        <input
                                            type="time"
                                            value={round.endTime}
                                            onChange={(event) => updateTelegramRound(round.id, (prev) => ({
                                                ...prev,
                                                endTime: event.target.value,
                                            }))}
                                        />
                                    </div>
                                    <div>
                                        <label>ส่งเวลา</label>
                                        <input
                                            type="time"
                                            value={round.sendTime}
                                            onChange={(event) => updateTelegramRound(round.id, (prev) => ({
                                                ...prev,
                                                sendTime: event.target.value,
                                            }))}
                                        />
                                    </div>
                                    <div>
                                        <label>สถานะรอบ</label>
                                        <select
                                            value={round.enabled ? 'on' : 'off'}
                                            onChange={(event) => updateTelegramRound(round.id, (prev) => ({
                                                ...prev,
                                                enabled: event.target.value === 'on',
                                            }))}
                                        >
                                            <option value="off">ปิด</option>
                                            <option value="on">เปิด</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <p className="panel-muted" style={{ marginTop: '0.8rem' }}>
                        ต้องตั้งค่า environment บน Vercel เพิ่มเติม: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, CRON_SECRET และ PORTAL_AUTH_TOKEN_SECRET
                    </p>
                </section>
            ) : null}

            <section className="panel">
                <div className="inline-actions" style={{ justifyContent: 'space-between' }}>
                    <p className="panel-muted">{notice}</p>
                    <button className="btn-primary" type="button" onClick={submit} disabled={saving}>
                        {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                    </button>
                </div>
            </section>
        </div>
    );
};

