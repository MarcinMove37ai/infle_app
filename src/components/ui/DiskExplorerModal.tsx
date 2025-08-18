// src/components/ui/DiskExplorerModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  X, Folder, File, ArrowLeft, Home, Loader2, AlertCircle,
  RefreshCw, Calendar, HardDrive, Image as ImageIcon,
  ZoomIn, Eye, Grid3x3, List, Download
} from 'lucide-react';

interface FileInfo {
  name: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
  path: string;
  extension?: string;
}

interface DiskExplorerResponse {
  success: boolean;
  currentPath: string;
  basePath: string;
  items: FileInfo[];
  totalItems: number;
  directories: number;
  files: number;
  error?: string;
}

interface DiskExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DiskExplorerModal: React.FC<DiskExplorerModalProps> = ({ isOpen, onClose }) => {
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState<FileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ totalItems: 0, directories: 0, files: 0 });
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // States for image preview
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [previewImageName, setPreviewImageName] = useState<string>('');

  // Function to check if file is an image
  const isImageFile = (extension?: string): boolean => {
    if (!extension) return false;
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    return imageExtensions.includes(extension.toLowerCase());
  };

  // Fixed function for generating image URLs
  const getImageUrl = (filePath: string): string => {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
      console.log('🔍 Generating URL:', {
        filePath,
        baseUrl,
        finalUrl: `${baseUrl}/api/assets/${filePath}`
      });
      return `${baseUrl}/api/assets/${filePath}`;
  };

  // Placeholder for images
  const getPlaceholderImage = () => {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik00OCA2NEw1NiA1Nkw2NCA2NEg3MlY3Mkg0OFY2NEg0OFoiIGZpbGw9IiM5Q0E0QUYiLz4KPHBhdGggZD0iTTQwIDQwSDQyLjRMNDggNDhINzJMNzcuNiA0MEg4MFY4MEg0MFY0MFoiIGZpbGw9IiNEMUQ1REIiLz4KPC9zdmc+';
  };

  // Function to open image preview
  const openImagePreview = (item: FileInfo, event: React.MouseEvent) => {
    event.stopPropagation();
    if (isImageFile(item.extension)) {
      const imageUrl = getImageUrl(item.path);
      setPreviewImage(imageUrl);
      setPreviewImageName(item.name);
      setIsImagePreviewOpen(true);
    }
  };

  // Function to close image preview
  const closeImagePreview = () => {
    setIsImagePreviewOpen(false);
    setPreviewImage(null);
    setPreviewImageName('');
  };

  // Function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Function to format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Function to fetch data from API
  const fetchDirectoryContent = async (path: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/disk-explorer?path=${encodeURIComponent(path)}`);
      const data: DiskExplorerResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || `Error ${response.status}`);
      }

      setItems(data.items);
      setCurrentPath(data.currentPath);
      setStats({
        totalItems: data.totalItems,
        directories: data.directories,
        files: data.files
      });

      console.log(`🔄 Loaded: ${data.items.length} items from ${path || 'root'}`);

    } catch (error: any) {
      console.error('❌ Error fetching content:', error);
      setError(error.message || 'Failed to fetch directory content');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load content when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchDirectoryContent('');
    }
  }, [isOpen]);

  // Function to navigate to directory
  const navigateToDirectory = (newPath: string) => {
    fetchDirectoryContent(newPath);
  };

  // Function to go back to parent directory
  const goBack = () => {
    const pathParts = currentPath.split('/').filter(Boolean);
    const parentPath = pathParts.slice(0, -1).join('/');
    navigateToDirectory(parentPath);
  };

  // Function to go back to root
  const goHome = () => {
    navigateToDirectory('');
  };

  // Function to refresh
  const refresh = () => {
    fetchDirectoryContent(currentPath);
  };

  // File card component for grid view
  const FileGridCard = ({ item }: { item: FileInfo }) => (
    <div
      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer group"
      onClick={() => {
        if (item.type === 'directory') {
          const newPath = currentPath ? `${currentPath}/${item.name}` : item.name;
          navigateToDirectory(newPath);
        }
      }}
    >
      {/* Icon/thumbnail */}
      <div className="flex justify-center mb-3">
        {item.type === 'directory' ? (
          <Folder className="h-12 w-12 text-blue-500" />
        ) : isImageFile(item.extension) ? (
          <div className="relative">
            <div
              className="w-16 h-16 rounded-lg border border-gray-200 bg-gray-100"
              style={{
                backgroundImage: `url(${getImageUrl(item.path)})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
              }}
            ></div>
            {/* FIXED: Preview overlay - removed bg-black bg-opacity-0, added group-hover:bg-black */}
            <div
              className="absolute inset-0 group-hover:bg-black group-hover:bg-opacity-40 transition-all rounded-lg flex items-center justify-center cursor-pointer"
              onClick={(e) => openImagePreview(item, e)}
            >
              <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={16} />
            </div>
          </div>
        ) : (
          <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center">
            <File className="h-8 w-8 text-gray-400" />
          </div>
        )}
      </div>

      {/* File information */}
      <div className="text-center">
        <p className="text-sm font-medium text-gray-900 truncate mb-1" title={item.name}>
          {item.name}
        </p>
        <div className="text-xs text-gray-500 space-y-1">
          <p>{formatFileSize(item.size)}</p>
          <p>{formatDate(item.modified)}</p>
          {item.extension && (
            <span className="inline-block px-2 py-1 bg-gray-100 rounded text-xs">
              {item.extension.toUpperCase()}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  // Row component for list view
  const FileListRow = ({ item }: { item: FileInfo }) => (
    <div
      className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer group"
      onClick={() => {
        if (item.type === 'directory') {
          const newPath = currentPath ? `${currentPath}/${item.name}` : item.name;
          navigateToDirectory(newPath);
        }
      }}
    >
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        {/* Icon or thumbnail */}
        <div className="flex-shrink-0 relative">
          {item.type === 'directory' ? (
            <Folder className="h-10 w-10 text-blue-500" />
          ) : isImageFile(item.extension) ? (
            <div className="relative">
              <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center">
                <img
                  src={getImageUrl(item.path)}
                  alt={item.name}
                  className="w-full h-full object-cover"
                  onLoad={() => {
                    console.log('✅ List thumbnail loaded:', item.name);
                  }}
                  onError={(e) => {
                    console.error('❌ List thumbnail error:', item.name, getImageUrl(item.path));
                    const target = e.target as HTMLImageElement;
                    target.src = getPlaceholderImage();
                  }}
                />
              </div>
              {/* FIXED: Preview overlay - removed bg-black bg-opacity-0, added group-hover:bg-black */}
              <div className="absolute inset-0 group-hover:bg-black group-hover:bg-opacity-40 transition-all duration-200 rounded-lg flex items-center justify-center">
                <ZoomIn
                  className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
                  size={16}
                  onClick={(e) => openImagePreview(item, e)}
                />
              </div>
            </div>
          ) : (
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <File className="h-6 w-6 text-gray-400" />
            </div>
          )}
        </div>

        {/* File information */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 truncate">
            {item.name}
          </p>
          {item.extension && (
            <p className="text-xs text-gray-500">{item.extension.toUpperCase()}</p>
          )}
        </div>
      </div>

      {/* Actions for images */}
      {isImageFile(item.extension) && (
        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => openImagePreview(item, e)}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Preview image"
          >
            <Eye size={16} />
          </button>
        </div>
      )}

      {/* Size and date information */}
      <div className="flex items-center space-x-6 text-sm text-gray-500 flex-shrink-0">
        <div className="text-right hidden sm:block">
          <p>{formatFileSize(item.size)}</p>
        </div>
        <div className="flex items-center space-x-1 hidden md:flex">
          <Calendar size={14} />
          <span>{formatDate(item.modified)}</span>
        </div>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden animate-fadeIn">

          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center">
              <HardDrive className="h-6 w-6 text-gray-600 mr-3" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">Disk Explorer</h2>
                <p className="text-sm text-gray-500">
                  Browse files on Railway server
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Navigation Bar */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
            <div className="flex items-center space-x-2">
              <button
                onClick={goHome}
                disabled={!currentPath}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Home directory"
              >
                <Home size={18} />
              </button>
              <button
                onClick={goBack}
                disabled={!currentPath}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Parent directory"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="text-sm text-gray-600 font-mono bg-gray-100 px-3 py-1.5 rounded-lg">
                /{currentPath || 'root'}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-xs text-gray-500 hidden sm:block">
                {stats.directories} directories, {stats.files} files
              </div>

              {/* View mode toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title="List view"
                >
                  <List size={16} />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title="Grid view"
                >
                  <Grid3x3 size={16} />
                </button>
              </div>

              <button
                onClick={refresh}
                disabled={isLoading}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="h-[60vh] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">Loading content...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-red-600">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p className="font-medium">Error</p>
                  <p className="text-sm">{error}</p>
                  <button
                    onClick={refresh}
                    className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                  >
                    Try again
                  </button>
                </div>
              </div>
            ) : items.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-500">
                  <Folder className="h-8 w-8 mx-auto mb-2" />
                  <p>Directory is empty</p>
                </div>
              </div>
            ) : viewMode === 'grid' ? (
              // Grid view
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {items.map((item, index) => (
                  <FileGridCard key={index} item={item} />
                ))}
              </div>
            ) : (
              // List view
              <div className="divide-y divide-gray-100">
                {items.map((item, index) => (
                  <FileListRow key={index} item={item} />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-500">
              Total: {stats.totalItems} items
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Image preview modal */}
      {isImagePreviewOpen && previewImage && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-7xl max-h-[95vh] flex flex-col bg-black/50 rounded-lg">

            {/* Preview header */}
            <div className="flex items-center justify-between p-4 flex-shrink-0">
              <div className="flex items-center space-x-3 min-w-0">
                <ImageIcon className="h-5 w-5 text-white flex-shrink-0" />
                <h3 className="text-white font-medium truncate">{previewImageName}</h3>
              </div>
              <button
                onClick={closeImagePreview}
                className="text-white hover:text-gray-300 transition-colors flex-shrink-0 ml-4"
              >
                <X size={24} />
              </button>
            </div>

            {/* Image container - responsive sizing */}
            <div className="flex-1 flex items-center justify-center p-4 min-h-0 overflow-hidden">
              <img
                src={previewImage}
                alt={previewImageName}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                style={{
                  maxHeight: 'calc(95vh - 160px)', // Subtract header and footer height
                  maxWidth: 'calc(100vw - 32px)'   // Account for padding
                }}
                onError={() => {
                  setError('Failed to load image');
                }}
              />
            </div>

            {/* Preview footer */}
            <div className="flex justify-center p-4 flex-shrink-0">
              <button
                onClick={closeImagePreview}
                className="px-6 py-2 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition-colors font-medium"
              >
                Close preview
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DiskExplorerModal;