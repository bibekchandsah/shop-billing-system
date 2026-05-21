# Shop Billing System

A modern, fully-functional shop billing system built with React, TypeScript, and Firebase. Features include Nepali date support, PDF generation, secure database storage, and a responsive design with theme support.

## Features

### Core Functionality
- ✅ **Easy Bill Creation** - Intuitive interface for creating professional bills
- ✅ **PDF Generation** - Generate and download bills as PDF documents
- ✅ **Database Storage** - Secure data storage with Firebase Firestore
- ✅ **Search & Filter** - Advanced search functionality across all bill fields
- ✅ **Bill Management** - View, edit, and delete bills

### Special Features
- 🗓️ **Nepali Date Support** - Full integration with Nepali calendar system
- 💰 **Number to Words** - Automatic conversion of amounts to words (English & Nepali)
- 🎨 **Theme Support** - Light, Dark, and System theme options
- 📱 **Responsive Design** - Works seamlessly on desktop, tablet, and mobile
- 🔒 **Secure** - Firebase security rules and authentication ready
- ⚡ **Fast & Modern** - Built with Vite for optimal performance

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Routing**: React Router DOM
- **Database**: Firebase Firestore
- **PDF Generation**: jsPDF + jsPDF-AutoTable
- **Date Handling**: Nepali Date Converter
- **Styling**: Custom CSS with CSS Variables

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Firebase account

## Installation

1. **Clone the repository**
   ```bash
   cd "d:\programming exercise\react\shop bill"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   
   a. Go to [Firebase Console](https://console.firebase.google.com/)
   
   b. Create a new project or use an existing one
   
   c. Enable Firestore Database:
      - Go to Firestore Database
      - Click "Create database"
      - Choose "Start in test mode" (for development)
      - Select your preferred location
   
   d. Get your Firebase configuration:
      - Go to Project Settings
      - Scroll down to "Your apps"
      - Click on the web icon (</>)
      - Copy the configuration object
   
   e. Update `src/firebase/config.ts` with your Firebase credentials:
   ```typescript
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_AUTH_DOMAIN",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_STORAGE_BUCKET",
     messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
     appId: "YOUR_APP_ID"
   };
   ```

4. **Set up Firestore Security Rules** (Optional but recommended)
   
   Go to Firestore Database > Rules and add:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /bills/{billId} {
         allow read, write: if true; // For development
         // For production, add proper authentication rules
       }
     }
   }
   ```

## Running the Application

### Development Mode
```bash
npm run dev
```
The application will be available at `http://localhost:5173`

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

## Project Structure

```
shop-bill/
├── src/
│   ├── components/          # Reusable components
│   │   ├── Navbar.tsx
│   │   └── Navbar.css
│   ├── context/            # React context providers
│   │   └── ThemeContext.tsx
│   ├── firebase/           # Firebase configuration
│   │   └── config.ts
│   ├── pages/              # Page components
│   │   ├── Home.tsx
│   │   ├── Home.css
│   │   ├── CreateBill.tsx
│   │   ├── CreateBill.css
│   │   ├── Records.tsx
│   │   └── Records.css
│   ├── services/           # API services
│   │   └── billService.ts
│   ├── types/              # TypeScript type definitions
│   │   └── index.ts
│   ├── utils/              # Utility functions
│   │   ├── nepaliDate.ts
│   │   ├── numberToWords.ts
│   │   └── pdfGenerator.ts
│   ├── App.tsx             # Main app component
│   ├── main.tsx            # Entry point
│   └── index.css           # Global styles
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Usage Guide

### Creating a Bill

1. Navigate to "Create Bill" from the navigation menu
2. The bill number and Nepali date are auto-generated
3. Fill in customer information (Name, Address, Contact)
4. Add items with particulars, quantity, and rate
5. The amount is calculated automatically
6. Select payment method
7. Add any notes in the "Free Due" field
8. Click "Save Bill" to store in database
9. Click "Generate PDF" to download the bill

### Viewing Records

1. Navigate to "Records" from the navigation menu
2. Use the search bar to find specific bills
3. Filter by different fields (Bill No, Customer Name, etc.)
4. Click the eye icon to view full bill details
5. Click the download icon to generate PDF
6. Click the delete icon to remove a bill

### Changing Theme

Use the theme switcher in the navigation bar:
- ☀️ Light theme
- 🌙 Dark theme
- 💻 System theme (follows OS preference)

## Customization

### Business Information

Update business details in:
- `src/utils/pdfGenerator.ts` - PDF header information
- `src/pages/CreateBill.tsx` - Bill form header

### Styling

All colors and styles are defined using CSS variables in `src/index.css`:
```css
:root {
  --accent-primary: #2563eb;
  --success: #10b981;
  /* ... more variables */
}
```

### Number Format

The system uses Indian numbering system (Lakh, Crore). To change:
- Modify `src/utils/numberToWords.ts`

## Firebase Security (Production)

For production deployment, update Firestore rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /bills/{billId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && 
                              request.auth.uid == resource.data.userId;
    }
  }
}
```

Then add authentication to your app using Firebase Auth.

## Troubleshooting

### Firebase Connection Issues
- Verify your Firebase configuration in `src/firebase/config.ts`
- Check if Firestore is enabled in Firebase Console
- Ensure security rules allow read/write access

### PDF Generation Issues
- Check browser console for errors
- Ensure all required fields are filled
- Try with a smaller number of items first

### Theme Not Persisting
- Check if localStorage is enabled in your browser
- Clear browser cache and try again

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance Optimization

- Lazy loading for routes (can be added)
- Image optimization
- Code splitting
- Firebase query optimization with indexes

## Future Enhancements

- [ ] User authentication
- [ ] Multi-user support with roles
- [ ] Product inventory management
- [ ] Customer management module
- [ ] Sales reports and analytics
- [ ] Export to Excel/CSV
- [ ] Email bill functionality
- [ ] Barcode/QR code generation
- [ ] Multi-language support
- [ ] Print directly from browser

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is open source and available under the MIT License.

## Support

For support, please open an issue in the repository or contact the development team.

---

**Built with ❤️ using React, TypeScript, and Firebase**
