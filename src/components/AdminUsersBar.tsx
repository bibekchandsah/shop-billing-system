import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { createPortal } from 'react-dom';
import './AdminUsersBar.css';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoData: string | null;
}

const AdminUsersBar: React.FC = () => {
  const { user, isAdmin, activeUid, viewUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [hoveredUser, setHoveredUser] = useState<{
    displayName: string;
    email: string;
    rect: DOMRect;
  } | null>(null);

  useEffect(() => {
    setPortalTarget(document.getElementById('admin-banner-root'));
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    
    const fetchUsers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const fetchedUsers: UserProfile[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          fetchedUsers.push({
            uid: doc.id,
            email: data.email || 'No Email',
            displayName: data.displayName || 'Unknown User',
            photoData: data.photoData || null,
          });
        });
        setUsers(fetchedUsers);
      } catch (error) {
        console.error("Error fetching users for admin bar:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [isAdmin]);

  if (!isAdmin) return null;

  return (
    <>
      <div className="admin-users-bar-container">
        {/* Self Avatar */}
        <div 
          className={`admin-user-avatar admin-self-avatar ${activeUid === user?.uid ? 'viewing-active' : ''}`}
          onClick={() => viewUser(null)}
          onMouseEnter={(e) => {
            setHoveredUser({
              displayName: 'Admin (Me)',
              email: user?.email || '',
              rect: e.currentTarget.getBoundingClientRect()
            });
          }}
          onMouseLeave={() => setHoveredUser(null)}
        >
          {user?.photoURL ? (
            <img src={user.photoURL} alt="Admin" />
          ) : (
            <span style={{ fontSize: '18px' }}>ME</span>
          )}
        </div>

        {/* Other Users */}
        {!loading && users.map((u) => {
          if (u.uid === user?.uid) return null;
          
          const isViewing = activeUid === u.uid;
          
          return (
            <div 
              key={u.uid} 
              className={`admin-user-avatar ${isViewing ? 'viewing-active' : ''}`}
              onClick={() => viewUser(u.uid)}
              onMouseEnter={(e) => {
                setHoveredUser({
                  displayName: u.displayName,
                  email: u.email,
                  rect: e.currentTarget.getBoundingClientRect()
                });
              }}
              onMouseLeave={() => setHoveredUser(null)}
            >
              {u.photoData ? (
                <img src={u.photoData} alt={u.displayName} />
              ) : (
                <span style={{ fontSize: '18px' }}>
                  {u.displayName.substring(0, 2)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {hoveredUser && createPortal(
        <div 
          className="admin-tooltip-portal" 
          style={{
            top: hoveredUser.rect.bottom + 14,
            left: hoveredUser.rect.left + hoveredUser.rect.width / 2,
            transform: 'translateX(-50%)'
          }}
        >
          <div className="tt-name">{hoveredUser.displayName}</div>
          <div className="tt-email">{hoveredUser.email}</div>
        </div>,
        document.body
      )}

      {activeUid !== user?.uid && portalTarget && createPortal(
        <div className="admin-viewing-banner" style={{ display: 'none'}}>
          <div className="admin-viewing-text">
            You are viewing data for user: {users.find(u => u.uid === activeUid)?.email || activeUid}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              className="btn btn-primary btn-sm"
              style={{ fontSize: '12px', padding: '4px 10px' }}
              onClick={() => viewUser(null)}
            >
              Back to My Data
            </button>
            <button
              onClick={() => viewUser(null)}
              style={{ background: 'none', border: 'none', color: 'var(--secondary)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
              aria-label="Close"
              title="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>,
        portalTarget
      )}
    </>
  );
};

export default AdminUsersBar;
