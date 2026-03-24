import React from 'react';
import '../styles/darktheme.css'; // Global theme styles

const Layout = ({ children }) => {
  return (
    <div className="app-container">
      {children}
    </div>
  );
};

export default Layout;
