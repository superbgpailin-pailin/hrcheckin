import React, { useState } from 'react';

interface AdminLoginPageProps {
    onBack: () => void;
    onLogin: (username: string, password: string) => { success: boolean; message?: string };
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ onBack, onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        const result = onLogin(username, password);
        if (!result.success) {
            setError(result.message || 'เข้าสู่ระบบไม่สำเร็จ');
            return;
        }

        setError('');
    };

    return (
        <div className="auth-screen">
            <form className="auth-card reveal-up" onSubmit={submit}>
                <h2>เข้าสู่ Admin Portal</h2>
                <p>ระบบ Admin แยกจากพนักงาน (ค่าเริ่มต้น: master / !master)</p>

                <label htmlFor="admin-username">Username</label>
                <input
                    id="admin-username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="master"
                    autoComplete="username"
                />

                <label htmlFor="admin-password">Password</label>
                <input
                    id="admin-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="!master"
                    autoComplete="current-password"
                />

                {error ? <div className="form-error">{error}</div> : null}

                <div className="auth-actions">
                    <button type="button" className="btn-muted" onClick={onBack}>กลับหน้าหลัก</button>
                    <button type="submit" className="btn-primary">เข้าสู่ระบบ</button>
                </div>
            </form>
        </div>
    );
};
