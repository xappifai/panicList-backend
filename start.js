#!/usr/bin/env node

// Startup script for Panic List Backend
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

console.log('🚀 Starting Panic List Backend...\n');

// Check if node_modules exists
if (!existsSync(join(process.cwd(), 'node_modules'))) {
  console.log('📦 Installing dependencies...');
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Dependencies installed successfully!\n');
  } catch (error) {
    console.error('❌ Failed to install dependencies:', error.message);
    process.exit(1);
  }
}

// Check if service account key exists
if (!existsSync(join(process.cwd(), 'serviceAccountKey.json'))) {
  console.log('⚠️  Warning: serviceAccountKey.json not found');
  console.log('   The app will use environment variables or config fallback\n');
}

// Start the server
console.log('🔥 Starting Firebase backend server...');
console.log('📊 Environment:', process.env.NODE_ENV || 'development');
console.log('🔗 Server will be available at: http://localhost:5000');
console.log('📚 API Documentation: http://localhost:5000');
console.log('❤️  Health Check: http://localhost:5000/health\n');

try {
  // Import and start the server
  const app = await import('./index.js');
  console.log('✅ Server started successfully!');
} catch (error) {
  console.error('❌ Failed to start server:', error.message);
  process.exit(1);
}
