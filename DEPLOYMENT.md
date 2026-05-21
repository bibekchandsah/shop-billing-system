# Deployment Guide

This guide covers multiple deployment options for the Shop Billing System.

## Table of Contents
1. [Firebase Hosting](#firebase-hosting)
2. [Vercel](#vercel)
3. [Netlify](#netlify)
4. [GitHub Pages](#github-pages)
5. [Traditional Web Server](#traditional-web-server)

---

## Firebase Hosting

Firebase Hosting is recommended as it integrates seamlessly with Firebase services.

### Prerequisites
- Firebase CLI installed
- Firebase project set up

### Steps

1. **Install Firebase CLI** (if not already installed)
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**
   ```bash
   firebase login
   ```

3. **Initialize Firebase Hosting**
   ```bash
   firebase init hosting
   ```
   
   Configuration:
   - Select your Firebase project
   - Public directory: `dist`
   - Single-page app: `Yes`
   - Automatic builds with GitHub: `No` (or Yes if you want CI/CD)

4. **Build your application**
   ```bash
   npm run build
   ```

5. **Deploy to Firebase**
   ```bash
   firebase deploy --only hosting
   ```

6. **Your app is live!**
   - URL: `https://your-project-id.web.app`
   - Or custom domain: `https://your-project-id.firebaseapp.com`

### Custom Domain

1. Go to Firebase Console > Hosting
2. Click "Add custom domain"
3. Follow the instructions to verify and connect your domain

---

## Vercel

Vercel offers excellent performance and automatic deployments from Git.

### Steps

1. **Install Vercel CLI** (optional)
   ```bash
   npm install -g vercel
   ```

2. **Deploy via CLI**
   ```bash
   npm run build
   vercel
   ```

3. **Or Deploy via GitHub**
   - Push your code to GitHub
   - Go to [vercel.com](https://vercel.com)
   - Click "Import Project"
   - Select your repository
   - Configure:
     - Framework Preset: Vite
     - Build Command: `npm run build`
     - Output Directory: `dist`
   - Add environment variables (Firebase config)
   - Click "Deploy"

### Environment Variables on Vercel

Add these in Vercel Dashboard > Settings > Environment Variables:
```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

---

## Netlify

Netlify provides easy deployment with continuous integration.

### Steps

1. **Deploy via Drag & Drop**
   ```bash
   npm run build
   ```
   - Go to [netlify.com](https://netlify.com)
   - Drag the `dist` folder to Netlify

2. **Or Deploy via GitHub**
   - Push code to GitHub
   - Go to Netlify Dashboard
   - Click "New site from Git"
   - Select your repository
   - Configure:
     - Build command: `npm run build`
     - Publish directory: `dist`
   - Add environment variables
   - Click "Deploy site"

### Netlify Configuration File

Create `netlify.toml` in your project root:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  NODE_VERSION = "18"
```

---

## GitHub Pages

GitHub Pages is free but requires some additional configuration.

### Steps

1. **Install gh-pages package**
   ```bash
   npm install --save-dev gh-pages
   ```

2. **Update package.json**
   ```json
   {
     "homepage": "https://yourusername.github.io/shop-billing-system",
     "scripts": {
       "predeploy": "npm run build",
       "deploy": "gh-pages -d dist"
     }
   }
   ```

3. **Update vite.config.ts**
   ```typescript
   import { defineConfig } from 'vite'
   import react from '@vitejs/plugin-react'

   export default defineConfig({
     plugins: [react()],
     base: '/shop-billing-system/' // Your repo name
   })
   ```

4. **Deploy**
   ```bash
   npm run deploy
   ```

5. **Enable GitHub Pages**
   - Go to repository Settings > Pages
   - Source: Deploy from branch
   - Branch: gh-pages
   - Save

---

## Traditional Web Server

Deploy to Apache, Nginx, or any web server.

### Build the Application

```bash
npm run build
```

This creates a `dist` folder with all static files.

### Apache Configuration

Create `.htaccess` in the `dist` folder:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

### Nginx Configuration

Add to your nginx config:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /path/to/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Upload Files

1. Upload the contents of `dist` folder to your web server
2. Ensure the web server is configured to serve the files
3. Test the deployment

---

## Environment Variables for Production

### Option 1: Build-time Variables

Create `.env.production`:

```env
VITE_FIREBASE_API_KEY=your_production_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_production_auth_domain
VITE_FIREBASE_PROJECT_ID=your_production_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_production_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_production_sender_id
VITE_FIREBASE_APP_ID=your_production_app_id
```

Build with production env:
```bash
npm run build
```

### Option 2: Runtime Configuration

For more flexibility, use a config file that's loaded at runtime.

---

## Pre-Deployment Checklist

- [ ] Update Firebase configuration with production credentials
- [ ] Set up proper Firestore security rules
- [ ] Test all features in production mode locally
- [ ] Optimize images and assets
- [ ] Enable Firebase App Check
- [ ] Set up error monitoring (e.g., Sentry)
- [ ] Configure analytics
- [ ] Test on multiple devices and browsers
- [ ] Set up custom domain (if applicable)
- [ ] Configure SSL certificate
- [ ] Set up backup strategy
- [ ] Document deployment process
- [ ] Create rollback plan

---

## Performance Optimization

### 1. Code Splitting
Already handled by Vite, but you can add route-based splitting:

```typescript
import { lazy, Suspense } from 'react';

const CreateBill = lazy(() => import('./pages/CreateBill'));
const Records = lazy(() => import('./pages/Records'));

// In your routes:
<Suspense fallback={<div>Loading...</div>}>
  <CreateBill />
</Suspense>
```

### 2. Image Optimization
- Use WebP format
- Compress images
- Use appropriate sizes

### 3. Caching Strategy
Configure in your hosting platform or web server.

### 4. CDN
Use a CDN for static assets:
- Cloudflare
- AWS CloudFront
- Google Cloud CDN

---

## Monitoring and Analytics

### Firebase Analytics
Already integrated if you enabled it during setup.

### Google Analytics
Add to `index.html`:

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

### Error Tracking
Consider adding Sentry:

```bash
npm install @sentry/react
```

---

## Continuous Deployment

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Firebase Hosting

on:
  push:
    branches:
      - main

jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.FIREBASE_APP_ID }}
      
      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          projectId: your-project-id
```

---

## Troubleshooting

### Blank page after deployment
- Check browser console for errors
- Verify base URL in vite.config.ts
- Check if all assets are loading correctly

### Firebase connection issues
- Verify Firebase configuration
- Check Firestore security rules
- Ensure API keys are correct

### Routing not working
- Configure server for SPA routing
- Check .htaccess or nginx config

### Environment variables not working
- Ensure variables start with `VITE_`
- Rebuild after changing env variables
- Check if variables are set in hosting platform

---

## Support

For deployment issues:
- Check hosting platform documentation
- Review Firebase Console logs
- Check browser console for errors
- Review server logs

---

**Ready to deploy?** Choose your preferred platform and follow the steps above!
