import { useState } from 'react';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { SiteProvider } from './context/SiteContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { EmployeeProvider } from './context/EmployeeContext';
import { HolidayProvider } from './context/HolidayContext';
import { LeaveProvider } from './context/LeaveContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { LeaveRequest } from './pages/LeaveRequest';
import { Employees } from './pages/Employees';
import { SiteManagement } from './pages/SiteManagement';
import { Settings } from './pages/Settings';
import { LandingPage } from './pages/LandingPage';
import { AdminLogin } from './pages/AdminLogin';
import { AdminAttendance } from './pages/AdminAttendance';

import { EmployeeLayout } from './components/EmployeeLayout';
import { CheckInFlow } from './pages/CheckInFlow';
import { ProfileFlow } from './pages/ProfileFlow';
import { HistoryFlow } from './pages/HistoryFlow';
import { HolidayAdmin } from './pages/HolidayAdmin';
import { HolidaySelection } from './pages/HolidaySelection';
import { MonthlySummary } from './pages/MonthlySummary';
import { HistoryAndHoliday } from './pages/HistoryAndHoliday';
import { EmployeeLeaveRequest } from './pages/EmployeeLeaveRequest';

// Placeholder (Fallback)
const Placeholder = ({ title }: { title: string }) => (
  <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
    <h2>{title}</h2>
    <p>Page Not Found or Under Construction</p>
  </div>
);

const AppContent = () => {
  // Default to Landing Page
  const [currentPage, setCurrentPage] = useState('landing');
  const { currentUser } = useAuth();

  // Pages that don't need the Sidebar Layout
  if (currentPage === 'landing') {
    return <LandingPage onNavigate={setCurrentPage} />;
  }

  if (currentPage === 'admin-login') {
    return <AdminLogin onNavigate={setCurrentPage} />;
  }

  // Employee Pages (Standalone Layout)
  // Holiday Selection (Standalone)  
  if (currentPage === 'holidaySelection') {
    return <HolidaySelection />;
  }

  // Combined History and Holiday page
  if (currentPage === 'historyHoliday') {
    return <HistoryAndHoliday onBack={() => setCurrentPage('landing')} />;
  }

  // Employee Leave Request page
  if (currentPage === 'employeeLeave') {
    return <EmployeeLeaveRequest onBack={() => setCurrentPage('landing')} />;
  }

  if (['timeAttendance', 'myProfile', 'history'].includes(currentPage)) {
    // Map page ID to title key
    const titleMap: Record<string, string> = {
      timeAttendance: 'checkIn',
      myProfile: 'profile',
      history: 'history'
    };

    return (
      <EmployeeLayout onNavigate={setCurrentPage} titleKey={titleMap[currentPage]}>
        {currentPage === 'timeAttendance' && <CheckInFlow onBack={() => setCurrentPage('landing')} />}
        {currentPage === 'myProfile' && <ProfileFlow />}
        {currentPage === 'history' && <HistoryFlow />}
      </EmployeeLayout>
    );
  }

  // Admin Pages (Dashboard Layout)
  const renderAdminPage = () => {
    // Basic Gatekeeper
    if (!currentUser || currentUser.role !== 'Admin') {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
          <h2>⛔ Access Denied</h2>
          <p>Only Administrators can access the backend.</p>
          <button onClick={() => setCurrentPage('landing')} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
            Back to Home
          </button>
        </div>
      );
    }

    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'adminAttendance': return <AdminAttendance />;
      case 'employees': return <Employees />;
      case 'leaveRequest': return <LeaveRequest />; // Admin likely wants to see requests here too?
      case 'siteManagement': return <SiteManagement />;
      case 'settings': return <Settings />;
      case 'holidayAdmin': return <HolidayAdmin />;
      case 'monthlySummary': return <MonthlySummary />;
      default: return <Placeholder title="Page Not Found" />;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderAdminPage()}
    </Layout>
  );
};

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <SiteProvider>
          <SettingsProvider>
            <EmployeeProvider>
              <HolidayProvider>
                <LeaveProvider>
                  <AuthProvider>
                    <AppContent />
                  </AuthProvider>
                </LeaveProvider>
              </HolidayProvider>
            </EmployeeProvider>
          </SettingsProvider>
        </SiteProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
