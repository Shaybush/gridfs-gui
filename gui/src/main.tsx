import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from '@src/App';
import { API_GATEWAY_URL } from '@src/common/constants';
import { initHttpClient } from '@src/lib/HttpClient';
import DarkThemeProvider from './providers/DarkThemeProvider';
import './index.css';

initHttpClient(API_GATEWAY_URL);

function Client() {
  return (
    <StrictMode>
      <BrowserRouter>
        <DarkThemeProvider>
          <App />
        </DarkThemeProvider>
      </BrowserRouter>
    </StrictMode>
  );
}

const rootElement = document.getElementById('root')!;
const root = createRoot(rootElement);
root.render(<Client />);
