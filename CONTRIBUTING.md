# Contributing to Shop Billing System

Thank you for your interest in contributing to the Shop Billing System! This document provides guidelines and instructions for contributing.

## Table of Contents
1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Setup](#development-setup)
4. [How to Contribute](#how-to-contribute)
5. [Coding Standards](#coding-standards)
6. [Commit Guidelines](#commit-guidelines)
7. [Pull Request Process](#pull-request-process)
8. [Testing](#testing)
9. [Documentation](#documentation)

---

## Code of Conduct

### Our Pledge
We are committed to providing a welcoming and inspiring community for all.

### Our Standards
- Be respectful and inclusive
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards others

---

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Git
- Firebase account
- Code editor (VS Code recommended)

### Recommended VS Code Extensions
- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- ES7+ React/Redux/React-Native snippets

---

## Development Setup

1. **Fork the repository**
   ```bash
   # Click the "Fork" button on GitHub
   ```

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/shop-billing-system.git
   cd shop-billing-system
   ```

3. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/shop-billing-system.git
   ```

4. **Install dependencies**
   ```bash
   npm install
   ```

5. **Set up Firebase**
   - Follow FIREBASE_SETUP.md
   - Create your own Firebase project for development
   - Update src/firebase/config.ts

6. **Start development server**
   ```bash
   npm run dev
   ```

---

## How to Contribute

### Reporting Bugs

**Before submitting a bug report:**
- Check existing issues
- Try to reproduce the bug
- Collect relevant information

**Bug report should include:**
- Clear title and description
- Steps to reproduce
- Expected vs actual behavior
- Screenshots (if applicable)
- Browser and OS information
- Error messages or console logs

**Example:**
```markdown
**Bug**: PDF generation fails for bills with more than 10 items

**Steps to reproduce:**
1. Create a bill with 15 items
2. Click "Generate PDF"
3. Error appears in console

**Expected**: PDF should generate successfully
**Actual**: Error: "Maximum call stack size exceeded"

**Environment:**
- Browser: Chrome 120
- OS: Windows 11
- Version: 1.0.0
```

### Suggesting Features

**Feature request should include:**
- Clear title and description
- Use case and motivation
- Proposed solution
- Alternative solutions considered
- Additional context

**Example:**
```markdown
**Feature**: Add bill editing capability

**Use case**: Users need to correct mistakes in saved bills

**Proposed solution:**
- Add "Edit" button in bill details modal
- Load bill data into create form
- Update instead of create new bill

**Alternatives:**
- Delete and recreate (current workaround)
- Version history with edits
```

### Contributing Code

1. **Find or create an issue**
   - Check existing issues
   - Create new issue if needed
   - Get approval before starting work

2. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/bug-description
   ```

3. **Make your changes**
   - Write clean, readable code
   - Follow coding standards
   - Add comments where needed
   - Update documentation

4. **Test your changes**
   - Test manually
   - Add automated tests if applicable
   - Ensure no regressions

5. **Commit your changes**
   - Follow commit guidelines
   - Write clear commit messages

6. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create Pull Request**
   - Use PR template
   - Link related issues
   - Provide clear description

---

## Coding Standards

### TypeScript/JavaScript

**General Rules:**
- Use TypeScript for type safety
- Use functional components
- Use hooks instead of class components
- Avoid `any` type
- Use meaningful variable names
- Keep functions small and focused

**Example:**
```typescript
// ✅ Good
interface BillItem {
  sn: number;
  particulars: string;
  qty: number;
  rate: number;
  amount: number;
}

const calculateTotal = (items: BillItem[]): number => {
  return items.reduce((sum, item) => sum + item.amount, 0);
};

// ❌ Bad
const calc = (items: any) => {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total = total + items[i].amount;
  }
  return total;
};
```

### React Components

**Component Structure:**
```typescript
// 1. Imports
import React, { useState, useEffect } from 'react';
import { SomeType } from '../types';
import './Component.css';

// 2. Types/Interfaces
interface ComponentProps {
  prop1: string;
  prop2: number;
}

// 3. Component
const Component: React.FC<ComponentProps> = ({ prop1, prop2 }) => {
  // 4. State
  const [state, setState] = useState<string>('');

  // 5. Effects
  useEffect(() => {
    // Effect logic
  }, []);

  // 6. Handlers
  const handleClick = () => {
    // Handler logic
  };

  // 7. Render
  return (
    <div className="component">
      {/* JSX */}
    </div>
  );
};

// 8. Export
export default Component;
```

### CSS

**Naming Convention:**
- Use kebab-case for class names
- Use BEM methodology where appropriate
- Prefix component-specific classes

**Example:**
```css
/* Component: CreateBill */
.create-bill-page { }
.create-bill-page__header { }
.create-bill-page__form { }
.create-bill-page__form--loading { }

/* Utility classes */
.btn { }
.btn-primary { }
.card { }
```

### File Organization

```
src/
├── components/       # Reusable components
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.css
│   │   └── index.ts
├── pages/           # Page components
├── services/        # API services
├── utils/           # Utility functions
├── types/           # Type definitions
├── context/         # React contexts
└── firebase/        # Firebase config
```

---

## Commit Guidelines

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

### Examples

```bash
# Feature
feat(billing): add bill editing capability

# Bug fix
fix(pdf): resolve issue with long item names

# Documentation
docs(readme): update installation instructions

# Style
style(navbar): improve responsive layout

# Refactor
refactor(utils): optimize number to words conversion

# Test
test(billing): add unit tests for bill service

# Chore
chore(deps): update dependencies
```

### Commit Best Practices
- Use present tense ("add feature" not "added feature")
- Use imperative mood ("move cursor to..." not "moves cursor to...")
- Limit first line to 72 characters
- Reference issues in footer

---

## Pull Request Process

### Before Submitting

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No console errors or warnings
- [ ] Tested on multiple browsers
- [ ] Responsive design verified

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Fixes #123

## Changes Made
- Change 1
- Change 2
- Change 3

## Screenshots (if applicable)
[Add screenshots]

## Testing
- [ ] Tested locally
- [ ] Tested on mobile
- [ ] Tested on different browsers

## Checklist
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] No breaking changes
- [ ] All tests pass
```

### Review Process

1. **Automated Checks**
   - Linting passes
   - Build succeeds
   - Tests pass (if applicable)

2. **Code Review**
   - At least one approval required
   - Address review comments
   - Make requested changes

3. **Merge**
   - Squash and merge (preferred)
   - Rebase and merge
   - Create merge commit

---

## Testing

### Manual Testing

**Test Checklist:**
- [ ] Create bill with valid data
- [ ] Create bill with invalid data
- [ ] Generate PDF
- [ ] Search bills
- [ ] View bill details
- [ ] Delete bill
- [ ] Theme switching
- [ ] Responsive design
- [ ] Browser compatibility

### Automated Testing (Future)

```typescript
// Example test structure
describe('Bill Service', () => {
  it('should create a bill', async () => {
    const bill = { /* bill data */ };
    const id = await createBill(bill);
    expect(id).toBeDefined();
  });

  it('should calculate total correctly', () => {
    const items = [
      { sn: 1, particulars: 'Item 1', qty: 2, rate: 100, amount: 200 },
      { sn: 2, particulars: 'Item 2', qty: 1, rate: 500, amount: 500 }
    ];
    const total = calculateTotal(items);
    expect(total).toBe(700);
  });
});
```

---

## Documentation

### Code Documentation

**Add comments for:**
- Complex logic
- Non-obvious solutions
- Important decisions
- Public APIs

**Example:**
```typescript
/**
 * Converts a number to words in Indian numbering system
 * @param num - The number to convert
 * @param language - Language for conversion ('en' or 'ne')
 * @returns The number in words
 * @example
 * numberToWords(159234, 'en')
 * // Returns: "One Lakh Fifty Nine Thousand Two Hundred Thirty Four Rupees Only"
 */
export const numberToWords = (num: number, language: 'en' | 'ne' = 'en'): string => {
  // Implementation
};
```

### README Updates

Update README.md when:
- Adding new features
- Changing setup process
- Updating dependencies
- Modifying configuration

### User Guide Updates

Update USER_GUIDE.md when:
- Adding user-facing features
- Changing UI/UX
- Adding new workflows
- Fixing common issues

---

## Questions?

- Open an issue for questions
- Check existing documentation
- Ask in discussions (if enabled)

---

## Recognition

Contributors will be recognized in:
- README.md contributors section
- CHANGELOG.md
- Release notes

---

**Thank you for contributing! 🎉**

Your contributions make this project better for everyone.
