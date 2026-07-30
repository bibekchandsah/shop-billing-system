import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  orderBy,
  Timestamp,
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';

export interface DeviceSession {
  id: string;
  userId: string;
  deviceName: string;
  browser: string;
  os: string;
  ipAddress: string;
  lastActive: Date;
  createdAt: Date;
  userAgent: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generate a unique session ID */
const generateSessionId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
};

/** Parse user agent string to extract browser and OS info */
const parseUserAgent = (userAgent: string) => {
  // Browser detection
  let browser = 'Unknown';
  if (userAgent.includes('Firefox/')) browser = 'Firefox';
  else if (userAgent.includes('Edg/')) browser = 'Edge';
  else if (userAgent.includes('Chrome/')) browser = 'Chrome';
  else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) browser = 'Safari';
  else if (userAgent.includes('Opera/') || userAgent.includes('OPR/')) browser = 'Opera';

  // OS detection
  let os = 'Unknown';
  if (userAgent.includes('Windows NT 10.0')) os = 'Windows 10/11';
  else if (userAgent.includes('Windows NT 6.3')) os = 'Windows 8.1';
  else if (userAgent.includes('Windows NT 6.2')) os = 'Windows 8';
  else if (userAgent.includes('Windows NT 6.1')) os = 'Windows 7';
  else if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac OS X')) {
    const match = userAgent.match(/Mac OS X ([0-9_]+)/);
    os = match ? `macOS ${match[1].replace(/_/g, '.')}` : 'macOS';
  }
  else if (userAgent.includes('Android')) {
    const match = userAgent.match(/Android ([0-9.]+)/);
    os = match ? `Android ${match[1]}` : 'Android';
  }
  else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    const match = userAgent.match(/OS ([0-9_]+)/);
    os = match ? `iOS ${match[1].replace(/_/g, '.')}` : 'iOS';
  }
  else if (userAgent.includes('Linux')) os = 'Linux';

  // Device name
  let deviceName = `${os} - ${browser}`;
  if (userAgent.includes('Mobile')) deviceName += ' (Mobile)';
  else if (userAgent.includes('Tablet')) deviceName += ' (Tablet)';

  return { browser, os, deviceName };
};

/** Get approximate IP address (using a public API) */
const getIpAddress = async (): Promise<string> => {
  try {
    const response = await fetch('https://api.ipify.org?format=json', { 
      signal: AbortSignal.timeout(3000) 
    });
    const data = await response.json();
    return data.ip || 'Unknown';
  } catch {
    return 'Unknown';
  }
};

// ── Session Management ────────────────────────────────────────────────────────

/** Create a new session when user logs in */
export const createSession = async (userId: string): Promise<string> => {
  const sessionId = generateSessionId();
  const userAgent = navigator.userAgent;
  const { browser, os, deviceName } = parseUserAgent(userAgent);
  const ipAddress = await getIpAddress();
  
  const sessionData = {
    userId,
    deviceName,
    browser,
    os,
    ipAddress,
    userAgent,
    lastActive: Timestamp.now(),
    createdAt: Timestamp.now(),
  };

  const sessionRef = doc(db, 'users', userId, 'sessions', sessionId);
  await setDoc(sessionRef, sessionData);
  
  // Store session ID in localStorage to identify current session
  localStorage.setItem('currentSessionId', sessionId);
  
  return sessionId;
};

/** Update session last active timestamp */
export const updateSessionActivity = async (userId: string, sessionId: string): Promise<void> => {
  try {
    const sessionRef = doc(db, 'users', userId, 'sessions', sessionId);
    await updateDoc(sessionRef, {
      lastActive: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating session activity:', error);
  }
};

/** Get all active sessions for a user */
export const getUserSessions = async (userId: string): Promise<DeviceSession[]> => {
  const sessionsRef = collection(db, 'users', userId, 'sessions');
  const q = query(sessionsRef, orderBy('lastActive', 'desc'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => {
    const data = doc.data();
    
    // Helper to safely parse dates that might be Timestamps, strings, or missing
    const parseDate = (val: any): Date => {
      if (!val) return new Date();
      if (typeof val.toDate === 'function') return val.toDate();
      if (val instanceof Date) return val;
      if (val.seconds) return new Date(val.seconds * 1000);
      return new Date(val);
    };

    return {
      id: doc.id,
      userId: data.userId,
      deviceName: data.deviceName,
      browser: data.browser,
      os: data.os,
      ipAddress: data.ipAddress,
      lastActive: parseDate(data.lastActive),
      createdAt: parseDate(data.createdAt),
      userAgent: data.userAgent,
    };
  });
};

/** Revoke a specific session */
export const revokeSession = async (userId: string, sessionId: string): Promise<void> => {
  const sessionRef = doc(db, 'users', userId, 'sessions', sessionId);
  await deleteDoc(sessionRef);
};

/** Revoke all sessions except the current one */
export const revokeOtherSessions = async (userId: string, currentSessionId: string): Promise<void> => {
  const sessions = await getUserSessions(userId);
  const deletePromises = sessions
    .filter(session => session.id !== currentSessionId)
    .map(session => revokeSession(userId, session.id));
  
  await Promise.all(deletePromises);
};

/** Revoke all sessions (used when password is changed) */
export const revokeAllSessions = async (userId: string): Promise<void> => {
  const sessionsRef = collection(db, 'users', userId, 'sessions');
  const snapshot = await getDocs(sessionsRef);
  
  const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
  await Promise.all(deletePromises);
  
  // Clear current session ID from localStorage
  localStorage.removeItem('currentSessionId');
};

/** Get current session ID from localStorage */
export const getCurrentSessionId = (): string | null => {
  return localStorage.getItem('currentSessionId');
};

/** Check if current session is valid */
export const isCurrentSessionValid = async (userId: string): Promise<boolean> => {
  const currentSessionId = getCurrentSessionId();
  if (!currentSessionId) return false;
  
  try {
    const sessions = await getUserSessions(userId);
    return sessions.some(session => session.id === currentSessionId);
  } catch (error) {
    console.warn('Error validating session, assuming valid to prevent false logouts:', error);
    return true;
  }
};
