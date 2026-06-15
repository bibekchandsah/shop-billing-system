# Device Session Management - Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────┐           ┌──────────────────────┐      │
│  │   Login Page      │           │   Settings Page      │      │
│  │                   │           │                      │      │
│  │ • Email Login     │           │ • Active Sessions    │      │
│  │ • Google Login    │──────────▶│ • Device Info        │      │
│  │ • Sign Up         │           │ • Revoke Sessions    │      │
│  └───────────────────┘           │ • Change Password    │      │
│           │                      └──────────────────────┘      │
│           │                                 │                  │
└───────────┼─────────────────────────────────┼──────────────────┘
            │                                 │
            ▼                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AUTH CONTEXT LAYER                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              AuthContext.tsx                             │  │
│  │                                                          │  │
│  │  • signInEmail(email, password)                          │  │
│  │    └─▶ Login ─▶ Create Session                          │  │
│  │                                                          │  │
│  │  • signUpEmail(email, password, name)                    │  │
│  │    └─▶ Sign Up ─▶ Create Session                        │  │
│  │                                                          │  │
│  │  • signInGoogle()                                        │  │
│  │    └─▶ Google Login ─▶ Create Session                   │  │
│  │                                                          │  │
│  │  • changePassword(current, new)                          │  │
│  │    └─▶ Re-auth ─▶ Update Password ─▶ Revoke All         │  │
│  │                                                          │  │
│  │  • onAuthStateChanged()                                  │  │
│  │    └─▶ Update Session Activity                          │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                     │
└──────────────────────────┼─────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SERVICE LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           sessionService.ts                              │  │
│  │                                                          │  │
│  │  createSession(userId)                                   │  │
│  │    ├─▶ Parse User Agent (browser, OS, device)           │  │
│  │    ├─▶ Get IP Address (ipify.org API)                   │  │
│  │    ├─▶ Generate Session ID                              │  │
│  │    ├─▶ Save to Firestore                                │  │
│  │    └─▶ Store ID in localStorage                         │  │
│  │                                                          │  │
│  │  getUserSessions(userId)                                 │  │
│  │    ├─▶ Query Firestore                                  │  │
│  │    ├─▶ Order by lastActive                              │  │
│  │    └─▶ Return session list                              │  │
│  │                                                          │  │
│  │  revokeSession(userId, sessionId)                        │  │
│  │    └─▶ Delete from Firestore                            │  │
│  │                                                          │  │
│  │  revokeOtherSessions(userId, currentId)                  │  │
│  │    ├─▶ Get all sessions                                 │  │
│  │    ├─▶ Filter out current                               │  │
│  │    └─▶ Delete all others                                │  │
│  │                                                          │  │
│  │  revokeAllSessions(userId)                               │  │
│  │    ├─▶ Get all sessions                                 │  │
│  │    ├─▶ Delete all                                       │  │
│  │    └─▶ Clear localStorage                               │  │
│  │                                                          │  │
│  │  updateSessionActivity(userId, sessionId)                │  │
│  │    └─▶ Update lastActive timestamp                      │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                     │
└──────────────────────────┼─────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DATA LAYER                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────┐        ┌─────────────────────────┐     │
│  │   localStorage     │        │   Firebase Firestore    │     │
│  │                    │        │                         │     │
│  │  currentSessionId  │        │  /users/{userId}/       │     │
│  │  = "1234-abcd"     │        │    sessions/{sessionId} │     │
│  │                    │        │                         │     │
│  └────────────────────┘        │  • userId               │     │
│                                │  • deviceName           │     │
│  ┌────────────────────┐        │  • browser              │     │
│  │   External API     │        │  • os                   │     │
│  │                    │        │  • ipAddress            │     │
│  │  ipify.org         │        │  • userAgent            │     │
│  │  - Get IP Address  │        │  • lastActive           │     │
│  │                    │        │  • createdAt            │     │
│  └────────────────────┘        │                         │     │
│                                └─────────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### 1. Login Flow

```
User                Login Page           AuthContext          sessionService       Firestore
 │                       │                     │                     │                 │
 │  Enter credentials    │                     │                     │                 │
 ├──────────────────────▶│                     │                     │                 │
 │                       │  signInEmail()      │                     │                 │
 │                       ├────────────────────▶│                     │                 │
 │                       │                     │  Firebase Auth      │                 │
 │                       │                     ├────────────────────▶│                 │
 │                       │                     │  ◀─ Login Success   │                 │
 │                       │                     │                     │                 │
 │                       │                     │  createSession()    │                 │
 │                       │                     ├────────────────────▶│                 │
 │                       │                     │                     │  Parse UA       │
 │                       │                     │                     │  Get IP         │
 │                       │                     │                     │  Gen ID         │
 │                       │                     │                     │                 │
 │                       │                     │                     │  Save Session   │
 │                       │                     │                     ├────────────────▶│
 │                       │                     │                     │  ◀─ Success     │
 │                       │                     │  ◀─ Session ID      │                 │
 │                       │  ◀─ Login Complete  │                     │                 │
 │  ◀─ Redirect to Home  │                     │                     │                 │
 │                       │                     │                     │                 │
```

### 2. View Sessions Flow

```
User              Settings Page      sessionService       Firestore
 │                      │                   │                 │
 │  Navigate to         │                   │                 │
 │  Settings            │                   │                 │
 ├─────────────────────▶│                   │                 │
 │                      │  getUserSessions()│                 │
 │                      ├──────────────────▶│                 │
 │                      │                   │  Query Sessions │
 │                      │                   ├────────────────▶│
 │                      │                   │  ◀─ Session List│
 │                      │  ◀─ Sessions Data │                 │
 │  ◀─ Display Sessions │                   │                 │
 │                      │                   │                 │
 │  See:                │                   │                 │
 │  • Device 1 (current)│                   │                 │
 │  • Device 2          │                   │                 │
 │  • Device 3          │                   │                 │
 │                      │                   │                 │
```

### 3. Revoke Session Flow

```
User              Settings Page      sessionService       Firestore        Device B
 │                      │                   │                 │                │
 │  Click X on          │                   │                 │                │
 │  Device B session    │                   │                 │                │
 ├─────────────────────▶│                   │                 │                │
 │                      │  Confirm?         │                 │                │
 │  ◀─ Show Dialog      │                   │                 │                │
 │  Click OK            │                   │                 │                │
 ├─────────────────────▶│                   │                 │                │
 │                      │  revokeSession()  │                 │                │
 │                      ├──────────────────▶│                 │                │
 │                      │                   │  Delete Session │                │
 │                      │                   ├────────────────▶│                │
 │                      │                   │  ◀─ Deleted     │                │
 │                      │  ◀─ Success       │                 │  Auth Invalid  │
 │  ◀─ Toast: Revoked   │                   │                 ├───────────────▶│
 │  ◀─ Updated List     │                   │                 │  Logged Out    │
 │                      │                   │                 │                │
```

### 4. Password Change Flow

```
User              Settings Page      AuthContext         sessionService       Firestore      All Devices
 │                      │                  │                    │                 │               │
 │  Fill password form  │                  │                    │                 │               │
 ├─────────────────────▶│                  │                    │                 │               │
 │  Click Change        │                  │                    │                 │               │
 ├─────────────────────▶│                  │                    │                 │               │
 │                      │  changePassword()│                    │                 │               │
 │                      ├─────────────────▶│                    │                 │               │
 │                      │                  │  Re-authenticate   │                 │               │
 │                      │                  ├───────────────────▶│                 │               │
 │                      │                  │  ◀─ Verified       │                 │               │
 │                      │                  │                    │                 │               │
 │                      │                  │  Update Password   │                 │               │
 │                      │                  ├───────────────────▶│                 │               │
 │                      │                  │  ◀─ Success        │                 │               │
 │                      │                  │                    │                 │               │
 │                      │                  │  revokeAllSessions()                 │               │
 │                      │                  ├────────────────────┼────────────────▶│               │
 │                      │                  │                    │  Delete ALL     │               │
 │                      │                  │                    ├────────────────▶│               │
 │                      │                  │                    │  ◀─ All Deleted │               │
 │                      │                  │                    │                 │  Auth Invalid │
 │                      │                  │                    │                 ├──────────────▶│
 │                      │                  │  Logout Current    │                 │  All Logged   │
 │                      │                  ├───────────────────▶│                 │  Out          │
 │  ◀─ Toast: Changed   │                  │  ◀─ Done           │                 │               │
 │  ◀─ Redirect to Login│                  │                    │                 │               │
 │                      │                  │                    │                 │               │
```

---

## Component Hierarchy

```
App
│
├─ AuthProvider (AuthContext)
│  │
│  ├─ Login Page
│  │  ├─ Email/Password Form
│  │  ├─ Google Sign-In Button
│  │  └─ Sign Up Link
│  │
│  └─ Settings Page
│     │
│     ├─ Business Profile Section
│     ├─ Invoice Settings Section
│     ├─ Fiscal Year Section
│     ├─ Print Settings Section
│     │
│     ├─ Device Sessions & Security Section ◄── NEW
│     │  │
│     │  ├─ Password Change
│     │  │  ├─ Toggle Button
│     │  │  └─ Password Form
│     │  │     ├─ Current Password Input
│     │  │     ├─ New Password Input
│     │  │     ├─ Confirm Password Input
│     │  │     ├─ Warning Message
│     │  │     └─ Submit Button
│     │  │
│     │  └─ Active Sessions List
│     │     ├─ Sessions Header
│     │     │  ├─ Session Count
│     │     │  └─ Logout All Button
│     │     │
│     │     ├─ Loading State
│     │     ├─ Empty State
│     │     │
│     │     └─ Session Items
│     │        └─ Session Card (for each session)
│     │           ├─ Device Icon
│     │           ├─ Device Name
│     │           ├─ Current Badge (if current)
│     │           ├─ IP Address
│     │           ├─ Last Activity
│     │           └─ Revoke Button
│     │
│     ├─ Action PIN Section
│     └─ PWA Install Section
│
└─ ToastContainer (for notifications)
```

---

## State Management

```
┌────────────────────────────────────────────────────────────────┐
│                    AuthContext (Global State)                  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  • user: User | null                                           │
│  • photoData: string | null                                    │
│  • loading: boolean                                            │
│                                                                │
│  Methods:                                                      │
│  • signInEmail()                                               │
│  • signUpEmail()                                               │
│  • signInGoogle()                                              │
│  • logout()                                                    │
│  • resetPassword()                                             │
│  • changePassword() ◄── NEW                                    │
│  • updatePhoto()                                               │
│  • removePhoto()                                               │
│                                                                │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│              Settings Page (Local State)                       │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Device Session States: ◄── NEW                               │
│  • sessions: DeviceSession[]                                   │
│  • sessionsLoading: boolean                                    │
│  • revokingSessionId: string | null                            │
│  • currentSessionId: string                                    │
│                                                                │
│  Password Change States: ◄── NEW                              │
│  • showPasswordChange: boolean                                 │
│  • currentPassword: string                                     │
│  • newPassword: string                                         │
│  • confirmPassword: string                                     │
│  • passwordChanging: boolean                                   │
│                                                                │
│  Other States:                                                 │
│  • settings: AppSettings                                       │
│  • loading, saving: boolean                                    │
│  • ... (existing states)                                       │
│                                                                │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                  localStorage (Browser)                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  • currentSessionId: string ◄── NEW                            │
│  • (other app data...)                                         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      SECURITY LAYERS                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: Firebase Authentication                              │
├─────────────────────────────────────────────────────────────────┤
│  • Email/Password Authentication                               │
│  • Google OAuth                                                │
│  • Token-based Authentication                                  │
│  • Re-authentication for Sensitive Operations                  │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 2: Firestore Security Rules                            │
├─────────────────────────────────────────────────────────────────┤
│  • User can only read/write their own sessions                │
│  • Authenticated users only                                    │
│  • Rule: request.auth.uid == userId                           │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3: Session Management                                   │
├─────────────────────────────────────────────────────────────────┤
│  • Unique session IDs (timestamp + random)                     │
│  • Session tied to Firebase Auth token                         │
│  • Activity tracking                                           │
│  • Manual revocation capability                                │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 4: Password Security                                    │
├─────────────────────────────────────────────────────────────────┤
│  • Re-authentication required for password change              │
│  • Minimum password length (6 characters)                      │
│  • Auto-revoke all sessions on password change                │
│  • Force logout after password change                          │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 5: UI/UX Security                                       │
├─────────────────────────────────────────────────────────────────┤
│  • Confirmation dialogs for destructive actions                │
│  • Clear visual indicators (current device badge)              │
│  • Warning messages for security-critical operations           │
│  • Toast notifications for success/error feedback              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

```
┌───────────────────────────────────────────────────────────┐
│                    FRONTEND                               │
├───────────────────────────────────────────────────────────┤
│  • React 18+ (UI Components)                             │
│  • TypeScript (Type Safety)                              │
│  • Vite (Build Tool)                                     │
│  • CSS3 (Styling)                                        │
└───────────────────────────────────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────────┐
│                    BACKEND                                │
├───────────────────────────────────────────────────────────┤
│  • Firebase Auth (Authentication)                        │
│  • Firebase Firestore (Database)                         │
│  • Firebase Hosting (Deployment)                         │
└───────────────────────────────────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────────┐
│               EXTERNAL SERVICES                           │
├───────────────────────────────────────────────────────────┤
│  • ipify.org (IP Address Detection)                      │
│  • Browser User Agent API (Device Detection)             │
└───────────────────────────────────────────────────────────┘
```

---

## Performance Considerations

### Query Optimization
```
getUserSessions():
  - Index: lastActive (DESC)
  - Limit: No limit (paginate if needed)
  - Load time: < 1s for typical use

revokeSession():
  - Direct document delete
  - Time: < 500ms

revokeAllSessions():
  - Batch delete
  - Time: < 2s for 10 sessions
```

### Caching Strategy
```
• Sessions loaded on Settings page mount
• Re-loaded after revocations
• No automatic polling (manual refresh)
• localStorage for current session ID only
```

### Bundle Size Impact
```
sessionService.ts:    ~5 KB
AuthContext changes:  ~2 KB
Settings UI:          ~8 KB
Total added:         ~15 KB (minified)
```

---

## Future Scalability

### Potential Optimizations
```
1. Session Pagination
   - If user has 20+ sessions
   - Load 10 at a time
   - Infinite scroll or "Load More"

2. Real-time Updates
   - Listen to Firestore changes
   - Auto-update session list
   - Show when new session added

3. Session Expiration
   - Auto-delete sessions older than X days
   - Cloud Function for cleanup
   - Configurable by user

4. Advanced Filtering
   - Filter by device type
   - Search by IP or location
   - Sort by different fields
```

---

## Error Handling Flow

```
Any Operation
     │
     ├─ Try
     │   ├─ Execute
     │   └─ Success ──▶ Show Success Toast
     │                  Update UI
     │
     └─ Catch
         ├─ Log to Console
         ├─ Show Error Toast
         └─ Restore Previous State
```

---

This architecture provides a robust, secure, and scalable foundation for device session management.
