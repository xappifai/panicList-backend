# Panic List Backend API

A comprehensive backend API for the Panic List application built with Express.js and Firebase.

## Features

- 🔐 **Firebase Authentication** - Complete auth system with email/password and Google sign-in
- 🗄️ **Firestore Database** - NoSQL database for user data and application state
- 👥 **Multi-User Types** - Support for Clients, Providers, and Admins
- 🛡️ **Security** - JWT tokens, rate limiting, input validation, and CORS protection
- 📊 **Provider Management** - Verification system, ratings, and service management
- 🔍 **Search & Filtering** - Advanced user search and filtering capabilities
- 📱 **RESTful API** - Clean, well-documented API endpoints

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Validation**: Joi
- **Security**: Helmet, CORS, Rate Limiting
- **Logging**: Morgan

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd panic-list-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```
   
   Update the `.env` file with your Firebase configuration:
   ```env
   # Firebase Configuration
   FIREBASE_API_KEY=your-api-key
   FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   FIREBASE_APP_ID=your-app-id
   FIREBASE_MEASUREMENT_ID=your-measurement-id

   # Server Configuration
   PORT=5000
   NODE_ENV=development
   JWT_SECRET=your-super-secret-jwt-key
   CORS_ORIGIN=http://localhost:3000
   ```

4. **Firebase Setup**
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Authentication and Firestore Database
   - Download your service account key and save as `serviceAccountKey.json` in the root directory
   - Or set up environment variables for Firebase Admin SDK

5. **Start the server**
   ```bash
   # Development
   npm run dev

   # Production
   npm start
   ```

## API Endpoints

### Authentication

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| POST | `/api/auth/signup` | Register new user | Public |
| POST | `/api/auth/signup/provider` | Register new provider | Public |
| POST | `/api/auth/login` | Login user | Public |
| POST | `/api/auth/google` | Google sign-in | Public |
| POST | `/api/auth/logout` | Logout user | Private |
| POST | `/api/auth/reset-password` | Send password reset email | Public |
| PUT | `/api/auth/update-password` | Update password | Private |
| GET | `/api/auth/me` | Get current user | Private |
| PUT | `/api/auth/profile` | Update profile | Private |
| DELETE | `/api/auth/account` | Delete account | Private |

### User Management

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| GET | `/api/users/search` | Search users | Admin |
| GET | `/api/users/clients` | Get all clients | Admin |
| GET | `/api/users/providers` | Get all providers | Public |
| GET | `/api/users/providers/by-service/:service` | Get providers by service | Public |
| GET | `/api/users/:id` | Get user by ID | Private |
| PUT | `/api/users/:id` | Update user profile | Private |
| PUT | `/api/users/:id/status` | Update user status | Admin |
| PUT | `/api/users/:id/verify` | Verify provider | Admin |
| POST | `/api/users/:id/rating` | Rate provider | Client |
| DELETE | `/api/users/:id` | Delete user | Admin |

## User Types

### Client
- Basic user account
- Can search and book services
- Can rate providers
- Subscription management

### Provider
- Service provider account
- Business information required
- Verification system
- Service and availability management
- Rating and review system

### Admin
- Full system access
- User management
- Provider verification
- Analytics and reporting

## Data Models

### User Model
```javascript
{
  uid: string,
  email: string,
  fullName: string,
  userType: 'client' | 'provider' | 'admin',
  status: 'active' | 'inactive' | 'pending' | 'suspended',
  createdAt: timestamp,
  updatedAt: timestamp,
  lastLoginAt: timestamp,
  profileImage: string,
  phoneNumber: string,
  address: object
}
```

### Provider Model (extends User)
```javascript
{
  businessInfo: {
    businessName: string,
    businessType: string,
    description: string,
    website: string,
    licenseNumber: string,
    taxId: string
  },
  services: array,
  availability: object,
  verification: {
    status: 'pending' | 'verified' | 'rejected',
    documents: array,
    verifiedAt: timestamp,
    verifiedBy: string
  },
  rating: {
    average: number,
    totalReviews: number
  },
  pricing: {
    hourlyRate: number,
    serviceRates: object
  }
}
```

## Authentication

The API uses Firebase Authentication with JWT tokens. Include the token in the Authorization header:

```javascript
Authorization: Bearer <firebase-id-token>
```

## Error Handling

All endpoints return consistent error responses:

```javascript
{
  "success": false,
  "message": "Error description",
  "errors": [] // Validation errors if applicable
}
```

## Rate Limiting

- **General API**: 100 requests per 15 minutes per IP
- **Auth endpoints**: 10 requests per 15 minutes per IP

## Security Features

- ✅ Helmet.js for security headers
- ✅ CORS protection
- ✅ Rate limiting
- ✅ Input validation with Joi
- ✅ Firebase Auth integration
- ✅ Environment variable protection
- ✅ Error handling and logging

## Development

### Scripts
```bash
npm run dev      # Start development server with nodemon
npm start        # Start production server
npm test         # Run tests
```

### Environment Variables
- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (default: 5000)
- `FIREBASE_*`: Firebase configuration
- `JWT_SECRET`: JWT signing secret
- `CORS_ORIGIN`: Allowed CORS origins

## Deployment

1. **Environment Setup**
   - Set production environment variables
   - Configure Firebase for production
   - Set up proper CORS origins

2. **Deploy to your preferred platform**
   - Heroku
   - Vercel
   - AWS
   - Google Cloud Platform

3. **Health Check**
   - Monitor `/health` endpoint
   - Set up logging and monitoring

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support and questions, please contact the development team or create an issue in the repository.
