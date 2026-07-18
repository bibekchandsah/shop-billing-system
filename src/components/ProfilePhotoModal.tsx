import React, { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './ProfilePhotoModal.css';

interface ProfilePhotoModalProps {
  onClose: () => void;
}

const ProfilePhotoModal: React.FC<ProfilePhotoModalProps> = ({ onClose }) => {
  const { user, updatePhoto, removePhoto, updateDisplayName, photoData } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.displayName || user?.email?.split('@')[0] || '');

  const getInitials = () => {
    if (user?.displayName)
      return user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    return user?.email?.[0].toUpperCase() ?? '?';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setSuccess('');

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, GIF, WebP, etc.)');
      return;
    }
    // Firestore 1 MB doc limit: base64 adds ~33%, so max raw = ~700 KB
    if (file.type === 'image/gif' && file.size > 700 * 1024) {
      setError('Animated images must be smaller than 700 KB (Firestore limit).');
      return;
    }
    if (file.type !== 'image/gif' && file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5 MB.');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError('');
    try {
      await updatePhoto(selectedFile);
      setSuccess('Profile photo updated!');
      setPreview(null);
      setSelectedFile(null);
      setTimeout(onClose, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to upload photo.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('Remove your profile photo?')) return;
    setLoading(true);
    setError('');
    try {
      await removePhoto();
      setSuccess('Profile photo removed.');
      setTimeout(onClose, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to remove photo.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveName = async () => {
    if (!newName.trim()) {
      setError('Display name cannot be empty.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await updateDisplayName(newName.trim());
      setSuccess('Display name updated!');
      setIsEditingName(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update name.');
    } finally {
      setLoading(false);
    }
  };

  // Use preview (newly selected) → custom photoData → Google photoURL → null
  const currentPhoto = preview || photoData || user?.photoURL || null;

  return (
    <div className="ppm-overlay" onClick={onClose}>
      <div className="ppm-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="ppm-header">
          <h2>Profile Photo</h2>
          <button className="ppm-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Avatar preview */}
        <div className="ppm-avatar-area">
          {currentPhoto ? (
            <img src={currentPhoto} alt="Profile" className="ppm-avatar-img" referrerPolicy="no-referrer" />
          ) : (
            <div className="ppm-avatar-initials">{getInitials()}</div>
          )}

          {/* Camera overlay button */}
          <button
            className="ppm-camera-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Choose photo"
            disabled={loading}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>
        </div>

        {/* User info */}
        <div className="ppm-user-info">
          {isEditingName ? (
            <div className="ppm-name-edit">
              <input 
                type="text" 
                className="form-input ppm-name-input"
                value={newName} 
                onChange={e => setNewName(e.target.value)}
                disabled={loading}
                autoFocus
              />
              <button 
                className="btn btn-primary btn-sm"
                onClick={handleSaveName}
                disabled={loading}
              >
                Save
              </button>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setIsEditingName(false);
                  setNewName(user?.displayName || user?.email?.split('@')[0] || '');
                }}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="ppm-name-display">
              <p className="ppm-name">{user?.displayName || user?.email?.split('@')[0]}</p>
              <button 
                className="ppm-edit-name-btn"
                onClick={() => setIsEditingName(true)}
                title="Edit name"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </svg>
              </button>
            </div>
          )}
          <p className="ppm-email">{user?.email}</p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="ppm-alert ppm-alert-error">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {error}
          </div>
        )}
        {success && (
          <div className="ppm-alert ppm-alert-success">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            {success}
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* Actions */}
        <div className="ppm-actions">
          <button
            className="btn btn-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {selectedFile ? 'Change Photo' : 'Upload Photo'}
          </button>

          {selectedFile && (
            <button
              className="btn btn-success"
              onClick={handleUpload}
              disabled={loading}
            >
              {loading ? (
                <span className="ppm-spinner" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {loading ? 'Saving...' : 'Save Photo'}
            </button>
          )}

          {(photoData || user?.photoURL) && !selectedFile && (
            <button
              className="btn btn-danger"
              onClick={handleRemove}
              disabled={loading}
            >
              {loading ? <span className="ppm-spinner" /> : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              )}
              Remove Photo
            </button>
          )}
        </div>

        <p className="ppm-hint">JPG, PNG, WebP · Max 5 MB &nbsp;·&nbsp; GIF / Animated PNG · Max 700 KB</p>
      </div>
    </div>
  );
};

export default ProfilePhotoModal;
