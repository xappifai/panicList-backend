# Deployment Guide

## Setting up Firebase Service Account on Render

### Step 1: Get Your Service Account JSON

1. Go to your Firebase Console
2. Navigate to Project Settings > Service Accounts
3. Click "Generate New Private Key"
4. Download the JSON file
5. Open the JSON file and copy its entire contents

### Step 2: Configure Environment Variable on Render

1. Log in to your Render dashboard
2. Go to your web service
3. Navigate to "Environment" section
4. Add a new environment variable:
   - **Key:** `FIREBASE_SERVICE_ACCOUNT_JSON`
   - **Value:** Paste the entire JSON content from your service account file (should be a single line)

**Important:** Make sure to paste the JSON as a single line without any formatting.

Example format:
```
{"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}
```

### Step 3: Set Other Required Environment Variables

Make sure you also set these on Render:

```
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
PORT=3000
NODE_ENV=production
```

### Step 4: Deploy

After setting all environment variables, trigger a new deployment on Render. Your app should now successfully load the Firebase credentials from the environment variable.

## Local Development

For local development, you can either:

**Option 1:** Use the `Service.json` file (already in `.gitignore`)
- Place your `Service.json` file in the project root
- The app will automatically detect and use it

**Option 2:** Use environment variables locally
- Create a `.env` file in the project root
- Add: `FIREBASE_SERVICE_ACCOUNT_JSON=<your-json-here>`
- The app will use the environment variable instead

## How It Works

The `config/firebase-admin.js` file now supports two methods:

1. **Environment Variable (Priority 1):** Checks for `FIREBASE_SERVICE_ACCOUNT_JSON` first
   - Perfect for cloud deployments (Render, Heroku, etc.)
   - Keeps sensitive credentials out of your codebase

2. **File Path (Priority 2):** Falls back to looking for `Service.json` file
   - Great for local development
   - File is ignored by git for security

## Security Best Practices

✅ **DO:**
- Use environment variables for production deployments
- Keep `Service.json` in `.gitignore`
- Rotate credentials if they're ever exposed
- Use different service accounts for dev/staging/prod

❌ **DON'T:**
- Commit `Service.json` to git
- Share credentials in chat/email
- Use production credentials in development
- Hardcode credentials in your code

## Troubleshooting

### Error: "Service account JSON not found"
- Make sure `FIREBASE_SERVICE_ACCOUNT_JSON` is set on Render
- Verify the JSON is valid (test with `JSON.parse()`)
- Check that there are no extra spaces or newlines

### Error: "Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON"
- The JSON might be malformed
- Make sure special characters are properly escaped
- Try copying the JSON again from Firebase Console

### Error: "Invalid service account"
- Verify the service account has the correct permissions
- Check that the project ID matches your Firebase project
- Ensure the service account key hasn't been deleted from Firebase

