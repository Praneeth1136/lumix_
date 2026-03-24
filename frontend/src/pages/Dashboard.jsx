import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/callback.css';
import FileModal from '../components/FileModal';

const Dashboard = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [repos, setRepos] = useState([]); // All fetched repos
  const [displayedResults, setDisplayedResults] = useState([]); // Results to show (repos or files)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Search States
  const [repoSearchQuery, setRepoSearchQuery] = useState('');
  const [aiSearchQuery, setAiSearchQuery] = useState('');
  const [aiSearching, setAiSearching] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      // Exchange code for token
      axios.get(`/get-repos?code=${code}`)
        .then(response => {
          const { userData, reposData } = response.data;
          setUserData(userData);
          setRepos(reposData);
          setDisplayedResults(reposData.map(r => ({ type: 'repo', data: r })));
          setLoading(false);
          // Clean URL
          window.history.replaceState({}, document.title, "/callback");
        })
        .catch(err => {
          console.error(err);
          setError("Failed to authenticate or fetch repositories.");
          setLoading(false);
        });
    } else {
        // Here we might check if user is already authenticated (e.g. cookie or backend session)
        // For now, if no code, we might redirect to login or show error?
        // But if we are developing and just refreshed, state is lost unless we persist it.
        // The original App didn't seem to have persistence in client side JS explicitly shown (except for 'check-auth' comment).
        // I'll assume we need to re-login if no session.
        setError("No authorization code found. Please login again.");
        setLoading(false);
    }
  }, [searchParams]);

  // Filter Repos locally
  useEffect(() => {
    if (!aiSearchQuery && repos.length > 0) {
        const filtered = repos.filter(repo => 
            repo.name.toLowerCase().includes(repoSearchQuery.toLowerCase())
        );
        setDisplayedResults(filtered.map(r => ({ type: 'repo', data: r })));
    }
  }, [repoSearchQuery, repos, aiSearchQuery]);

  const handleAiSearch = async () => {
    if (!aiSearchQuery) return;
    setAiSearching(true);
    try {
      const response = await axios.post('/ai-search', { query: aiSearchQuery });
      setDisplayedResults(response.data.results);
    } catch (err) {
      console.error(err);
      alert("AI Search failed");
    } finally {
      setAiSearching(false);
    }
  };

  const handleShowAll = () => {
      setAiSearchQuery('');
      setRepoSearchQuery('');
      setDisplayedResults(repos.map(r => ({ type: 'repo', data: r })));
  };

  const getLanguageColor = (language) => {
    if (!language) return "#cccccc";
    let hash = 0;
    for (let i = 0; i < language.length; i++) {
        hash = language.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = "#";
    for (let i = 0; i < 3; i++) {
        const value = (hash >> (i * 8)) & 0xff;
        color += ("00" + value.toString(16)).substr(-2);
    }
    return color;
  };

  const handleSignOut = () => {
    // Clear any local state/session if we were storing it (e.g. localStorage)
    // We use window.location.href to FORCE a full page reload, ensuring all React state is wiped.
    // This is safer than navigate('/') for a true "Sign Out" experience.
    setUserData(null);
    setRepos([]);
    window.location.href = '/';
  };

  const openFile = (fileData) => {
      setSelectedFile({
          owner: fileData.repo.owner.login || fileData.repo.owner.name || userData.login, // fallback logic
          repo: fileData.repo.name,
          path: fileData.path,
          sha: fileData.sha
      });
      setModalOpen(true);
  }

  const navigateToRepo = (owner, repoName) => {
      navigate(`/files?owner=${owner}&repo=${repoName}`);
  };

  if (loading) return <div className="loader-overlay"><div className="spinner"></div></div>;
  if (error) return (
    <div className="main-container">
        <p style={{color: 'red', textAlign: 'center', marginTop: '50px'}}>{error}</p>
        <div style={{textAlign: 'center', marginTop: '20px'}}>
            <button className="action-button" onClick={() => navigate('/')}>Back to Login</button>
        </div>
    </div>
  );

  return (
    <div className="main-container">
      <button className="back-button" onClick={() => navigate('/')}>
        <i className="fa-solid fa-arrow-left"></i> Back
      </button>

      {userData && (
        <div className="profile-container" id="profile-section">
            <div className="profile-header">
                <img id="user-avatar" className="profile-avatar" src={userData.avatar_url} alt="User Avatar" />
                <div className="profile-names">
                    <h2 id="user-display-name">{userData.name || userData.login}</h2>
                    <p id="user-username">@{userData.login}</p>
                    {userData.bio && <p id="user-bio">{userData.bio}</p>}
                </div>
            </div>

            <div className="profile-stats">
                <div className="stat-box">
                    <span className="stat-value">{userData.public_repos}</span>
                    <span className="stat-label">REPOSITORIES</span>
                </div>
                <div className="stat-box">
                    <span className="stat-value">{userData.followers}</span>
                    <span className="stat-label">FOLLOWERS</span>
                </div>
                <div className="stat-box">
                    <span className="stat-value">{userData.following}</span>
                    <span className="stat-label">FOLLOWING</span>
                </div>
            </div>

            <div className="profile-actions">
                <button className="sign-out-btn" onClick={handleSignOut}>
                    <i className="fa-solid fa-arrow-right-from-bracket"></i> Sign out
                </button>
            </div>
        </div>
      )}

      <div className="page-header">Repositories</div>

      <div className="search-section">
        <div className="search-group">
          <input
            type="text"
            id="repo-search-bar"
            placeholder="Find a repository..."
            value={repoSearchQuery}
            onChange={(e) => setRepoSearchQuery(e.target.value)}
          />
        </div>
        <div className="search-group">
          <input
            type="text"
            id="ai-search-bar"
            placeholder="AI Search: 'the css file in my portfolio'..."
            value={aiSearchQuery}
            onChange={(e) => setAiSearchQuery(e.target.value)}
          />
        </div>
        <div className="action-buttons">
          <button 
            id="ai-search-button" 
            className="action-button"
            onClick={handleAiSearch}
            disabled={aiSearching}
          >
            {aiSearching ? "Thinking..." : <><i className="fa-solid fa-wand-magic-sparkles"></i> AI Search</>}
          </button>
          
          {(aiSearchQuery || repoSearchQuery) && (
              <button
                id="show-all-button"
                className="action-button"
                style={{display: 'inline-flex'}}
                onClick={handleShowAll}
            >
                <i className="fa-solid fa-list"></i> Show All
            </button>
          )}
        </div>
      </div>

      <div id="results-container">
        {displayedResults.length === 0 ? (
            <p>No results found.</p>
        ) : (
            <ul id="results-list">
                {displayedResults.map((item, index) => {
                    if (item.type === 'repo') {
                        const repo = item.data;
                        const updatedDate = new Date(repo.updated_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
                        const visibility = repo.private ? "Private" : "Public";
                        return (
                            <li key={repo.id || index} className="result-card">
                                <div className="repo-info">
                                    <div className="repo-name">
                                        <span 
                                            onClick={() => navigateToRepo(repo.owner.login, repo.name)}
                                            style={{cursor: 'pointer', color: 'var(--primary-color)', fontWeight: 'bold'}}
                                        >
                                            {repo.name}
                                        </span>
                                        <span className="repo-visibility-badge">{visibility}</span>
                                    </div>
                                    <div className="repo-meta">
                                        {repo.language && (
                                            <span className="stat-item">
                                                <span className="language-color-dot" style={{backgroundColor: getLanguageColor(repo.language)}}></span>
                                                {repo.language}
                                            </span>
                                        )}
                                        <span className="stat-item">Updated on {updatedDate}</span>
                                    </div>
                                </div>
                                <div className="repo-actions">
                                    <button className="star-btn"><i className="fa-regular fa-star"></i> Star</button>
                                </div>
                            </li>
                        );
                    } else if (item.type === 'file') {
                        const file = item.data;
                        return (
                            <li key={index} className="result-card file-card">
                                <div className="repo-info">
                                    <div className="repo-name">
                                        <a onClick={() => openFile(file)} style={{cursor: 'pointer'}}>
                                            <i className="fa-solid fa-file-code"></i> {file.name}
                                        </a>
                                    </div>
                                    <div className="repo-meta">
                                        In repo: <strong>{file.repo.name}</strong>
                                        <div className="file-path">{file.path}</div>
                                    </div>
                                </div>
                            </li>
                        );
                    }
                    return null;
                })}
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

export default Dashboard;
