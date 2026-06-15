# 🧪 Testing Guide - Session Logout Fix

## Quick Test (5 Minutes)

Follow these steps to verify that revoking sessions now properly logs out devices.

---

## 🎯 Test 1: Revoke Single Session (MAIN TEST)

### Setup
1. Open **Chrome** (or your main browser)
2. Login to your account
3. Open **Firefox** (or incognito Chrome)
4. Login with the same account

### Expected State
- ✅ Chrome: Logged in, sees 2 sessions in Settings
- ✅ Firefox: Logged in, sees 2 sessions in Settings

### Test Steps

#### On Chrome:
1. Go to **Settings** page
2. Scroll to **Device Sessions & Security**
3. Find the Firefox session (different device name)
4. Click the **X button** to revoke it
5. Confirm the action
6. ✅ You should see: Toast "Session revoked successfully"
7. ✅ Firefox session removed from list

#### On Firefox:
**Wait and observe (multiple scenarios):**

**Scenario A: Immediate Test (Tab Switch)**
1. Switch to another tab
2. Switch back to the app tab
3. ✅ **RESULT:** Should immediately logout and redirect to login page

**Scenario B: Wait Test (30 seconds)**
1. Keep the app tab active
2. Wait 30 seconds
3. ✅ **RESULT:** Should automatically logout and redirect to login page

**Scenario C: Navigate Test**
1. Try to navigate to another page (e.g., Dashboard, Records)
2. ✅ **RESULT:** Should logout and redirect to login page

### Success Criteria
- ✅ Firefox logs out automatically (within 30s or on focus)
- ✅ Firefox redirects to login page
- ✅ Firefox can no longer access protected pages
- ✅ Chrome remains logged in
- ✅ Console shows: "Session check: Session invalid, logging out..."

---

## 🎯 Test 2: Logout All Other Devices

### Setup
1. Login on **Device A** (Chrome)
2. Login on **Device B** (Firefox)
3. Login on **Device C** (Edge or Chrome Incognito)

### Expected State
- ✅ All 3 devices logged in
- ✅ Each sees 3 sessions in Settings

### Test Steps

#### On Device A:
1. Go to **Settings** → **Device Sessions & Security**
2. Click **"Logout All Other Devices"** button
3. Confirm the action
4. ✅ See: Toast "All other sessions have been revoked"
5. ✅ See: Only 1 session in list (Device A)

#### On Devices B & C:
1. Wait 30 seconds (or switch tabs)
2. ✅ **RESULT:** Both automatically logout
3. ✅ **RESULT:** Both redirect to login page

### Success Criteria
- ✅ Device A remains logged in
- ✅ Devices B & C logout automatically
- ✅ All logged-out devices redirect to login page

---

## 🎯 Test 3: Password Change (CRITICAL TEST)

### Setup
1. Login on **Device A** (Chrome)
2. Login on **Device B** (Firefox)
3. Both devices on different pages (Dashboard, Records, etc.)

### Expected State
- ✅ Both devices logged in
- ✅ Both see 2 sessions in Settings

### Test Steps

#### On Device A:
1. Go to **Settings** → **Device Sessions & Security**
2. Click **"Change Password"** button
3. Fill in the form:
   - Current Password: `yourpassword`
   - New Password: `newpassword123`
   - Confirm New Password: `newpassword123`
4. Click **"Change Password"**
5. ✅ See: Toast "Password changed successfully..."
6. ✅ **RESULT:** Device A immediately logs out
7. ✅ **RESULT:** Device A redirects to login page

#### On Device B:
1. Wait 30 seconds (or switch tabs)
2. ✅ **RESULT:** Device B automatically logs out
3. ✅ **RESULT:** Device B redirects to login page

#### Verify (Both Devices):
1. Try to login with **old password**
2. ❌ Should fail: "Invalid email or password"
3. Login with **new password**
4. ✅ Should succeed
5. ✅ New sessions created

### Success Criteria
- ✅ All devices logout after password change
- ✅ Old password no longer works
- ✅ New password works
- ✅ New sessions created after login
- ✅ All logged-out devices redirected to login page

---

## 🎯 Test 4: Focus Event (Fast Logout)

### Setup
1. Login on **Device A** and **Device B**

### Test Steps
1. On **Device A**: Revoke Device B session
2. On **Device B**: Immediately switch to another tab (YouTube, email, etc.)
3. On **Device B**: Switch back to the app tab
4. ✅ **RESULT:** Should **immediately** logout (no 30s wait)

### Success Criteria
- ✅ Logout happens instantly on focus
- ✅ No need to wait 30 seconds
- ✅ User experience is responsive

---

## 🎯 Test 5: Page Refresh

### Setup
1. Login on **Device A** and **Device B**

### Test Steps
1. On **Device A**: Revoke Device B session
2. On **Device B**: Refresh the page (F5 or Ctrl+R)
3. ✅ **RESULT:** Should logout during page load
4. ✅ **RESULT:** Redirect to login page

### Success Criteria
- ✅ Logout happens on refresh
- ✅ User cannot bypass by refreshing

---

## 🛠️ Debugging Failed Tests

### If Device Doesn't Logout

#### Check 1: Console Logs
1. Open browser console (F12)
2. Look for these messages:
   - `"Session check: Session invalid, logging out..."`
   - `"Session invalid, logging out..."`
3. If you see errors, note them

#### Check 2: localStorage
1. Open browser console (F12)
2. Type: `localStorage.getItem('currentSessionId')`
3. Should show a session ID
4. Type: `localStorage.clear()` then refresh
5. Should redirect to login

#### Check 3: Firestore
1. Go to Firebase Console
2. Navigate to Firestore Database
3. Check: `/users/{userId}/sessions/`
4. Verify session was actually deleted

#### Check 4: Network
1. Open browser DevTools → Network tab
2. Filter: "firestore"
3. Revoke a session
4. You should see DELETE request
5. Switch to other device
6. You should see GET request for sessions
7. Response should NOT include deleted session

### Common Issues

**Issue:** Device never logs out
- **Cause:** Validation interval not running
- **Fix:** Check console for errors, refresh page

**Issue:** Device logs out immediately after login
- **Cause:** Session not created properly
- **Fix:** Check if session ID in localStorage, check Firestore

**Issue:** Console shows errors about permissions
- **Cause:** Firestore rules not updated
- **Fix:** Update rules, see FIRESTORE_RULES_COPY_THIS.txt

**Issue:** Takes more than 30 seconds to logout
- **Cause:** Focus event not triggering
- **Fix:** Try switching tabs to trigger focus event

---

## 📊 Timing Reference

| Action | Expected Logout Time |
|--------|---------------------|
| Tab switch after revoke | Immediate (< 1 second) |
| Page refresh after revoke | Immediate (< 1 second) |
| Wait after revoke | 30 seconds maximum |
| Password change (current device) | Immediate |
| Password change (other devices) | 30 seconds maximum |
| Window focus after revoke | Immediate (< 1 second) |

---

## ✅ Success Checklist

Test all scenarios and check off:

- [ ] Single session revoke works
- [ ] "Logout All Other Devices" works
- [ ] Password change logs out all devices
- [ ] Password change on current device is immediate
- [ ] Tab switch triggers immediate logout
- [ ] Page refresh triggers logout
- [ ] 30-second periodic check works
- [ ] Console shows validation logs
- [ ] No errors in console
- [ ] Old password doesn't work after change
- [ ] New password works after change
- [ ] Sessions created on new login

---

## 🎉 Expected Results Summary

### Working Correctly ✅
```
Device A: Revokes Device B
    ↓
Device B: Waits max 30s or switches tabs
    ↓
Device B: Automatically logged out
    ↓
Device B: Redirected to login page
    ↓
Device B: Must login again
```

### Password Change ✅
```
Any Device: Changes password
    ↓
All Devices: Automatically logged out (max 30s)
    ↓
All Devices: Redirected to login page
    ↓
All Devices: Must login with new password
```

### Not Working ❌
If devices remain logged in after:
- 30+ seconds passed
- Tab switched multiple times
- Page refreshed
- Then something is wrong → Debug using steps above

---

## 📝 Test Report Template

After testing, fill this out:

```
Date Tested: _______________
Tester: _______________

Test 1 (Single Session Revoke): PASS / FAIL
  - Logout time: ___ seconds
  - Console logs: YES / NO
  - Notes: _______________

Test 2 (Logout All): PASS / FAIL
  - Logout time: ___ seconds
  - All devices logged out: YES / NO
  - Notes: _______________

Test 3 (Password Change): PASS / FAIL
  - Current device logout: IMMEDIATE / DELAYED
  - Other devices logout: ___ seconds
  - Old password blocked: YES / NO
  - New password works: YES / NO
  - Notes: _______________

Test 4 (Focus Event): PASS / FAIL
  - Logout speed: IMMEDIATE / DELAYED
  - Notes: _______________

Test 5 (Page Refresh): PASS / FAIL
  - Logout on refresh: YES / NO
  - Notes: _______________

Overall Status: PASS / FAIL
Issues Found: _______________
```

---

## 🚀 Production Testing

Before going live, test with:
1. Multiple real devices (not just browsers)
2. Different networks (home WiFi, mobile data)
3. Different users
4. Different browsers
5. Mobile devices (iOS, Android)

---

**Ready to test? Start with Test 1!** 🎯

**Questions?** See `SESSION_VALIDATION_FIX.md` for technical details.
