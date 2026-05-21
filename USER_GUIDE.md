# Shop Billing System - User Guide

Welcome to the Shop Billing System! This guide will help you understand and use all features of the application.

## Table of Contents
1. [Getting Started](#getting-started)
2. [Creating Bills](#creating-bills)
3. [Managing Records](#managing-records)
4. [Searching Bills](#searching-bills)
5. [PDF Generation](#pdf-generation)
6. [Theme Customization](#theme-customization)
7. [Tips & Best Practices](#tips--best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Getting Started

### First Time Setup

1. **Access the Application**
   - Open your web browser
   - Navigate to the application URL
   - You'll see the home page with feature overview

2. **Navigation**
   - **Home**: Overview and features
   - **Create Bill**: Create new bills
   - **Records**: View and manage existing bills

3. **Theme Selection**
   - Click the theme icons in the navigation bar
   - Choose between Light, Dark, or System theme
   - Your preference is saved automatically

---

## Creating Bills

### Step-by-Step Guide

#### 1. Navigate to Create Bill
Click "Create Bill" in the navigation menu or the "Create New Bill" button on the home page.

#### 2. Bill Information (Auto-filled)
- **Bill No**: Automatically generated (e.g., BILL-0001)
- **Date**: Current date (can be modified)
- **Nepali Date**: Automatically converted from English date

#### 3. Customer Information (Required)
Fill in the following fields:
- **Customer Name**: Full name of the customer
- **Address**: Customer's address
- **Contact Number**: Phone number or mobile number

#### 4. Adding Items

**To add an item:**
1. Click "Add Item" button
2. Fill in the item details:
   - **Particulars**: Description of the item/service
   - **Qty**: Quantity (supports decimals)
   - **Rate**: Price per unit
   - **Amount**: Automatically calculated (Qty × Rate)

**To remove an item:**
- Click the red trash icon next to the item
- Note: You must have at least one item

**Multiple Items:**
- Add as many items as needed
- Each item is automatically numbered (S.N.)

#### 5. Review Total
- **Total Amount**: Sum of all items (displayed in numbers)
- **In Words**: Amount converted to words automatically
  - Example: "One Lakh Fifty Nine Thousand Two Hundred Thirty Four Rupees Only"

#### 6. Payment Information
- **Payment Method**: Select from dropdown
  - Cash
  - Due
  - Mobile Payment
  - Card
  - Other
- **Note/Free Due**: Add any additional notes or instructions

#### 7. Save or Generate PDF

**Save Bill:**
- Click "Save Bill" to store in database
- Bill is saved with all information
- Form clears automatically after successful save
- You'll see a success message

**Generate PDF:**
- Click "Generate PDF" to download the bill
- PDF includes all bill information
- Professional format ready for printing
- File name: `Bill_[BillNo]_[CustomerName].pdf`

**Clear Form:**
- Click "Clear Form" to reset all fields
- Generates new bill number
- Useful for starting fresh

---

## Managing Records

### Viewing All Bills

1. Navigate to "Records" page
2. All bills are displayed in a table format
3. Information shown:
   - Bill Number
   - Date (English and Nepali)
   - Customer Name
   - Contact Number
   - Total Amount
   - Payment Method (with color-coded badges)

### Bill Actions

Each bill has three action buttons:

#### 👁️ View Details
- Click the eye icon
- Opens a detailed modal with:
  - Complete bill information
  - All items with quantities and rates
  - Customer details
  - Payment information
- Modal can be closed by:
  - Clicking the X button
  - Clicking outside the modal
  - Clicking "Close" button

#### 📥 Download PDF
- Click the download icon
- Generates and downloads PDF immediately
- Same format as when creating the bill

#### 🗑️ Delete Bill
- Click the trash icon
- Confirmation dialog appears
- Confirm to permanently delete
- Cannot be undone!

---

## Searching Bills

### Search Features

#### 1. Search Field Selection
Choose what to search by:
- **All Fields**: Searches across all bill data
- **Bill Number**: Search by bill number only
- **Customer Name**: Find bills by customer
- **Address**: Search by address
- **Contact Number**: Find by phone number
- **Date**: Search by date (English or Nepali)
- **Payment Method**: Filter by payment type

#### 2. Search Input
- Type your search term
- Results update automatically as you type
- Case-insensitive search
- Partial matches are found

#### 3. Search Results
- Shows "X of Y bills" count
- Filtered results appear in the table
- All actions available on filtered results

#### 4. Refresh
- Click "Refresh" button to reload all bills
- Useful after making changes
- Clears any filters

### Search Examples

**Find a specific bill:**
```
Field: Bill Number
Search: BILL-0042
```

**Find all bills for a customer:**
```
Field: Customer Name
Search: Ram Kumar
```

**Find bills by payment method:**
```
Field: Payment Method
Search: Due
```

**Find bills from a specific date:**
```
Field: Date
Search: 2024-01-15
```

---

## PDF Generation

### PDF Features

The generated PDF includes:
- **Header**: Business name and address
- **Bill Information**: Bill number, dates
- **Customer Details**: Name, address, contact
- **Items Table**: All items with calculations
- **Total Amount**: In numbers and words
- **Payment Details**: Method and notes
- **Footer**: Thank you message

### PDF Layout

```
┌─────────────────────────────────────┐
│         Estimate Bill               │
│    Shop Billing System              │
│    Garuda, Rautahat, Nepal          │
├─────────────────────────────────────┤
│ Bill No: BILL-0001    Date: ...     │
│ Customer: ...         Nepali: ...   │
│ Address: ...                        │
│ Contact: ...                        │
├─────────────────────────────────────┤
│ S.N. | Particulars | Qty | Rate | Amount │
│  1   | Item 1      | 2   | 100  | 200    │
│  2   | Item 2      | 1   | 500  | 500    │
├─────────────────────────────────────┤
│                Total Amount: 700    │
│ In Words: Seven Hundred Rupees Only │
│ Payment Method: Cash                │
├─────────────────────────────────────┤
│ Thank you for your business!        │
└─────────────────────────────────────┘
```

### Printing PDFs

1. Open the downloaded PDF
2. Use your PDF viewer's print function
3. Recommended settings:
   - Paper size: A4
   - Orientation: Portrait
   - Margins: Default
   - Scale: Fit to page

---

## Theme Customization

### Available Themes

#### ☀️ Light Theme
- Bright, clean interface
- Best for daytime use
- High contrast for readability

#### 🌙 Dark Theme
- Dark background
- Reduced eye strain
- Better for low-light environments

#### 💻 System Theme
- Follows your device settings
- Automatically switches based on time
- Seamless experience

### Changing Themes

1. Look for theme icons in the navigation bar
2. Click your preferred theme icon
3. Theme changes immediately
4. Preference is saved in browser
5. Persists across sessions

---

## Tips & Best Practices

### Creating Bills

✅ **Do:**
- Double-check customer information
- Verify quantities and rates
- Review total before saving
- Save important bills immediately
- Use descriptive item names

❌ **Don't:**
- Leave required fields empty
- Use special characters in bill numbers
- Create duplicate bills
- Forget to save before closing

### Managing Records

✅ **Do:**
- Regularly backup your data
- Use search to find bills quickly
- Download PDFs for important bills
- Keep customer information updated

❌ **Don't:**
- Delete bills without confirmation
- Ignore the search feature
- Keep unnecessary bills

### Data Entry

✅ **Best Practices:**
- Use consistent naming for customers
- Include area codes in phone numbers
- Use standard date formats
- Be specific in item descriptions
- Round amounts appropriately

### Performance

✅ **Tips:**
- Clear browser cache periodically
- Use search instead of scrolling
- Close detail modals when done
- Refresh records page occasionally

---

## Troubleshooting

### Common Issues

#### Bill Not Saving
**Problem**: Click "Save Bill" but nothing happens

**Solutions:**
1. Check if all required fields are filled
2. Ensure at least one item is added
3. Verify internet connection
4. Check browser console for errors
5. Try refreshing the page

#### PDF Not Generating
**Problem**: PDF download doesn't start

**Solutions:**
1. Check browser's download settings
2. Allow pop-ups for the site
3. Ensure customer name is filled
4. Try a different browser
5. Check if items are added

#### Search Not Working
**Problem**: Search doesn't show results

**Solutions:**
1. Check spelling
2. Try "All Fields" option
3. Clear search and try again
4. Click "Refresh" button
5. Reload the page

#### Theme Not Changing
**Problem**: Theme selection doesn't work

**Solutions:**
1. Clear browser cache
2. Check if JavaScript is enabled
3. Try a different browser
4. Reload the page

#### Data Not Loading
**Problem**: Records page is empty

**Solutions:**
1. Check internet connection
2. Verify Firebase configuration
3. Check browser console
4. Try refreshing the page
5. Clear browser cache

### Error Messages

#### "Please enter customer name"
- Fill in the customer name field
- Cannot be empty

#### "Please add at least one valid item"
- Add items with all fields filled
- Quantity and rate must be greater than 0

#### "Failed to save bill"
- Check internet connection
- Verify Firebase is configured
- Try again after a moment

#### "Failed to load bills"
- Check internet connection
- Verify Firebase configuration
- Refresh the page

---

## Keyboard Shortcuts

While the app doesn't have specific keyboard shortcuts, you can use standard browser shortcuts:

- **Tab**: Move between fields
- **Enter**: Submit forms (in some fields)
- **Ctrl/Cmd + R**: Refresh page
- **Ctrl/Cmd + P**: Print (when viewing PDF)
- **Esc**: Close modals

---

## Data Privacy & Security

### Your Data
- All bills are stored securely in Firebase
- Data is encrypted in transit
- Only you can access your bills
- No data is shared with third parties

### Best Practices
- Don't share your Firebase credentials
- Use strong passwords if authentication is enabled
- Regularly backup important data
- Log out when using shared computers

---

## Getting Help

### Need Assistance?

1. **Check this guide** for common questions
2. **Review error messages** carefully
3. **Check browser console** for technical errors
4. **Contact support** if issues persist

### Reporting Issues

When reporting issues, include:
- What you were trying to do
- What happened instead
- Error messages (if any)
- Browser and device information
- Steps to reproduce the issue

---

## Frequently Asked Questions

**Q: Can I edit a bill after saving?**
A: Currently, bills cannot be edited after saving. You can delete and create a new one.

**Q: How many bills can I create?**
A: Unlimited, subject to Firebase free tier limits (50,000 reads/day, 20,000 writes/day).

**Q: Can I export all bills to Excel?**
A: This feature is planned for future updates.

**Q: Is my data backed up?**
A: Firebase provides automatic backups, but you should also download important PDFs.

**Q: Can multiple users access the system?**
A: Yes, but user authentication needs to be set up first.

**Q: Can I customize the PDF format?**
A: Yes, by modifying the PDF generator code.

**Q: Does it work offline?**
A: No, an internet connection is required for database operations.

**Q: Can I use this on mobile?**
A: Yes! The interface is fully responsive and works on all devices.

---

## Updates & New Features

Stay tuned for upcoming features:
- Bill editing capability
- Customer management
- Product inventory
- Sales reports
- Excel export
- Email bills
- Multi-user support
- Barcode generation

---

**Happy Billing! 🎉**

For more information, check the README.md or contact support.
