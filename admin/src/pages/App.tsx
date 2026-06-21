import { Page } from '@strapi/strapi/admin';
import { Routes, Route, Navigate } from 'react-router-dom';

// Pages
import { FormsListPage } from './FormsListPage';
import { FormEditPage } from './FormEditPage';
import { SubmissionsListPage } from './SubmissionsListPage';
import { SubmissionDetailPage } from './SubmissionDetailPage';
import { PERMISSIONS } from '../permissions';

const App = () => {
  return (
    <Page.Protect permissions={PERMISSIONS.main}>
      <Routes>
        {/* Forms */}
        <Route index element={<FormsListPage />} />
        <Route path="forms" element={<FormsListPage />} />
        <Route path="forms/create" element={<FormEditPage />} />
        <Route path="forms/:id/edit" element={<FormEditPage />} />
        {/* Bare form route -> redirect to the editor (avoids the error page) */}
        <Route path="forms/:id" element={<Navigate to="edit" replace />} />

        {/* Submissions */}
        <Route path="forms/:formId/submissions" element={<SubmissionsListPage />} />
        <Route path="submissions/:id" element={<SubmissionDetailPage />} />

        {/* Fallback */}
        <Route path="*" element={<Page.Error />} />
      </Routes>
    </Page.Protect>
  );
};

export { App };
