


export type ModelOutput = {
  value: string;
  isMatch: boolean;
};

export type Metrics = {
  accuracy: number;
  precision: number;
recall: number;
  f1Score: number;
};

export type ExtractionResult = {
  id: string;
  fileName: string;
  prompt: string;
  outputs: {
    [key:string]: ModelOutput; 
  };
  groundTruth: string;
  metrics?: Metrics;
  context?: ContextMatch;
};

export type ContextMatch = {
  value: string;
  context: string;
  highlightedContext: string;
  confidence: 'high' | 'medium' | 'low';
  startIndex: number;
  endIndex: number;
};

// New types for the accuracy grid
export type FieldResult = {
  // e.g. "Gemini 1.5 Flash": "NDA", "Ground Truth": "NDA"
  [modelOrGroundTruth: string]: string;
};

export type FileResult = {
  id: string;
  fileName: string;
  fileType: string;
  // e.g. "Contract Type": { "Gemini 1.5 Flash": "NDA", "Ground Truth": "NDA" }
  fields: Record<string, FieldResult>; 
};

export type FieldAverage = {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
};

export type ModelAverages = {
  [modelName: string]: FieldAverage;
};

export type PromptVersion = {
  id:string;
  prompt: string;
  savedAt: string;
  isFavorite?: boolean;
  metrics?: {
    // Individual model metrics instead of aggregated averages
    modelMetrics: Record<string, {
      f1: number;
      accuracy: number;
      precision: number;
      recall: number;
    }>;
    filesCount: number; // Number of files this version was tested on
    lastRunAt: string; // When metrics were last calculated
  };
};

export type AccuracyField = {
  name: string;
  key: string;
  type: 'string' | 'date' | 'enum' | 'number' | 'multiSelect' | 'dropdown_multi' | 'taxonomy';
  prompt: string; // This is the active prompt
  promptHistory: PromptVersion[];
  options?: { key: string }[]; // Enum/multiSelect options persisted from template
};

export type AccuracyData = {
  templateKey: string;
  baseModel: string;
  fields: AccuracyField[];
  results: Array<FileResult>;
  averages: Record<string, ModelAverages>;
  fieldSettings?: Record<string, {
    includeInMetrics: boolean;
  }>;
};

export type BoxTemplateField = {
  id: string;
  key: string;
  displayName: string;
  type: 'string' | 'date' | 'enum' | 'number';
  isActive?: boolean;
  options?: {
    id: string;
    key: string;
  }[];
};

export type BoxTemplate = {
  id: string;
  templateKey: string;
  displayName: string;
  fields: BoxTemplateField[];
};

export type BoxAIStructuredPromptField = {
    key: string;
    type: 'string' | 'date' | 'enum' | 'number';
    displayName: string;
    instruction?: string;
};

export type BoxFile = {
  id: string;
  name: string;
  type: 'file';
};

export type BoxFolder = {
  id: string;
  name: string;
  type: 'folder';
};

// New types for a more robust storage solution
export type FileMetadata = {
  templateKey: string;
  groundTruth: Record<string, string>;
};

export type FileMetadataStore = Record<string, FileMetadata>;

// ===== ERROR HANDLING TYPES =====

export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  INVALID_TEMPLATE = 'INVALID_TEMPLATE',
  PROCESSING_ERROR = 'PROCESSING_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface ExtractionError {
  type: ErrorType;
  message: string;
  userMessage: string;
  retryable: boolean;
  fileId?: string;
  fileName?: string;
  modelName?: string;
  fieldKey?: string;
  originalError?: Error;
  statusCode?: number;
  timestamp: Date;
}

export interface ApiExtractionResult {
  fileId: string;
  modelName: string;
  extractedMetadata: Record<string, any>;
  success: boolean;
  error?: ExtractionError;
  retryCount?: number;
  duration?: number;
}

export interface ExtractionProgress {
  processed: number;
  total: number;
  successful: number;
  failed: number;
  retrying: number;
  currentOperation?: string;
  estimatedTimeRemaining?: number;
}

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryableErrors: ErrorType[];
}

// ===== ERROR HANDLING UTILITIES =====

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  retryableErrors: [
    ErrorType.NETWORK_ERROR,
    ErrorType.TIMEOUT_ERROR,
    ErrorType.RATE_LIMIT_ERROR,
    ErrorType.PROCESSING_ERROR
  ]
};

export const ERROR_MESSAGES: Record<ErrorType, { title: string; description: string; action?: string }> = {
  [ErrorType.NETWORK_ERROR]: {
    title: 'Connection Error',
    description: 'Unable to connect to the Box AI service. Please check your internet connection.',
    action: 'Check your connection and try again'
  },
  [ErrorType.API_ERROR]: {
    title: 'API Error',
    description: 'The Box AI service encountered an error while processing your request.',
    action: 'Please try again in a few moments'
  },
  [ErrorType.VALIDATION_ERROR]: {
    title: 'Validation Error',
    description: 'The request data is invalid or incomplete.',
    action: 'Please check your template configuration'
  },
  [ErrorType.TIMEOUT_ERROR]: {
    title: 'Request Timeout',
    description: 'The extraction request took too long to complete.',
    action: 'This may be due to large files or complex templates'
  },
  [ErrorType.RATE_LIMIT_ERROR]: {
    title: 'Rate Limit Exceeded',
    description: 'Too many requests have been made in a short period.',
    action: 'Please wait a few minutes before trying again'
  },
  [ErrorType.AUTHENTICATION_ERROR]: {
    title: 'Authentication Error',
    description: 'Your Box authentication has expired or is invalid.',
    action: 'Please check your settings and re-authenticate'
  },
  [ErrorType.PERMISSION_ERROR]: {
    title: 'Permission Denied',
    description: 'You do not have permission to access this file or feature.',
    action: 'Please check your Box permissions'
  },
  [ErrorType.FILE_NOT_FOUND]: {
    title: 'File Not Found',
    description: 'The selected file could not be found or accessed.',
    action: 'Please verify the file still exists in Box'
  },
  [ErrorType.INVALID_TEMPLATE]: {
    title: 'Invalid Template',
    description: 'The template configuration is invalid or corrupted.',
    action: 'Please check your template configuration'
  },
  [ErrorType.PROCESSING_ERROR]: {
    title: 'Processing Error',
    description: 'An error occurred while processing the document.',
    action: 'This may be due to document format or content issues'
  },
  [ErrorType.UNKNOWN_ERROR]: {
    title: 'Unexpected Error',
    description: 'An unexpected error occurred during extraction.',
    action: 'Please try again or contact support if this persists'
  }
};
