# Security Guide - Device Session Management

## Quick Reference

### How to Access
1. Log in to your account
2. Click on **Settings** in the navigation menu
3. Scroll to **Device Sessions & Security** section

---

## Common Tasks

### 🔍 View Your Active Sessions

**What you'll see:**
- List of all devices where you're currently logged in
- Device name (e.g., "Windows 10/11 - Chrome")
- IP address
- Last activity time (e.g., "5 minutes ago")
- Current device badge (for the device you're using now)

**Purpose:** Check if there are any unfamiliar devices accessing your account.

---

### 🚫 Remove a Specific Device

**When to use:** You see an unfamiliar device or you logged in on a public computer and forgot to log out.

**Steps:**
1. Find the device in the sessions list
2. Click the **X button** on the right side of that device
3. Click **OK** in the confirmation dialog
4. ✓ Done! That device is immediately logged out

**Result:** The selected device loses access instantly. You stay logged in on your current device.

---

### 🔐 Logout from All Other Devices

**When to use:** 
- You suspect someone else might have access to your account
- You logged in on multiple public/shared computers
- You want to secure your account quickly

**Steps:**
1. Click the **"Logout All Other Devices"** button at the top of the sessions list
2. Click **OK** in the confirmation dialog
3. ✓ Done! All other devices are logged out

**Result:** Only your current device remains logged in. All other devices must log in again.

---

### 🔑 Change Your Password

**When to use:**
- Regular security maintenance
- You suspect your password was compromised
- You logged in on an untrusted device

**Steps:**
1. Click the **"Change Password"** button
2. Fill in the form:
   - **Current Password** - Your existing password
   - **New Password** - Must be at least 6 characters
   - **Confirm New Password** - Type the new password again
3. Read the warning: "Changing your password will log you out from all devices"
4. Click **"Change Password"**
5. You'll be logged out automatically
6. Log back in with your new password

**Result:** 
- Password is changed ✓
- All devices (including current) are logged out ✓
- You must log in again on all devices with the new password

⚠️ **Important:** After changing your password, you'll need to log in again on every device you use.

---

## Security Best Practices

### ✅ Do This Regularly

1. **Weekly Check**
   - Review your active sessions at least once a week
   - Look for unfamiliar devices or locations
   - Revoke any sessions you don't recognize

2. **After Public Use**
   - If you logged in on a public computer (library, café, friend's device):
   - Use "Logout All Other Devices" when you get home
   - Or change your password for maximum security

3. **Monthly Maintenance**
   - Change your password every 2-3 months
   - Check your active sessions before and after password changes

### 🚨 Red Flags - Act Immediately

**You see a device you don't recognize:**
1. Click the X button to revoke that session immediately
2. Change your password
3. Review your account activity

**Multiple unfamiliar devices:**
1. Click "Logout All Other Devices"
2. Change your password immediately
3. Contact support if you're concerned

**Unfamiliar IP address or location:**
1. Revoke that session
2. Consider changing your password
3. Enable additional security if available

---

## Understanding Device Information

### Device Name Format
- **"Windows 10/11 - Chrome"** = Windows computer using Chrome browser
- **"macOS - Safari"** = Mac computer using Safari
- **"Android - Chrome (Mobile)"** = Android phone using Chrome
- **"iOS - Safari (Mobile)"** = iPhone using Safari

### IP Address
- Shows the internet connection location
- Example: `103.59.xxx.xxx`
- "Unknown" means the detection service was unavailable (rare)

### Last Activity
- **"just now"** = Active right now
- **"5 minutes ago"** = Last activity 5 minutes ago
- **"2 hours ago"** = Last activity 2 hours ago
- **"3 days ago"** = Last activity 3 days ago
- **"12/25/2024"** = Last activity on that date (over 7 days ago)

### Current Device Badge
- Blue badge saying "Current Device"
- Shows which device you're using right now
- You cannot revoke your current session (you'd log yourself out!)
- Use "Logout All Other Devices" to keep only this one

---

## Troubleshooting

### Problem: Sessions not loading
**Solution:**
1. Refresh the page
2. Check your internet connection
3. Try logging out and back in

### Problem: Can't revoke a session
**Solution:**
1. Refresh the page and try again
2. Try "Logout All Other Devices" instead
3. Clear your browser cache

### Problem: I accidentally revoked my current device
**Solution:**
- This shouldn't happen (current device can't be revoked)
- If you're logged out, simply log back in

### Problem: After password change, all devices logged out
**Solution:**
- This is expected behavior for security
- Log in again on each device with your new password
- Your sessions will be recreated automatically

---

## Security Tips

1. **Use Strong Passwords**
   - Minimum 6 characters (longer is better)
   - Mix letters, numbers, and symbols
   - Don't use personal information
   - Don't reuse passwords from other sites

2. **Be Cautious on Public WiFi**
   - Avoid logging in on unsecured networks
   - If you must, change your password afterward
   - Use "Logout All Other Devices" when you get home

3. **Log Out When Done**
   - Always log out on shared/public computers
   - Close the browser completely
   - Check your sessions list later to verify

4. **Regular Monitoring**
   - Check your sessions weekly
   - Look for patterns (unexpected times, locations)
   - Act immediately if something looks wrong

5. **Keep Devices Secure**
   - Use screen locks on your devices
   - Keep your software updated
   - Use antivirus/security software
   - Don't share your password with anyone

---

## Privacy & Data

### What Information is Stored?
- Device name (browser + operating system)
- IP address (your internet connection)
- Last activity timestamp
- Session creation time

### Who Can See This Information?
- Only you (the account owner)
- Account administrators (if applicable)
- No one else has access to your session data

### How Long is Data Kept?
- Sessions remain active until:
  - You log out
  - You revoke the session
  - You change your password
  - Session expires (Firebase default)

### Is My Data Secure?
- ✓ Stored in secure Firebase database
- ✓ Encrypted in transit (HTTPS)
- ✓ Only accessible by authenticated users
- ✓ Session IDs are unique and unpredictable

---

## Need Help?

### Common Questions

**Q: How many devices can I log in on?**
A: There's no limit. You can have as many active sessions as you need.

**Q: Will changing my password delete my data?**
A: No, only your sessions are cleared. All your bills, customers, and settings are safe.

**Q: Can I see login history beyond active sessions?**
A: Currently, only active sessions are shown. Inactive/logged-out sessions are automatically removed.

**Q: What if I don't recognize an IP address?**
A: IP addresses can vary based on your internet provider. Focus on the device name and last activity time.

**Q: Is this feature required?**
A: No, you can use the app normally without checking sessions. This is an optional security feature.

---

## Emergency Actions

### If You Suspect Unauthorized Access:

1. **Immediate Actions:**
   ```
   1. Click "Logout All Other Devices"
   2. Change your password immediately
   3. Review recent bills/activity
   ```

2. **Follow-up Actions:**
   ```
   1. Check your email for login notifications
   2. Review account settings for changes
   3. Contact support if needed
   ```

3. **Prevention:**
   ```
   1. Enable additional security features
   2. Use stronger passwords
   3. Monitor sessions regularly
   ```

---

## Updates & Changes

This feature is regularly updated with improvements. Current version features:
- ✓ Real-time session tracking
- ✓ Device detection (browser, OS)
- ✓ IP address tracking
- ✓ Time-based activity display
- ✓ Bulk session revocation
- ✓ Password change with auto-logout

**Future enhancements may include:**
- Email notifications for new logins
- Geolocation from IP address
- Two-factor authentication
- Session expiration settings
- Login history log

---

## Summary

**Device Session Management helps you:**
- 👁️ See where you're logged in
- 🚫 Remove access from unwanted devices
- 🔐 Secure your account quickly
- 🔑 Change password safely
- ✨ Stay in control of your account

**Remember:** Regular monitoring and quick action keep your account secure!

---

**Need more help?** 
- Check the full documentation: `DEVICE_SESSION_MANAGEMENT.md`
- Contact your system administrator
- Visit the Settings page for live session information
