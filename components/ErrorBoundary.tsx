import React, { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// FIX: Explicitly extend React.Component to ensure correct type inheritance for state and props.
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // FIX: Initialize state as a class property, which is a more modern and safer syntax
  // than using the constructor for basic state setup. This resolves the error where `this.state`
  // was not recognized in the constructor.
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error: error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    // FIX: All errors about missing `setState`, `state`, and `props` are resolved by
    // correctly extending React.Component, making its methods and properties available on `this`.
    this.setState({
      error: error,
      errorInfo: errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div style={{ padding: '20px', textAlign: 'center', border: '1px solid red', borderRadius: '8px', margin: '20px', backgroundColor: '#ffe6e6' }}>
          <h2 style={{ color: 'red' }}>Oops! Something went wrong.</h2>
          <p>We're sorry for the inconvenience. Please try refreshing the page.</p>
          {this.state.error && (
            <details style={{ whiteSpace: 'pre-wrap', textAlign: 'left', margin: '20px auto', maxWidth: '600px', backgroundColor: '#fff', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Error Details</summary>
              <p>{this.state.error.toString()}</p>
              <br />
              {this.state.errorInfo?.componentStack}
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
