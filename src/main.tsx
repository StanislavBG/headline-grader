import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { HeadlineGraderPage } from './HeadlineGraderPage.js';
import './index.css';

const CLERK_KEY =
  (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined) ??
  'pk_live_Y2xlcmsuYmlsa28ucnVuJA';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={CLERK_KEY}>
      <HeadlineGraderPage />
    </ClerkProvider>
  </React.StrictMode>,
);
