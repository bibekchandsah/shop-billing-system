# Quick Start Guide

Get your Shop Billing System up and running in 5 minutes!

## Prerequisites

- Node.js (v16 or higher) - [Download](https://nodejs.org/)
- A Firebase account - [Sign up](https://firebase.google.com/)
- A code editor (VS Code recommended)

## Step 1: Install Dependencies (1 minute)

Open your terminal in the project directory and run:

```bash
npm install
```

## Step 2: Set Up Firebase (2 minutes)

### 2.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: "shop-billing-system"
4. Click "Continue" → "Continue" → "Create project"

### 2.2 Enable Firestore

1. In Firebase Console, click "Firestore Database"
2. Click "Create database"
3. Select "Start in test mode"
4. Choose your location
5. Click "Enable"

### 2.3 Get Firebase Configuration

1. In Firebase Console, click the gear icon ⚙️ → "Project settings"
2. Scroll down to "Your apps"
3. Click the web icon `</>`
4. Register app with nickname: "Shop Billing Web"
5. Copy the `firebaseConfig` object

### 2.4 Update Configuration

Open `src/firebase/config.ts` and replace the placeholder values:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",              // Paste your values here
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

## Step 3: Start Development Server (30 seconds)

```bash
npm run dev
```

The application will open at: `http://localhost:5173`

## Step 4: Test the Application (1 minute)

1. Click "Create Bill" in the navigation
2. Fill in customer information:
   - Customer Name: "Test Customer"
   - Address: "Test Address"
   - Contact: "9876543210"
3. Add an item:
   - Particulars: "Test Item"
   - Qty: 2
   - Rate: 100
4. Click "Save Bill"
5. Go to "Records" to see your saved bill
6. Click the download icon to generate PDF

## 🎉 You're Done!

Your Shop Billing System is now running!

## Next Steps

### Customize Your Business Information

Edit these files to add your business details:

1. **PDF Header** - `src/utils/pdfGenerator.ts`
   ```typescript
   generateBillPDF(bill, 'Your Business Name', 'Your Address');
   ```

2. **Bill Form** - `src/pages/CreateBill.tsx`
   ```tsx
   <p className="business-address">Your Business Address</p>
   ```

### Change Theme

Click the theme icons in the navigation bar:
- ☀️ Light theme
- 🌙 Dark theme
- 💻 System theme

### Explore Features

- **Create Bills**: Add multiple items, automatic calculations
- **Search**: Find bills by customer name, bill number, date, etc.
- **PDF Generation**: Download professional bills
- **Responsive**: Try it on your phone!

## Common Issues

### "Firebase: Error (auth/configuration-not-found)"
- Check if you updated `src/firebase/config.ts` with your credentials
- Verify all values are correct (no quotes or extra spaces)

### "Permission denied" when saving bills
- Go to Firebase Console → Firestore Database → Rules
- Make sure you're in "test mode" (allows read/write)

### Port 5173 is already in use
- The dev server will automatically use the next available port
- Check the terminal for the actual URL

### Build warnings about chunk size
- This is normal for development
- The app will work fine
- For production, consider code splitting (advanced)

## Useful Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type check
npm run type-check

# Lint code
npm run lint
```

## Getting Help

- **Documentation**: Check the `docs/` folder
- **User Guide**: See `USER_GUIDE.md`
- **Firebase Setup**: See `FIREBASE_SETUP.md`
- **Deployment**: See `DEPLOYMENT.md`

## What's Next?

1. **Customize**: Update business information
2. **Test**: Create multiple bills, try all features
3. **Deploy**: Follow `DEPLOYMENT.md` to go live
4. **Secure**: Update Firebase security rules for production

## Tips for Success

✅ **Do:**
- Test with sample data first
- Backup important bills as PDFs
- Use descriptive customer names
- Keep Firebase credentials secure

❌ **Don't:**
- Share your Firebase credentials
- Delete the test bill until you're comfortable
- Forget to update business information
- Skip reading the User Guide

## Resources

- [React Documentation](https://react.dev)
- [Firebase Documentation](https://firebase.google.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)

---

**Need more help?** Check out the complete documentation in the project folder!

**Ready to deploy?** See `DEPLOYMENT.md` for deployment options!

**Want to contribute?** See `CONTRIBUTING.md` for guidelines!

---

Happy Billing! 🎉
