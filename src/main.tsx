import { Component, ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class GlobalErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error(
      '[IOS-RUNTIME-ERROR]\n' +
      'message: ' + error.message + '\n' +
      'file: N/A\n' +
      'line: N/A\n' +
      'column: N/A\n' +
      'stack:\n' + (error.stack || 'N/A') + '\n' +
      'componentStack:\n' + (errorInfo?.componentStack || 'N/A')
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '24px', color: '#fff', backgroundColor: '#090D16', minHeight: '100vh', fontFamily: 'sans-serif' }}>
          <h2 style={{ color: '#F87171', fontSize: '18px', marginBottom: '8px' }}>Tətbiq xətası baş verdi</h2>
          <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', color: '#CBD5E1' }}>{this.state.error?.stack || this.state.error?.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('[IOS-RUNTIME-ERROR]\nmessage: #root element not found in DOM\nfile: main.tsx\nline: N/A\ncolumn: N/A\nstack: N/A');
  } else {
    createRoot(rootElement).render(
      <StrictMode>
        <GlobalErrorBoundary>
          <App />
        </GlobalErrorBoundary>
      </StrictMode>
    );
  }
} catch (err: any) {
  console.error(
    '[IOS-RUNTIME-ERROR]\n' +
    'message: ' + (err?.message || String(err)) + '\n' +
    'file: main.tsx\n' +
    'line: N/A\n' +
    'column: N/A\n' +
    'stack:\n' + (err?.stack || 'N/A')
  );
}
