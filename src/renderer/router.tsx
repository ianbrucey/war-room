import { ipcBridge } from '@/common';
import React, { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import AppLoader from './components/AppLoader';
import { useAuth } from './context/AuthContext';
import UserManagement from './pages/admin/UserManagement';
import CaseSelection from './pages/cases/CaseSelection';
import Conversation from './pages/conversation';
import Guid from './pages/guid';
import LoginPage from './pages/login';
import About from './pages/settings/About';
import GeminiSettings from './pages/settings/GeminiSettings';
import ModeSettings from './pages/settings/ModeSettings';
import SystemSettings from './pages/settings/SystemSettings';
import ToolsSettings from './pages/settings/ToolsSettings';
import ComponentsShowcase from './pages/test/ComponentsShowcase';

// Redirect component that goes to latest conversation or guid
const CaseRedirect: React.FC = () => {
  const { caseFileId } = useParams<{ caseFileId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!caseFileId) {
      navigate('/cases', { replace: true });
      return;
    }

    ipcBridge.database.getConversationsByCase
      .invoke({ caseFileId, page: 0, pageSize: 100 })
      .then((conversations) => {
        if (conversations && conversations.length > 0) {
          // Sort by modifyTime to get the most recently active conversation
          const sorted = conversations.sort((a, b) => {
            const aTime = a.modifyTime || a.createTime;
            const bTime = b.modifyTime || b.createTime;
            return bTime - aTime;
          });
          navigate(`/${caseFileId}/conversation/${sorted[0].id}`, { replace: true });
        } else {
          navigate(`/${caseFileId}/guid`, { replace: true });
        }
      })
      .catch(() => {
        navigate(`/${caseFileId}/guid`, { replace: true });
      })
      .finally(() => setLoading(false));
  }, [caseFileId, navigate]);

  if (loading) {
    return <AppLoader />;
  }

  return null;
};

const ProtectedLayout: React.FC<{ layout: React.ReactElement }> = ({ layout }) => {
  const { status } = useAuth();

  if (status === 'checking') {
    return <AppLoader />;
  }

  if (status !== 'authenticated') {
    return <Navigate to='/login' replace />;
  }

  return React.cloneElement(layout);
};

const PanelRoute: React.FC<{ layout: React.ReactElement }> = ({ layout }) => {
  const { status } = useAuth();

  return (
    <HashRouter>
      <Routes>
        <Route path='/login' element={status === 'authenticated' ? <Navigate to='/cases' replace /> : <LoginPage />} />
        <Route element={<ProtectedLayout layout={layout} />}>
          <Route index element={<Navigate to='/cases' replace />} />
          <Route path='/cases' element={<CaseSelection />} />
          <Route path='/:caseFileId' element={<CaseRedirect />} />
          <Route path='/:caseFileId/guid' element={<Guid />} />
          <Route path='/:caseFileId/conversation/:id' element={<Conversation />} />
          <Route path='/settings/gemini' element={<GeminiSettings />} />
          <Route path='/settings/model' element={<ModeSettings />} />
          <Route path='/settings/system' element={<SystemSettings />} />
          <Route path='/settings/about' element={<About />} />
          <Route path='/settings/tools' element={<ToolsSettings />} />
          <Route path='/settings' element={<Navigate to='/settings/gemini' replace />} />
          <Route path='/admin/users' element={<UserManagement />} />
          <Route path='/test/components' element={<ComponentsShowcase />} />
        </Route>
        <Route path='*' element={<Navigate to={status === 'authenticated' ? '/cases' : '/login'} replace />} />
      </Routes>
    </HashRouter>
  );
};

export default PanelRoute;
