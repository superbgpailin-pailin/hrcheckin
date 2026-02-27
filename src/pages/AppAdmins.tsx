import React, { useMemo, useState } from 'react';
import { usePortalAuth } from '../context/PortalAuthContext';

export const AppAdmins: React.FC = () => {
    const { portalUser, portalAdmins, addPortalAdmin, changeOwnPassword } = usePortalAuth();
    const [username, setUsername] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [password, setPassword] = useState('');
    const [adminNotice, setAdminNotice] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const [currentPassword, setCurrentPassword] = useState('');
    const [nextPassword, setNextPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordNotice, setPasswordNotice] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);

    const canManage = portalUser?.role === 'Master';

    const sortedAdmins = useMemo(() => {
        return [...portalAdmins].sort((a, b) => {
            if (a.role === b.role) {
                return a.username.localeCompare(b.username);
            }
            return a.role === 'Master' ? -1 : 1;
        });
    }, [portalAdmins]);

    const submitAddAdmin = async (event: React.FormEvent) => {
        event.preventDefault();
        setSubmitting(true);
        const result = await addPortalAdmin({ username, displayName, password });
        setSubmitting(false);
        setAdminNotice(result.message || '');
        if (!result.success) {
            return;
        }

        setUsername('');
        setDisplayName('');
        setPassword('');
    };

    const submitChangePassword = async (event: React.FormEvent) => {
        event.preventDefault();
        setPasswordNotice('');

        if (nextPassword !== confirmPassword) {
            setPasswordNotice('รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน');
            return;
        }

        setChangingPassword(true);
        const result = await changeOwnPassword({
            currentPassword,
            newPassword: nextPassword,
        });
        setChangingPassword(false);
        setPasswordNotice(result.message || '');
        if (!result.success) {
            return;
        }

        setCurrentPassword('');
        setNextPassword('');
        setConfirmPassword('');
    };

    return (
        <div className="portal-grid reveal-up">
            <section className="panel">
                <div className="panel-head">
                    <h3>เปลี่ยนรหัสผ่านของฉัน</h3>
                    <span>{portalUser?.username || '-'}</span>
                </div>

                <form onSubmit={(event) => void submitChangePassword(event)} className="filter-grid">
                    <div>
                        <label>รหัสผ่านปัจจุบัน</label>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={(event) => setCurrentPassword(event.target.value)}
                            autoComplete="current-password"
                        />
                    </div>
                    <div>
                        <label>รหัสผ่านใหม่</label>
                        <input
                            type="password"
                            value={nextPassword}
                            onChange={(event) => setNextPassword(event.target.value)}
                            autoComplete="new-password"
                        />
                    </div>
                    <div>
                        <label>ยืนยันรหัสผ่านใหม่</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            autoComplete="new-password"
                        />
                    </div>

                    <div className="inline-actions" style={{ gridColumn: '1 / -1', justifyContent: 'flex-end' }}>
                        <button type="submit" className="btn-primary" disabled={changingPassword}>
                            {changingPassword ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
                        </button>
                    </div>
                </form>

                {passwordNotice ? <p className="panel-muted" style={{ marginTop: '0.8rem' }}>{passwordNotice}</p> : null}
            </section>

            <section className="panel">
                <div className="panel-head">
                    <h3>เพิ่มแอดมิน</h3>
                    <span>เฉพาะ Master เท่านั้น</span>
                </div>

                {canManage ? (
                    <form onSubmit={(event) => void submitAddAdmin(event)} className="filter-grid">
                        <div>
                            <label>Username</label>
                            <input
                                value={username}
                                onChange={(event) => setUsername(event.target.value.toLowerCase())}
                                placeholder="admin_ops"
                            />
                        </div>
                        <div>
                            <label>ชื่อแสดงผล</label>
                            <input
                                value={displayName}
                                onChange={(event) => setDisplayName(event.target.value)}
                                placeholder="Operations Admin"
                            />
                        </div>
                        <div>
                            <label>Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                placeholder="อย่างน้อย 6 ตัวอักษร"
                            />
                        </div>

                        <div className="inline-actions" style={{ gridColumn: '1 / -1', justifyContent: 'flex-end' }}>
                            <button type="submit" className="btn-primary" disabled={submitting}>
                                {submitting ? 'กำลังเพิ่ม...' : 'เพิ่มแอดมิน'}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="form-error">คุณไม่มีสิทธิ์เพิ่มแอดมิน (ต้องใช้บัญชี master)</div>
                )}

                {adminNotice ? <p className="panel-muted" style={{ marginTop: '0.8rem' }}>{adminNotice}</p> : null}
            </section>

            <section className="panel table-panel">
                <div className="panel-head">
                    <h3>บัญชีผู้ดูแลระบบ</h3>
                    <span>{sortedAdmins.length} บัญชี</span>
                </div>

                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>ชื่อ</th>
                                <th>Role</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedAdmins.map((admin) => (
                                <tr key={admin.username}>
                                    <td>{admin.username}</td>
                                    <td>{admin.displayName}</td>
                                    <td>{admin.role}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};
