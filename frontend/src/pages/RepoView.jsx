import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/files.css';
import FileModal from '../components/FileModal';
import { Link } from 'react-router-dom';

const RepoView = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const owner = searchParams.get('owner');
  const repoName = searchParams.get('repo');
  const path = searchParams.get('path') || '';

  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    if (!owner || !repoName) {
        setError("Repository owner and name are required.");
        setLoading(false);
        return;
    }
    fetchContents();
  }, [owner, repoName, path]);

  const fetchContents = async () => {
    setLoading(true);
    setError(null);
    try {
        const response = await axios.get('/get-repo-contents', {
            params: { owner, repo: repoName, path }
        });
        const sorted = response.data.sort((a, b) => 
            (a.type === b.type) ? a.name.localeCompare(b.name) : (a.type === 'dir' ? -1 : 1)
        );
        setContents(sorted);
    } catch (err) {
        console.error("Error fetching contents:", err);
        setError(`Failed to fetch repository contents: ${err.response?.statusText || err.message}`);
    } finally {
        setLoading(false);
    }
  };

  const Breadcrumbs = () => {
      const parts = path.split('/').filter(p => p);
      let currentPath = '';
      return (
          <div id="breadcrumbs">
              <Link to={`/files?owner=${owner}&repo=${repoName}&path=`}>{repoName}</Link> / 
              {parts.map((part, index) => {
                  currentPath += part + '/';
                  const isLast = index === parts.length - 1;
                  // Remove trailing slash for the link
                  const linkPath = currentPath.slice(0, -1);
                  return (
                      <span key={index}>
                          {' '}
                          {isLast ? (
                              <span>{part}</span>
                          ) : (
                              <Link to={`/files?owner=${owner}&repo=${repoName}&path=${linkPath}`}>{part}</Link>
                          )}
                          {' / '}
                      </span>
                  );
              })}
          </div>
      );
  };

  const handleItemClick = (item) => {
      if (item.type === 'dir') {
          navigate(`/files?owner=${owner}&repo=${repoName}&path=${item.path}`);
      } else {
        setSelectedFile({
            owner,
            repo: repoName,
            path: item.path,
            sha: item.sha
        });
        setModalOpen(true);
      }
  };

  return (
    <div className="container">
      <button className="back-button" onClick={() => navigate(-1)}>
        <i className="fa-solid fa-arrow-left"></i> Back
      </button>

      <h2 id="repo-title">{owner} / {repoName}</h2>
      
      <Breadcrumbs />

      <div id="file-container">
        {loading ? (
            <p><i className="fa fa-spinner fa-spin"></i> Loading files...</p>
        ) : error ? (
            <p style={{color: '#ff8a8a'}}>{error}</p>
        ) : (
            <ul id="file-list">
                {contents.map(item => (
                    <li key={item.sha} onClick={() => handleItemClick(item)} className="file-item">
                        <span className="icon">
                            <i className={`fa-solid ${item.type === 'dir' ? 'fa-folder' : 'fa-file-lines'}`}></i>
                        </span>
                        <span>{item.name}</span>
                    </li>
                ))}
            </ul>
        )}
      </div>

      <FileModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        fileData={selectedFile}
      />
    </div>
  );
};

export default RepoView;
