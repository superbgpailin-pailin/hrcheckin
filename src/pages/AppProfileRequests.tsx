import React from 'react';

export const AppProfileRequests: React.FC = () => {
    return (
        <div className="portal-grid reveal-up">
            <section className="panel">
                <div className="panel-head">
                    <h3>คำขอข้อมูลพนักงาน</h3>
                    <span>Direct Save Mode</span>
                </div>

                <div className="result-panel" style={{ textAlign: 'left' }}>
                    <p><strong>ระบบบันทึกข้อมูลพนักงานแบบทันที</strong></p>
                    <p>ข้อมูลที่พนักงานกรอกจากหน้า Employee Form จะถูกบันทึกเข้าโปรไฟล์พนักงานโดยตรง</p>
                    <p>จึงไม่มีรายการ Pending และหน้านี้จะไม่โหลดคำขอจากตารางเดิมอีกต่อไป</p>
                </div>
            </section>
        </div>
    );
};
