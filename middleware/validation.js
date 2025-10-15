// Validation middleware using Joi
import Joi from 'joi';

// Generic validation middleware
export const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], { abortEarly: false });
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    
    req[property] = value;
    next();
  };
};

// User registration validation
export const validateUserRegistration = validate(
  Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    password: Joi.string().min(6).required().messages({
      'string.min': 'Password must be at least 6 characters long',
      'any.required': 'Password is required'
    }),
    fullName: Joi.string().min(2).max(100).required().messages({
      'string.min': 'Full name must be at least 2 characters long',
      'string.max': 'Full name must not exceed 100 characters',
      'any.required': 'Full name is required'
    }),
    userType: Joi.string().valid('client', 'provider', 'admin').required().messages({
      'any.only': 'User type must be client, provider, or admin',
      'any.required': 'User type is required'
    }),
    phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional().messages({
      'string.pattern.base': 'Please provide a valid phone number'
    }),
    dateOfBirth: Joi.date().max('now').optional().messages({
      'date.max': 'Date of birth cannot be in the future'
    })
  })
);

// Basic provider registration validation (for signup)
export const validateProviderRegistration = validate(
  Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    fullName: Joi.string().min(2).max(100).required(),
    userType: Joi.string().valid('provider').required(),
    phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional().messages({
      'string.pattern.base': 'Please provide a valid phone number'
    }),
    businessInfo: Joi.object({
      businessName: Joi.string().min(2).max(100).optional().messages({
        'string.min': 'Business name must be at least 2 characters long',
        'string.max': 'Business name must not exceed 100 characters'
      }),
      businessType: Joi.string().optional(),
      description: Joi.string().max(500).optional().messages({
        'string.max': 'Description must not exceed 500 characters'
      }),
      website: Joi.string().uri().optional().messages({
        'string.uri': 'Please provide a valid website URL'
      }),
      licenseNumber: Joi.string().optional(),
      taxId: Joi.string().optional()
    }).optional(),
    services: Joi.array().items(Joi.string()).optional(),
    address: Joi.object({
      street: Joi.string().optional(),
      city: Joi.string().optional(),
      state: Joi.string().optional(),
      zipCode: Joi.string().optional(),
      country: Joi.string().optional()
    }).optional()
  })
);

// Complete provider registration validation (for profile completion)
export const validateCompleteProviderRegistration = validate(
  Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    fullName: Joi.string().min(2).max(100).required(),
    userType: Joi.string().valid('provider').required(),
    businessInfo: Joi.object({
      businessName: Joi.string().min(2).max(100).required().messages({
        'string.min': 'Business name must be at least 2 characters long',
        'string.max': 'Business name must not exceed 100 characters',
        'any.required': 'Business name is required'
      }),
      businessType: Joi.string().required().messages({
        'any.required': 'Business type is required'
      }),
      description: Joi.string().max(500).optional().messages({
        'string.max': 'Description must not exceed 500 characters'
      }),
      website: Joi.string().uri().optional().messages({
        'string.uri': 'Please provide a valid website URL'
      }),
      licenseNumber: Joi.string().optional(),
      taxId: Joi.string().optional()
    }).required(),
    services: Joi.array().items(Joi.string()).min(1).required().messages({
      'array.min': 'Please select at least one service',
      'any.required': 'Services are required'
    }),
    phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required().messages({
      'string.pattern.base': 'Please provide a valid phone number',
      'any.required': 'Phone number is required'
    }),
    address: Joi.object({
      street: Joi.string().required().messages({
        'any.required': 'Street address is required'
      }),
      city: Joi.string().required().messages({
        'any.required': 'City is required'
      }),
      state: Joi.string().required().messages({
        'any.required': 'State is required'
      }),
      zipCode: Joi.string().required().messages({
        'any.required': 'ZIP code is required'
      }),
      country: Joi.string().required().messages({
        'any.required': 'Country is required'
      })
    }).required()
  })
);

// Login validation
export const validateLogin = validate(
  Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    password: Joi.string().required().messages({
      'any.required': 'Password is required'
    }),
    userType: Joi.string().valid('client', 'provider', 'admin').optional().messages({
      'any.only': 'User type must be client, provider, or admin'
    })
  })
);

// Password reset validation
export const validatePasswordReset = validate(
  Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    })
  })
);

// Password update validation
export const validatePasswordUpdate = validate(
  Joi.object({
    currentPassword: Joi.string().required().messages({
      'any.required': 'Current password is required'
    }),
    newPassword: Joi.string().min(6).required().messages({
      'string.min': 'New password must be at least 6 characters long',
      'any.required': 'New password is required'
    })
  })
);

// Profile update validation
export const validateProfileUpdate = validate(
  Joi.object({
    fullName: Joi.string().min(2).max(100).optional(),
    phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional().messages({
      'string.pattern.base': 'Please provide a valid phone number'
    }),
    dateOfBirth: Joi.date().max('now').optional().messages({
      'date.max': 'Date of birth cannot be in the future'
    }),
    address: Joi.object({
      street: Joi.string().optional(),
      city: Joi.string().optional(),
      state: Joi.string().optional(),
      zipCode: Joi.string().optional(),
      country: Joi.string().optional()
    }).optional(),
    profileImage: Joi.string().uri().optional().messages({
      'string.uri': 'Please provide a valid image URL'
    })
  })
);

// Provider profile update validation
export const validateProviderProfileUpdate = validate(
  Joi.object({
    fullName: Joi.string().min(2).max(100).optional(),
    phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
    businessInfo: Joi.object({
      businessName: Joi.string().min(2).max(100).optional(),
      businessType: Joi.string().optional(),
      description: Joi.string().max(500).optional(),
      website: Joi.string().uri().optional(),
      licenseNumber: Joi.string().optional(),
      taxId: Joi.string().optional()
    }).optional(),
    services: Joi.array().items(Joi.string()).optional(),
    availability: Joi.object().pattern(
      Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'),
      Joi.object({
        start: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        end: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        available: Joi.boolean().optional()
      })
    ).optional(),
    pricing: Joi.object({
      hourlyRate: Joi.number().min(0).optional(),
      serviceRates: Joi.object().pattern(Joi.string(), Joi.number().min(0)).optional()
    }).optional()
  })
);

// Query parameter validation
export const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, { abortEarly: false });
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    
    req.query = value;
    next();
  };
};

// Pagination validation
export const validatePagination = validateQuery(
  Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  })
);

// Search validation
export const validateSearch = validateQuery(
  Joi.object({
    q: Joi.string().min(1).max(100).required().messages({
      'string.min': 'Search query must be at least 1 character long',
      'string.max': 'Search query must not exceed 100 characters',
      'any.required': 'Search query is required'
    }),
    type: Joi.string().valid('client', 'provider', 'admin').optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10)
  })
);

// File upload validation
export const validateFileUpload = (allowedTypes = ['image/jpeg', 'image/png', 'image/gif'], maxSize = 5 * 1024 * 1024) => {
  return (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`
      });
    }

    if (req.file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: `File size too large. Maximum size: ${maxSize / (1024 * 1024)}MB`
      });
    }

    next();
  };
};
