
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// 21st.dev Toolbar - Only initialize in development mode
if (import.meta.env.MODE === 'development') {
  import('@21st-extension/toolbar-react').then(({ initToolbar }) => {
    initToolbar({
      plugins: [],
    });
  }).catch(console.error);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
