import React, { useState, useEffect } from 'react';
import axios from 'axios';

const FileModal = ({ isOpen, onClose, fileData }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [committing, setCommitting] = useState(false);
  const [commitStatus, setCommitStatus] = useState('');
  const [currentSha, setCurrentSha] = useState(null);
  const [isImage, setIsImage] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);

  useEffect(() => {
    if (isOpen && fileData) {
      loadFile();
    }
  }, [isOpen, fileData]);

  const loadFile = async () => {
    setLoading(true);
    setError(null);
    setCommitStatus('');
    setCommitMessage(`Update ${fileData.path.split('/').pop()}`);
    setCurrentSha(fileData.sha);
    
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
    const isImg = imageExtensions.some(ext => fileData.path.toLowerCase().endsWith(ext));
    setIsImage(isImg);

    try {
      const response = await axios.get('/get-file-content', {
        params: {
          owner: fileData.owner,
          repo: fileData.repo,
          path: fileData.path
        },
        responseType: isImg ? 'blob' : 'text'
      });

      if (isImg) {
        setImageUrl(URL.createObjectURL(response.data));
        setContent(null);
      } else {
        setContent(response.data);
        setImageUrl(null);
      }
    } catch (err) {
        console.error("Error loading file", err);
        setError("Failed to load file content.");
    } finally {
        setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!currentSha) {
        setError("Cannot commit: Missing file SHA.");
        return;
    }
    setCommitting(true);
    setCommitStatus('Committing...');
    try {
      const response = await axios.post('/commit-file', {
        owner: fileData.owner,
        repo: fileData.repo,
        path: fileData.path,
        message: commitMessage,
        content: content,
        sha: currentSha
      });
      
      if (response.data.success) {
          setCommitStatus('✅ Committed successfully!');
          setCurrentSha(response.data.data.content.sha); // Update SHA for next commit
          setTimeout(() => {
              onClose(); 
              setCommitStatus('');
          }, 1500);
      }
    } catch (err) {
      console.error("Commit failed", err);
      setCommitStatus(`Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setCommitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay show" onClick={(e) => { if(e.target.className.includes('modal-overlay')) onClose(); }}>
      <div className="modal-content">
        <div className="modal-header">
          <h3><span id="modal-filename">{fileData?.path.split('/').pop()}</span></h3>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>
        
        <div className="modal-body">
          {loading ? (
             <p style={{padding: '20px', textAlign: 'center'}}>Loading file...</p>
          ) : error ? (
             <p style={{padding: '20px', color: 'red', textAlign: 'center'}}>{error}</p>
          ) : isImage ? (
             <img src={imageUrl} alt="File content" style={{maxWidth: '100%', display: 'block', margin: 'auto'}} />
          ) : (
            <textarea 
              id="file-editor" 
              spellCheck="false" 
              value={content || ''}
              onChange={(e) => setContent(e.target.value)}
            />
          )}
        </div>

        {!isImage && !loading && !error && (
            <div className="modal-footer">
            <input 
                type="text" 
                id="commit-message" 
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Update file" 
            />
            <button 
                id="commit-button" 
                onClick={handleCommit}
                disabled={committing}
            >
                {committing ? "Committing..." : "Commit Changes"}
            </button>
            <span id="commit-status">{commitStatus}</span>
            </div>
        )}
      </div>
    </div>
  );
};

export default FileModal;
