import React, { useState, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { logger } from '@/lib/logger';

interface ImageThumbnailHoverProps {
  fileName: string;
  fileId: string;
  children: React.ReactNode;
}

/**
 * Component that shows an image thumbnail in a popover when hovering over image file names
 */
export function ImageThumbnailHover({ fileName, fileId, children }: ImageThumbnailHoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if file is an image - expanded to include more formats
  const isImageFile = /\.(png|jpg|jpeg|gif|webp|bmp|tiff|svg)$/i.test(fileName);
  
  // Also check if the file type badge indicates it's an image
  const fileTypeFromName = fileName.split('.').pop()?.toLowerCase();
  const isImageByExtension = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tiff', 'svg'].includes(fileTypeFromName || '');
  
  logger.debug('ImageThumbnailHover: File type check', { 
    fileName, 
    fileId, 
    isImageFile, 
    fileTypeFromName,
    isImageByExtension,
    finalCheck: isImageFile || isImageByExtension
  });
  
  if (!isImageFile && !isImageByExtension) {
    return <>{children}</>;
  }

  // Construct image URL - using our API route that handles Box authentication
  const imageUrl = `/api/box/files/${fileId}/thumbnail`;

  const handleMouseEnter = () => {
    logger.debug('ImageThumbnailHover: Mouse enter', { fileName });
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    // Set timeout to show popover after delay
    hoverTimeoutRef.current = setTimeout(() => {
      logger.debug('ImageThumbnailHover: Showing popover', { fileName });
      setIsOpen(true);
      setImageLoaded(false);
      setImageError(false);
    }, 300);
  };

  const handleMouseLeave = () => {
    logger.debug('ImageThumbnailHover: Mouse leave', { fileName });
    // Clear timeout and close popover
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    
    // Close after a small delay to allow moving to popover
    hoverTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 100);
  };

  const handlePopoverMouseEnter = () => {
    logger.debug('ImageThumbnailHover: Mouse enter on popover');
    // Clear any pending close timeout when mouse enters popover
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const handlePopoverMouseLeave = () => {
    logger.debug('ImageThumbnailHover: Mouse leave on popover');
    // Close popover when mouse leaves
    setIsOpen(false);
  };

  const handleImageLoad = () => {
    logger.debug('ImageThumbnailHover: Image loaded successfully', { fileName, imageUrl });
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = (e: any) => {
    logger.error('ImageThumbnailHover: Image failed to load', { fileName, imageUrl, error: e });
    setImageError(true);
    setImageLoaded(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded p-1 -m-1 transition-colors duration-200"
          title="Hover to preview image"
        >
          {children}
        </div>
      </PopoverTrigger>
      
      <PopoverContent 
        className="w-fit p-0 border shadow-lg"
        side="right"
        align="start"
        sideOffset={-91}
        onMouseEnter={handlePopoverMouseEnter}
        onMouseLeave={handlePopoverMouseLeave}
      >
        <div className="flex flex-col">
          <div className="px-2 py-1 bg-gray-50 dark:bg-gray-800 border-b">
            <h4 className="text-xs font-medium text-center max-w-[320px] truncate" title={fileName}>
              {fileName}
            </h4>
          </div>
          
          <div className="relative overflow-hidden">
            {!imageLoaded && !imageError && (
              <div className="flex items-center justify-center bg-gray-100 dark:bg-gray-800" style={{ width: '320px', height: '320px' }}>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
              </div>
            )}
            
            {imageError && (
              <div className="flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400" style={{ width: '320px', height: '320px' }}>
                <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2z" />
                </svg>
                <p className="text-sm">Preview not available</p>
              </div>
            )}
            
            <img
              src={imageUrl}
              alt={fileName}
              onLoad={handleImageLoad}
              onError={handleImageError}
              className={`object-contain ${imageLoaded ? 'block' : 'hidden'}`}
              style={{ 
                width: '320px',
                height: '320px'
              }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}