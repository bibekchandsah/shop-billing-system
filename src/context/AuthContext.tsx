import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  type User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { 
  createSession, 
  revokeAllSessions, 
  getCurrentSessionId,
  updateSessionActivity,
  isCurrentSessionValid
} from '../services/sessionService';

// ── Types ─────────────────────────────────────────────────────────────────────
interface AuthContextType {
  user: User | null;
  /** Base64 data-URL of the user's custom photo, or null */
  photoData: string | null;
  loading: boolean;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updatePhoto: (file: File) => Promise<void>;
  removePhoto: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
  isAdmin: boolean;
  activeUid: string | null;
  viewUser: (uid: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const googleProvider = new GoogleAuthProvider();

// ── Helpers ───────────────────────────────────────────────────────────────────
/** Read file as a base64 data-URL */
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/** Resize + compress a STATIC image to keep Firestore doc small (≤ ~200 KB) */
const compressImage = (dataUrl: string, maxPx = 256, quality = 0.8): Promise<string> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width  * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });

/**
 * Detect whether a file is animated (GIF, APNG, animated WebP).
 * We check the raw bytes — canvas can't preserve animation so we skip
 * compression for any animated format.
 */
const isAnimated = async (file: File): Promise<boolean> => {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);

  // GIF: look for more than one Graphics Control Extension (0x21 0xF9)
  if (file.type === 'image/gif') {
    let count = 0;
    for (let i = 0; i < bytes.length - 1; i++) {
      if (bytes[i] === 0x21 && bytes[i + 1] === 0xF9) {
        count++;
        if (count > 1) return true;
      }
    }
    return false;
  }

  // APNG: look for 'acTL' chunk (animation control)
  if (file.type === 'image/png' || file.type === 'image/apng') {
    const str = new TextDecoder().decode(bytes);
    return str.includes('acTL');
  }

  // Animated WebP: look for 'ANIM' chunk
  if (file.type === 'image/webp') {
    const str = new TextDecoder().decode(bytes.slice(0, 64));
    return str.includes('ANIM');
  }

  return false;
};

/** Path to the user profile doc */
const userDocRef = (uid: string) => doc(db, 'users', uid);



// ── Provider ──────────────────────────────────────────────────────────────────
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user,      setUser]      = useState<User | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [justLoggedIn, setJustLoggedIn] = useState(false);
  const [viewedUserUid, setViewedUserUid] = useState<string | null>(null);

  const isAdmin = user?.email === 'bibekchandsah@gmail.com' || user?.email === import.meta.env.VITE_ADMIN_EMAIL?.replace(/['"]/g, '');
  const activeUid = (isAdmin && viewedUserUid) ? viewedUserUid : (user?.uid ?? null);

  const viewUser = (uid: string | null) => {
    if (isAdmin) setViewedUserUid(uid);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Check if the current session is valid
        const sessionId = getCurrentSessionId();
        
        // Only validate session if we have a session ID and we didn't just login
        if (sessionId && !justLoggedIn) {
          // Verify session exists in Firestore
          const isValid = await isCurrentSessionValid(firebaseUser.uid);
          
          if (!isValid) {
            // Session was revoked, force logout
            console.log('Session invalid, logging out...');
            await signOut(auth);
            setUser(null);
            setPhotoData(null);
            setLoading(false);
            return;
          }
          
          // Update session activity
          updateSessionActivity(firebaseUser.uid, sessionId);
        }
        
        // Reset the justLoggedIn flag after first validation
        if (justLoggedIn) {
          setJustLoggedIn(false);
        }
        
        const uRef = userDocRef(firebaseUser.uid);
        const snap = await getDoc(uRef);
        const data = snap.exists() ? snap.data() : null;
        
        let needsUpdate = false;
        const updates: any = {};
        
        if (!data?.displayName && firebaseUser.displayName) {
          updates.displayName = firebaseUser.displayName;
          needsUpdate = true;
        }
        
        if (!data?.email && firebaseUser.email) {
          updates.email = firebaseUser.email;
          needsUpdate = true;
        }
        
        if (!data?.photoData && firebaseUser.photoURL) {
          updates.photoData = firebaseUser.photoURL;
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          setDoc(uRef, updates, { merge: true }).catch(console.error);
        }
        
        setPhotoData(data?.photoData || firebaseUser.photoURL || null);
        setUser(firebaseUser);
      } else {
        setUser(null);
        setPhotoData(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [justLoggedIn]);

  // Periodic session validation check
  useEffect(() => {
    if (!user) return;

    const checkSession = async () => {
      const sessionId = getCurrentSessionId();
      if (!sessionId) {
        // No session ID, logout
        await signOut(auth);
        return;
      }

      const isValid = await isCurrentSessionValid(user.uid);
      if (!isValid) {
        // Session was revoked, force logout
        console.log('Session check: Session invalid, logging out...');
        await signOut(auth);
      }
    };

    // Check session every 30 seconds
    const intervalId = setInterval(checkSession, 30000);

    // Also check on window focus (when user returns to the tab)
    const handleFocus = () => checkSession();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user]);

  // ── Auth methods ─────────────────────────────────────────────────────────
  const signInEmail = async (email: string, password: string) => {
    setJustLoggedIn(true);
    const result = await signInWithEmailAndPassword(auth, email, password);
    // Create a new session after successful login
    await createSession(result.user.uid);
  };

  const signUpEmail = async (email: string, password: string, displayName: string) => {
    setJustLoggedIn(true);
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(user, { displayName });
    // Create the user doc so the subcollection path exists
    await setDoc(userDocRef(user.uid), { displayName, email: user.email, photoData: null }, { merge: true });
    // Create a new session after successful signup
    await createSession(user.uid);
  };

  const signInGoogle = async () => {
    setJustLoggedIn(true);
    const result = await signInWithPopup(auth, googleProvider);
    
    const uRef = userDocRef(result.user.uid);
    const snap = await getDoc(uRef);
    const existingPhoto = snap.exists() ? snap.data().photoData : null;

    // Explicitly create/update user doc so they appear in Admin users list
    await setDoc(
      uRef, 
      { 
        displayName: result.user.displayName || 'Google User', 
        email: result.user.email,
        photoData: existingPhoto || result.user.photoURL || null
      }, 
      { merge: true }
    );
    
    // Create a new session after successful Google sign-in
    await createSession(result.user.uid);
  };

  const logout = async () => {
    await signOut(auth);
    setPhotoData(null);
    // Clear current session ID
    localStorage.removeItem('currentSessionId');
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!auth.currentUser || !auth.currentUser.email) {
      throw new Error('Not authenticated');
    }
    
    // Re-authenticate user before changing password
    const credential = EmailAuthProvider.credential(
      auth.currentUser.email,
      currentPassword
    );
    await reauthenticateWithCredential(auth.currentUser, credential);
    
    // Change the password
    await updatePassword(auth.currentUser, newPassword);
    
    // Revoke all sessions (user will need to log in again on all devices)
    await revokeAllSessions(auth.currentUser.uid);
    
    // Log out the user
    await signOut(auth);
  };

  // ── Photo methods ─────────────────────────────────────────────────────────
  const updatePhoto = async (file: File) => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    if (!file.type.startsWith('image/')) throw new Error('Please select an image file.');

    const animated = await isAnimated(file);

    // Animated files (GIF, APNG, animated WebP): store raw, max 700 KB
    // (Firestore doc limit is 1 MB; base64 adds ~33% overhead: 700 KB × 1.33 ≈ 931 KB)
    // Static images: compress to 256×256 JPEG, max 5 MB input
    if (animated) {
      if (file.size > 700 * 1024)
        throw new Error('Animated images must be smaller than 700 KB to fit in the database.');
    } else {
      if (file.size > 5 * 1024 * 1024)
        throw new Error('Image must be smaller than 5 MB.');
    }

    const raw      = await fileToBase64(file);
    // Skip canvas compression for animated files — it strips the animation
    const photoStr = animated ? raw : await compressImage(raw);

    await setDoc(userDocRef(auth.currentUser.uid), { photoData: photoStr }, { merge: true });
    setPhotoData(photoStr);
  };

  const removePhoto = async () => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    await updateDoc(userDocRef(auth.currentUser.uid), { photoData: null }).catch(() => {
       console.warn("Failed to set photoData to null, may not exist yet.");
    });
    setPhotoData(null);
  };

  const updateDisplayName = async (displayName: string) => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    
    // Update Firebase Auth profile
    await updateProfile(auth.currentUser, { displayName });
    
    // Update local user state
    setUser({ ...auth.currentUser, displayName } as User);
    
    // Update Firestore user document
    await setDoc(userDocRef(auth.currentUser.uid), { displayName }, { merge: true });
  };

  return (
    <AuthContext.Provider value={{
      user,
      photoData,
      loading,
      signInEmail,
      signUpEmail,
      signInGoogle,
      logout,
      resetPassword,
      changePassword,
      updatePhoto,
      removePhoto,
      updateDisplayName,
      isAdmin,
      activeUid,
      viewUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
