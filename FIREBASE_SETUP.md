# Firebase Setup Guide

This guide will help you set up Firebase for the Shop Billing System.

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or "Create a project"
3. Enter your project name (e.g., "shop-billing-system")
4. (Optional) Enable Google Analytics
5. Click "Create project"

## Step 2: Register Your Web App

1. In your Firebase project, click the web icon (`</>`) to add a web app
2. Enter an app nickname (e.g., "Shop Billing Web")
3. (Optional) Check "Also set up Firebase Hosting"
4. Click "Register app"
5. Copy the Firebase configuration object - you'll need this later

## Step 3: Enable Firestore Database

1. In the Firebase Console, go to "Firestore Database" from the left menu
2. Click "Create database"
3. Choose "Start in test mode" (for development)
   - **Note**: This allows read/write access to everyone. Change this for production!
4. Select your preferred Cloud Firestore location
5. Click "Enable"

## Step 4: Configure Firestore Security Rules

### For Development (Test Mode)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

### For Production (Recommended)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Bills collection
    match /bills/{billId} {
      // Allow anyone to read bills (adjust based on your needs)
      allow read: if true;
      
      // Allow authenticated users to create bills
      allow create: if request.auth != null;
      
      // Allow users to update/delete their own bills
      allow update, delete: if request.auth != null && 
                              request.auth.uid == resource.data.userId;
    }
    
    // Products collection (if you add it later)
    match /products/{productId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Customers collection (if you add it later)
    match /customers/{customerId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## Step 5: Create Firestore Indexes (Optional but Recommended)

For better query performance, create these indexes:

1. Go to Firestore Database > Indexes
2. Click "Create Index"
3. Create the following indexes:

### Index 1: Bills by Date
- Collection ID: `bills`
- Fields to index:
  - `createdAt` (Descending)
  - `billNo` (Ascending)
- Query scope: Collection

### Index 2: Bills by Customer
- Collection ID: `bills`
- Fields to index:
  - `customerName` (Ascending)
  - `createdAt` (Descending)
- Query scope: Collection

## Step 6: Update Your Application Configuration

1. Open `src/firebase/config.ts`
2. Replace the placeholder values with your Firebase configuration:

```typescript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};
```

## Step 7: Test the Connection

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Open the application in your browser
3. Try creating a bill
4. Check Firebase Console > Firestore Database to see if the data was saved

## Step 8: Enable Firebase Authentication (Optional)

If you want to add user authentication:

1. Go to "Authentication" in Firebase Console
2. Click "Get started"
3. Enable sign-in methods:
   - Email/Password
   - Google
   - Or any other provider you prefer

4. Update your app to use Firebase Auth:
   ```typescript
   import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
   
   const auth = getAuth();
   // Implement login/signup functionality
   ```

## Step 9: Set Up Firebase Hosting (Optional)

To deploy your app to Firebase Hosting:

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Initialize Firebase in your project:
   ```bash
   firebase init
   ```
   - Select "Hosting"
   - Choose your Firebase project
   - Set public directory to `dist`
   - Configure as single-page app: Yes
   - Set up automatic builds: No

4. Build your app:
   ```bash
   npm run build
   ```

5. Deploy to Firebase:
   ```bash
   firebase deploy
   ```

## Firestore Data Structure

Your bills will be stored with this structure:

```
bills (collection)
  └── {billId} (document)
      ├── billNo: string
      ├── date: string
      ├── nepaliDate: string
      ├── customerName: string
      ├── address: string
      ├── contactNumber: string
      ├── items: array
      │   └── {
      │       sn: number,
      │       particulars: string,
      │       qty: number,
      │       rate: number,
      │       amount: number
      │     }
      ├── totalAmount: number
      ├── totalAmountInWords: string
      ├── paymentMethod: string
      ├── freeDue: string
      ├── createdAt: timestamp
      └── updatedAt: timestamp
```

## Troubleshooting

### Error: "Missing or insufficient permissions"
- Check your Firestore security rules
- Make sure you're in test mode for development
- Verify the rules are published

### Error: "Firebase: Error (auth/configuration-not-found)"
- Verify your Firebase configuration in `config.ts`
- Make sure all values are correct
- Check if the project exists in Firebase Console

### Data not appearing in Firestore
- Check browser console for errors
- Verify internet connection
- Check if Firestore is enabled
- Verify the collection name matches in your code

### Slow queries
- Create appropriate indexes
- Limit the number of documents fetched
- Use pagination for large datasets

## Best Practices

1. **Never commit Firebase credentials** to version control
2. **Use environment variables** for sensitive data
3. **Implement proper security rules** before going to production
4. **Enable Firebase App Check** to protect against abuse
5. **Set up billing alerts** in Firebase Console
6. **Regularly backup your Firestore data**
7. **Monitor usage** in Firebase Console

## Cost Optimization

Firebase offers a generous free tier:
- **Firestore**: 50,000 reads/day, 20,000 writes/day
- **Hosting**: 10 GB storage, 360 MB/day transfer
- **Authentication**: Unlimited users

To stay within free tier:
- Implement pagination
- Cache frequently accessed data
- Optimize queries
- Use Firestore offline persistence

## Support

For more information:
- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Firebase Console](https://console.firebase.google.com/)

---

**Need help?** Check the [Firebase Community](https://firebase.google.com/community) or [Stack Overflow](https://stackoverflow.com/questions/tagged/firebase)
