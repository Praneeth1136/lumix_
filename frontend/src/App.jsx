import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RepoView from './pages/RepoView';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/callback" element={<Dashboard />} />
          <Route path="/files" element={<RepoView />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
