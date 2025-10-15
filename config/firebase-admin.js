import 'dotenv/config';
import { join } from 'path';
import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';


function getServiceAccount() {
  // Option 1: Load from single JSON environment variable (for production/cloud deployments)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    console.log("🔐 Loading service account from FIREBASE_SERVICE_ACCOUNT_JSON environment variable");
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch (error) {
      throw new Error(`❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: ${error.message}`);
    }
  }

  // Option 2: Build from individual environment variables
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    console.log("🔐 Building service account from individual environment variables");
    return {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL.replace('@', '%40')}`
    };
  }

  // Option 3: Load from file (for local development)
  let keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (!keyPath) {
    keyPath = join(process.cwd(), "Service.json");
  } else {
    keyPath = join(process.cwd(), keyPath);
  }

  console.log("📂 Looking for service account file at:", keyPath);

  if (!existsSync(keyPath)) {
    throw new Error(`❌ Service account JSON not found. Please either:
    1. Set FIREBASE_SERVICE_ACCOUNT_JSON environment variable with complete JSON, OR
    2. Set individual variables: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL, OR
    3. Provide Service.json file at: ${keyPath}`);
  }

  return JSON.parse(readFileSync(keyPath, "utf8"));
}



const serviceAccount = getServiceAccount();
const bucketName = process.env.FIREBASE_STORAGE_BUCKET;

console.log('🔧 Initializing Firebase Admin with:');
console.log(`   Project ID: ${serviceAccount.project_id}`);
console.log(`   Client Email: ${serviceAccount.client_email}`);
console.log(`   Storage Bucket: ${bucketName}`);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: bucketName,
  });
}

const gcsBucket = admin.storage().bucket();

async function testBucketAccess() {
  try {
    const [exists] = await gcsBucket.exists();
    console.log(`🔍 Bucket exists: ${exists}`);
  } catch (error) {
    console.error('❌ Error testing bucket access:', error.message);
  }
}
testBucketAccess();

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export const adminStorage = admin.storage();
export { gcsBucket };

export default admin;
