import React, { useMemo, useState } from 'react';
import { useAppSettings } from '../context/AppSettingsContext';
import { usePortalAuth } from '../context/PortalAuthContext';
import type { LatePenaltyRule } from '../types/app';
import { controlDayForMonth, monthKey } from '../utils/shiftUtils';

type SettingsTab = 'shift' | 'late';

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

const parseNullableNumber = (value: string): number | null => {
    if (!value.trim()) {
        return null;
    }
    return parseNumberOr(value, 0);
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
                                    value={config.qrTokenLifetimeSeconds}
                                    onChange={(event) => setConfig((prev) => ({ ...prev, qrTokenLifetimeSeconds: parseNumberOr(event.target.value, 20) }))}
                                />
                            </div>
                            <div>
                                <label>QR Refresh ทุก (วินาที)</label>
                                <input
                                    type="number"
                                    value={config.qrRefreshSeconds}
                                    onChange={(event) => setConfig((prev) => ({ ...prev, qrRefreshSeconds: parseNumberOr(event.target.value, 8) }))}
                                />
                            </div>
                        </div>
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
