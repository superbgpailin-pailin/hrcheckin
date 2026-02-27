import React, { useMemo, useState } from 'react';
import { useAppSettings } from '../context/AppSettingsContext';
import { usePortalAuth } from '../context/PortalAuthContext';
import { controlDayForMonth, monthKey } from '../utils/shiftUtils';

export const AppSettings: React.FC = () => {
    const { config, setConfig, saveConfig } = useAppSettings();
    const { portalUser } = usePortalAuth();

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
                <div className="panel-head">
                    <h3>QR & กฎการลงเวลา</h3>
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
                            onChange={(event) => setConfig((prev) => ({ ...prev, qrTokenLifetimeSeconds: Number(event.target.value) || 20 }))}
                        />
                    </div>
                    <div>
                        <label>QR Refresh ทุก (วินาที)</label>
                        <input
                            type="number"
                            value={config.qrRefreshSeconds}
                            onChange={(event) => setConfig((prev) => ({ ...prev, qrRefreshSeconds: Number(event.target.value) || 8 }))}
                        />
                    </div>
                    <div>
                        <label>Grace มาสาย (นาที)</label>
                        <input
                            type="number"
                            value={config.lateGraceMinutes}
                            onChange={(event) => setConfig((prev) => ({ ...prev, lateGraceMinutes: Number(event.target.value) || 15 }))}
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
