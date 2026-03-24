import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/index.css';

const Login = () => {
  const [clientConfig, setClientConfig] = useState({ clientId: null, redirectUri: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadClientConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('/client-config');
      setClientConfig(response.data);
      setLoading(false);
    } catch (err) {
      console.error("Failed to load client config", err);
      setError(err.response?.data?.error || err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClientConfig();
  }, []);

  const handleLogin = () => {
    const { clientId } = clientConfig;
    if (!clientId) {
      alert("Authentication is not configured. Please try again later.");
      return;
    }
    const scope = "repo";
    // We omit redirect_uri to let GitHub use the default one configured in the App settings.
    // prompt=consent forces the user to approve the app again, allowing for "re-authorization" / switching accounts.
    const authorizeUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(
      clientId
    )}&scope=${encodeURIComponent(scope)}&prompt=consent`;

    window.location.href = authorizeUrl;
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Welcome Back!</h1>
        <p>Please log in to continue.</p>
        
        <button 
          id="github-login-btn" 
          className="login-btn" 
          onClick={handleLogin}
          disabled={loading || !!error}
        >
          <i className="fab fa-github"></i> Login with GitHub
        </button>

        {/* Debug information
        <div id="auth-debug" style={{ marginTop: '12px', fontSize: '13px', color: '#9ca3af', wordBreak: 'break-word', textAlign: 'center' }}>
          ...
        </div> 
        */}
      </div>
    </div>
  );
};

export default Login;
