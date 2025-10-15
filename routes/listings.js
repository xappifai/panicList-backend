// routes/listings.js
import express from 'express';
import multer from 'multer';
import listingService from '../services/listingService.js';
import { verifyToken, requireProvider } from '../middleware/auth.js';

const router = express.Router();

// -----------------------------
// Multer config (memory storage)
// -----------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    file.mimetype.startsWith('image/')
      ? cb(null, true)
      : cb(new Error('Only image files are allowed'), false);
  }
});

// Multer error handler
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'File too large. Max size is 10MB.' });
  }
  if (error.message === 'Only image files are allowed') {
    return res.status(400).json({ success: false, message: error.message });
  }
  next(error);
};

// -----------------------------
// Helpers
// -----------------------------
const sendError = (res, error, defaultMsg, codes = {}) => {
  console.error(defaultMsg, error);
  const status = Object.entries(codes).find(([key]) => error.message?.includes(key))?.[1] || 500;
  res.status(status).json({ success: false, message: error.message || defaultMsg });
};

const ensureOwnership = (listing, providerId) => {
  if (listing.providerId !== providerId) {
    const err = new Error('Unauthorized: You can only modify your own listings');
    err.status = 403;
    throw err;
  }
};

// -----------------------------
// Routes
// -----------------------------

// GET /api/listings
router.get('/', async (req, res) => {
  try {
    const result = await listingService.getListings(req.query);
    res.json({ success: true, data: result, message: 'Listings retrieved successfully' });
  } catch (error) {
    sendError(res, error, 'Failed to retrieve listings');
  }
});

// GET /api/listings/search
router.get('/search', async (req, res) => {
  try {
    const { q: searchTerm, ...filters } = req.query;
    if (!searchTerm) return res.status(400).json({ success: false, message: 'Search term is required' });

    const result = await listingService.searchListings(searchTerm, filters);
    res.json({ success: true, data: result, message: 'Search completed successfully' });
  } catch (error) {
    sendError(res, error, 'Failed to search listings');
  }
});

// GET /api/listings/:id
router.get('/:id', async (req, res) => {
  try {
    const listing = await listingService.getListingById(req.params.id);
    res.json({ success: true, data: listing, message: 'Listing retrieved successfully' });
  } catch (error) {
    sendError(res, error, 'Failed to retrieve listing', { 'not found': 404 });
  }
});

// GET /api/listings/provider/:providerId
router.get('/provider/:providerId', async (req, res) => {
  try {
    const result = await listingService.getListingsByProvider(req.params.providerId, req.query);
    res.json({ success: true, data: result, message: 'Provider listings retrieved successfully' });
  } catch (error) {
    sendError(res, error, 'Failed to retrieve provider listings');
  }
});

// POST /api/listings
router.post('/', verifyToken, requireProvider, async (req, res) => {
  try {
    const listing = await listingService.createListing(req.body, req.user.uid);
    res.status(201).json({ success: true, data: listing, message: 'Listing created successfully' });
  } catch (error) {
    sendError(res, error, 'Failed to create listing', { 'Validation error': 400 });
  }
});

// POST /api/listings/:id/images
router.post('/:id/images', verifyToken, requireProvider, upload.array('images', 10), handleMulterError, async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ success: false, message: 'No images provided' });

    const { id: listingId } = req.params;
    const providerId = req.user.uid;

    const [currentListing, uploadedImages] = await Promise.all([
      listingService.getListingById(listingId),
      Promise.all(req.files.map(file => listingService.uploadListingImage(file, listingId, providerId)))
    ]);

    ensureOwnership(currentListing, providerId);

    const updatedListing = await listingService.updateListing(
      listingId,
      { images: [...(currentListing.images || []), ...uploadedImages] },
      providerId
    );

    res.json({ success: true, data: { listing: updatedListing, uploadedImages }, message: 'Images uploaded successfully' });
  } catch (error) {
    sendError(res, error, 'Failed to upload images');
  }
});

// PUT /api/listings/:id
router.put('/:id', verifyToken, requireProvider, async (req, res) => {
  try {
    const updatedListing = await listingService.updateListing(req.params.id, req.body, req.user.uid);
    res.json({ success: true, data: updatedListing, message: 'Listing updated successfully' });
  } catch (error) {
    sendError(res, error, 'Failed to update listing', { Unauthorized: 403, 'not found': 404 });
  }
});

// PATCH /api/listings/:id/status
router.patch('/:id/status', verifyToken, requireProvider, async (req, res) => {
  try {
    if (!req.body.status) return res.status(400).json({ success: false, message: 'Status is required' });

    const listing = await listingService.getListingById(req.params.id);
    ensureOwnership(listing, req.user.uid);

    const updatedListing = await listingService.updateListingStatus(req.params.id, req.body.status);
    res.json({ success: true, data: updatedListing, message: 'Listing status updated successfully' });
  } catch (error) {
    sendError(res, error, 'Failed to update listing status', { Unauthorized: 403, 'not found': 404 });
  }
});

// DELETE /api/listings/:id
router.delete('/:id', verifyToken, requireProvider, async (req, res) => {
  try {
    const result = await listingService.deleteListing(req.params.id, req.user.uid);
    res.json({ success: true, data: result, message: 'Listing deleted successfully' });
  } catch (error) {
    sendError(res, error, 'Failed to delete listing', { Unauthorized: 403, 'not found': 404 });
  }
});

// DELETE /api/listings/:id/images/:imageId
router.delete('/:id/images/:imageId', verifyToken, requireProvider, async (req, res) => {
  try {
    const { id: listingId, imageId } = req.params;
    const providerId = req.user.uid;

    const currentListing = await listingService.getListingById(listingId);
    ensureOwnership(currentListing, providerId);

    const imageToDelete = currentListing.images.find(img => img.filename === imageId);
    if (!imageToDelete) return res.status(404).json({ success: false, message: 'Image not found' });

    await listingService.deleteListingImages([imageToDelete]);

    const updatedListing = await listingService.updateListing(
      listingId,
      { images: currentListing.images.filter(img => img.filename !== imageId) },
      providerId
    );

    res.json({ success: true, data: updatedListing, message: 'Image deleted successfully' });
  } catch (error) {
    sendError(res, error, 'Failed to delete image', { Unauthorized: 403, 'not found': 404 });
  }
});

export default router;
