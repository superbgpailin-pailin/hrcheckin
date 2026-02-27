import React, { useMemo, useState } from 'react';
import { usePortalAuth } from '../context/PortalAuthContext';

export const AppAdmins: React.FC = () => {
    const { portalUser, portalAdmins, addPortalAdmin } = usePortalAuth();
    const [username, setUsername] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [password, setPassword] = useState('');
    const [notice, setNotice] = useState('');

    const canManage = portalUser?.role === 'Master';

    const sortedAdmins = useMemo(() => {
        return [...portalAdmins].sort((a, b) => {
            if (a.role === b.role) {
                return a.username.localeCompare(b.username);
            }
            return a.role === 'Master' ? -1 : 1;
        });
    }, [portalAdmins]);

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        const result = addPortalAdmin({ username, displayName, password });
        setNotice(result.message || '');
        if (!result.success) {
            return;
        }

        setUsername('');
        setDisplayName('');
        setPassword('');
    };

    return (
        <div className="portal-grid reveal-up">
            <section className="panel">
                <div className="panel-head">
                    <h3>เพิ่มแอดมิน</h3>
                    <span>เฉพาะ Master เท่านั้น</span>
                </div>

                {canManage ? (
                    <form onSubmit={submit} className="filter-grid">
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
                            <button type="submit" className="btn-primary">เพิ่มแอดมิน</button>
                        </div>
                    </form>
                ) : (
                    <div className="form-error">คุณไม่มีสิทธิ์เพิ่มแอดมิน (ต้องใช้บัญชี master)</div>
                )}

                {notice ? <p className="panel-muted" style={{ marginTop: '0.8rem' }}>{notice}</p> : null}
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
