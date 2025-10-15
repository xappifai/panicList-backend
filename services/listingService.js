// Listing service for business logic and database operations
import { adminDb, adminStorage } from '../config/firebase-admin.js';
import { 
  createListingDocument, 
  updateListingDocument, 
  validateListingFilters,
  LISTING_STATUS 
} from '../models/Listing.js';
import { v4 as uuidv4 } from 'uuid';

const COLLECTION_NAME = 'listings';

// Normalize bucket value from env to a valid GCS bucket name
function getNormalizedBucketName(defaultProjectId) {
  const envBucket = process.env.FIREBASE_STORAGE_BUCKET || '';
  let bucket = envBucket.trim();
  if (bucket) {
    bucket = bucket.replace(/^@?gs:\/\//i, '');
    bucket = bucket.replace(/\.firebasestorage\.app$/i, '.appspot.com');
    const match = bucket.match(/(?:\/b\/)([^/]+)(?:\/o|$)/);
    if (match && match[1]) bucket = match[1];
  }
  if (!bucket) {
    const project = process.env.FIREBASE_PROJECT_ID || defaultProjectId || 'panic-list';
    bucket = `${project}.appspot.com`;
  }
  return bucket;
}

class ListingService {
  // Create a new listing
  async createListing(listingData, providerId) {
    try {
      // Add provider ID to the listing data
      const dataWithProvider = {
        ...listingData,
        providerId
      };

      // Validate and create listing document
      const validatedListing = createListingDocument(dataWithProvider);
      
      // Add to Firestore
      const docRef = await adminDb.collection(COLLECTION_NAME).add(validatedListing);
      
      // Get the created document
      const createdListing = await docRef.get();
      
      return {
        id: docRef.id,
        ...createdListing.data()
      };
    } catch (error) {
      console.error('Error creating listing:', error);
      throw new Error(`Failed to create listing: ${error.message}`);
    }
  }

  // Get listing by ID
  async getListingById(listingId) {
    try {
      const doc = await adminDb.collection(COLLECTION_NAME).doc(listingId).get();
      
      if (!doc.exists) {
        throw new Error('Listing not found');
      }
      
      return {
        id: doc.id,
        ...doc.data()
      };
    } catch (error) {
      console.error('Error getting listing:', error);
      throw new Error(`Failed to get listing: ${error.message}`);
    }
  }

  // Get listings with filters and pagination
  async getListings(filters = {}) {
    try {
      // Validate filters
      const validatedFilters = validateListingFilters(filters);
      
      let query = adminDb.collection(COLLECTION_NAME);
      
      // Apply filters - use simple queries to avoid index requirements
      if (validatedFilters.status) {
        query = query.where('status', '==', validatedFilters.status);
      }
      
      if (validatedFilters.category) {
        query = query.where('category', '==', validatedFilters.category);
      }
      
      if (validatedFilters.providerId) {
        query = query.where('providerId', '==', validatedFilters.providerId);
      }
      
      if (validatedFilters.featured !== undefined) {
        query = query.where('featured', '==', validatedFilters.featured);
      }
      
      // Note: Removed orderBy to avoid composite index requirement
      // We'll sort in memory instead
      
      // Note: Simplified pagination to avoid index requirements
      // We'll handle pagination in memory after sorting
      
      const snapshot = await query.get();
      const listings = [];
      
      snapshot.forEach(doc => {
        listings.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      // Sort in memory to avoid index requirement
      const sortField = validatedFilters.sortBy || 'createdAt';
      const sortOrder = validatedFilters.sortOrder || 'desc';
      
      listings.sort((a, b) => {
        let aValue = a[sortField];
        let bValue = b[sortField];
        
        // Handle nested fields like pricing.amount
        if (sortField.includes('.')) {
          const fields = sortField.split('.');
          aValue = fields.reduce((obj, field) => obj?.[field], a);
          bValue = fields.reduce((obj, field) => obj?.[field], b);
        }
        
        // Handle dates
        if (aValue && typeof aValue.toDate === 'function') {
          aValue = aValue.toDate();
        }
        if (bValue && typeof bValue.toDate === 'function') {
          bValue = bValue.toDate();
        }
        
        if (sortOrder === 'desc') {
          return bValue > aValue ? 1 : -1;
        } else {
          return aValue > bValue ? 1 : -1;
        }
      });
      
      // Apply pagination in memory
      const startIndex = validatedFilters.offset;
      const endIndex = startIndex + validatedFilters.limit;
      const paginatedListings = listings.slice(startIndex, endIndex);
      
      return {
        listings: paginatedListings,
        total: listings.length,
        limit: validatedFilters.limit,
        offset: validatedFilters.offset
      };
    } catch (error) {
      console.error('Error getting listings:', error);
      throw new Error(`Failed to get listings: ${error.message}`);
    }
  }

  // Update listing
  async updateListing(listingId, updateData, providerId) {
    try {
      // Get existing listing
      const existingListing = await this.getListingById(listingId);
      
      // Check if the provider owns this listing
      if (existingListing.providerId !== providerId) {
        throw new Error('Unauthorized: You can only update your own listings');
      }
      
      // Validate and update listing document
      const updatedListing = updateListingDocument(existingListing, updateData);
      
      // Update in Firestore
      await adminDb.collection(COLLECTION_NAME).doc(listingId).update(updatedListing);
      
      // Return updated listing
      return await this.getListingById(listingId);
    } catch (error) {
      console.error('Error updating listing:', error);
      throw new Error(`Failed to update listing: ${error.message}`);
    }
  }

  // Delete listing
  async deleteListing(listingId, providerId) {
    try {
      // Get existing listing
      const existingListing = await this.getListingById(listingId);
      
      // Check if the provider owns this listing
      if (existingListing.providerId !== providerId) {
        throw new Error('Unauthorized: You can only delete your own listings');
      }
      
      // Delete associated images from Firebase Storage
      if (existingListing.images && existingListing.images.length > 0) {
        await this.deleteListingImages(existingListing.images);
      }
      
      // Delete from Firestore
      await adminDb.collection(COLLECTION_NAME).doc(listingId).delete();
      
      return { success: true, message: 'Listing deleted successfully' };
    } catch (error) {
      console.error('Error deleting listing:', error);
      throw new Error(`Failed to delete listing: ${error.message}`);
    }
  }

  // Upload image to Firebase Storage
  async uploadListingImage(file, listingId, providerId) {
    try {
      if (!file) {
        throw new Error('No file provided');
      }

      // Generate unique filename
      const fileExtension = file.originalname.split('.').pop();
      const fileName = `listings/${providerId}/${listingId}/${uuidv4()}.${fileExtension}`;
      
      // Use the default bucket configured in Firebase Admin
      const bucket = adminStorage.bucket();
      const fileRef = bucket.file(fileName);
      
      // Create write stream
      const stream = fileRef.createWriteStream({
        metadata: {
          contentType: file.mimetype,
          metadata: {
            listingId,
            providerId,
            uploadedAt: new Date().toISOString()
          }
        }
      });
      
      return new Promise((resolve, reject) => {
        stream.on('error', (error) => {
          console.error('Error uploading file:', error);
          reject(new Error(`Failed to upload image: ${error.message}`));
        });
        
        stream.on('finish', async () => {
          try {
            // Make the file publicly accessible
            await fileRef.makePublic();
            
            // Get the public URL
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
            
            resolve({
              url: publicUrl,
              filename: fileName,
              uploadedAt: new Date(),
              isPrimary: false
            });
          } catch (error) {
            reject(new Error(`Failed to make file public: ${error.message}`));
          }
        });
        
        // Write the file
        stream.end(file.buffer);
      });
    } catch (error) {
      console.error('Error in uploadListingImage:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }

  // Delete images from Firebase Storage
  async deleteListingImages(images) {
    try {
      const bucket = adminStorage.bucket();
      const deletePromises = images.map(async (image) => {
        try {
          const fileRef = bucket.file(image.filename);
          await fileRef.delete();
        } catch (error) {
          console.error(`Error deleting image ${image.filename}:`, error);
          // Don't throw error for individual image deletion failures
        }
      });
      
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Error deleting listing images:', error);
      throw new Error(`Failed to delete images: ${error.message}`);
    }
  }

  // Update listing status
  async updateListingStatus(listingId, status, adminId = null) {
    try {
      const validStatuses = Object.values(LISTING_STATUS);
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
      
      const updateData = {
        status,
        updatedAt: new Date()
      };
      
      // If publishing, set publishedAt
      if (status === LISTING_STATUS.ACTIVE) {
        updateData.publishedAt = new Date();
      }
      
      // If admin is updating, add admin info
      if (adminId) {
        updateData.updatedBy = adminId;
      }
      
      await adminDb.collection(COLLECTION_NAME).doc(listingId).update(updateData);
      
      return await this.getListingById(listingId);
    } catch (error) {
      console.error('Error updating listing status:', error);
      throw new Error(`Failed to update listing status: ${error.message}`);
    }
  }

  // Get listings by provider
  async getListingsByProvider(providerId, filters = {}) {
    try {
      const providerFilters = {
        ...filters,
        providerId
      };
      
      return await this.getListings(providerFilters);
    } catch (error) {
      console.error('Error getting provider listings:', error);
      throw new Error(`Failed to get provider listings: ${error.message}`);
    }
  }

  // Search listings
  async searchListings(searchTerm, filters = {}) {
    try {
      // For now, we'll do a simple text search on title and description
      // In a production app, you might want to use Algolia or Elasticsearch
      const allListings = await this.getListings({ ...filters, limit: 1000 });
      
      const searchResults = allListings.listings.filter(listing => {
        const searchLower = searchTerm.toLowerCase();
        return (
          listing.title.toLowerCase().includes(searchLower) ||
          listing.description.toLowerCase().includes(searchLower) ||
          listing.tags.some(tag => tag.toLowerCase().includes(searchLower))
        );
      });
      
      return {
        listings: searchResults,
        total: searchResults.length,
        searchTerm
      };
    } catch (error) {
      console.error('Error searching listings:', error);
      throw new Error(`Failed to search listings: ${error.message}`);
    }
  }
}

export default new ListingService();
