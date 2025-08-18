'use client';
// src/components/ui/DiskExplorerModal.tsx
import { useAuth } from '@/hooks/useAuth';
import React, { useState, useEffect } from 'react';
import {
  X, Folder, File, ArrowLeft, Home, Loader2, AlertCircle,
  RefreshCw, Calendar, HardDrive, Image as ImageIcon,
  Grid3x3, List, Download, Crown, Lock, Trash2
} from 'lucide-react';

interface FileInfo {
  name: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
  path: string;
  extension?: string;
  displayName?: string; // 🆕 Nazwa do wyświetlenia (bez prefiksu user ID)
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
  const { user } = useAuth();

  // States for image preview
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [previewImageName, setPreviewImageName] = useState<string>('');

  // States for file deletion
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<{ path: string; name: string } | null>(null);

  // States for bulk deletion
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [deletionProgress, setDeletionProgress] = useState({ current: 0, total: 0 });

  // 🔥 GOD_MODE Detection
  const isGodMode = user?.id === 'cme8bstib0001vmvojrxhcvlo';

  // 🆕 Function to filter and process files for regular users
  const processItemsForUser = (items: FileInfo[], userId: string): FileInfo[] => {
    if (isGodMode) {
      return items; // GOD_MODE sees everything as-is
    }

    return items
      .filter(item => {
        // 🚫 Hide all directories for regular users
        if (item.type === 'directory') {
          return false;
        }

        // ✅ Show only files that start with user.id_
        const fileName = item.name;
        const userPrefix = `${userId}_`;
        return fileName.startsWith(userPrefix);
      })
      .map(item => {
        // 🎨 Remove user ID prefix from display name
        const userPrefix = `${userId}_`;
        const displayName = item.name.startsWith(userPrefix)
          ? item.name.substring(userPrefix.length)
          : item.name;

        return {
          ...item,
          displayName
        };
      });
  };

  // 🆕 Function to get initial path based on user permissions
  const getInitialPath = (): string => {
    return isGodMode ? '' : 'uploads';
  };

  // Debug log for god mode detection
  useEffect(() => {
    if (user?.id) {
      console.log('👤 Current user ID:', user.id);
      console.log('👑 GOD_MODE:', isGodMode);
      console.log('🏠 Initial path:', getInitialPath());
    }
  }, [user?.id, isGodMode]);

  // Function to check if file is an image
  const isImageFile = (extension?: string): boolean => {
    if (!extension) return false;
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    return imageExtensions.includes(extension.toLowerCase());
  };

  // Fixed function for generating image URLs
  const getImageUrl = (filePath: string): string => {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
      console.log('🔗 Generating URL:', {
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
      // Use display name for preview if available
      setPreviewImageName(item.displayName || item.name);
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

  // 🆕 Function to check if navigation is allowed
  const isNavigationAllowed = (newPath: string): boolean => {
    if (isGodMode) {
      return true; // GOD_MODE can navigate anywhere
    }

    // Regular users are restricted to /uploads only
    return newPath === 'uploads' || newPath === '';
  };

  // Function to fetch data from API
  const fetchDirectoryContent = async (path: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // 🛡️ Security check for regular users
      if (!isGodMode && !isNavigationAllowed(path)) {
        throw new Error('Access denied to this directory');
      }

      const response = await fetch(`/api/disk-explorer?path=${encodeURIComponent(path)}`);
      const data: DiskExplorerResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || `Error ${response.status}`);
      }

      // 🎯 Process items based on user permissions
      const processedItems = user?.id ? processItemsForUser(data.items, user.id) : [];

      setItems(processedItems);
      setCurrentPath(data.currentPath);
      setStats({
        totalItems: processedItems.length,
        directories: processedItems.filter(item => item.type === 'directory').length,
        files: processedItems.filter(item => item.type === 'file').length
      });

      console.log(`📄 Loaded: ${processedItems.length} items from ${path || 'root'} (${isGodMode ? 'GOD_MODE' : 'USER_MODE'})`);

    } catch (error: any) {
      console.error('⌐ Error fetching content:', error);
      setError(error.message || 'Failed to fetch directory content');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load content when modal opens
  useEffect(() => {
    if (isOpen && user?.id) {
      const initialPath = getInitialPath();
      fetchDirectoryContent(initialPath);
    }
  }, [isOpen, user?.id]);

  // Handle ESC key for image preview and delete confirmation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isImagePreviewOpen) {
          closeImagePreview();
        } else if (showDeleteConfirm) {
          cancelDelete();
        } else if (showBulkDeleteConfirm) {
          cancelBulkDelete();
        }
      }
    };

    if (isImagePreviewOpen || showDeleteConfirm || showBulkDeleteConfirm) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isImagePreviewOpen, showDeleteConfirm, showBulkDeleteConfirm]);

  // Function to navigate to directory
  const navigateToDirectory = (newPath: string) => {
    if (isNavigationAllowed(newPath)) {
      fetchDirectoryContent(newPath);
    } else {
      setError('Access denied to this directory');
    }
  };

  // Function to go back to parent directory
  const goBack = () => {
    if (!isGodMode) {
      // Regular users can't navigate back from uploads
      return;
    }

    const pathParts = currentPath.split('/').filter(Boolean);
    const parentPath = pathParts.slice(0, -1).join('/');
    navigateToDirectory(parentPath);
  };

  // Function to go back to root
  const goHome = () => {
    const homePath = getInitialPath();
    navigateToDirectory(homePath);
  };

  // Function to refresh
  const refresh = () => {
    fetchDirectoryContent(currentPath);
  };

  // Function to delete file (GOD_MODE only)
  const deleteFile = async (filePath: string, fileName: string) => {
    if (!isGodMode) {
      setError('Insufficient permissions to delete files');
      return;
    }

    // Show custom confirmation modal
    setFileToDelete({ path: filePath, name: fileName });
    setShowDeleteConfirm(true);
  };

  // Function to confirm deletion
  const confirmDelete = async () => {
    if (!fileToDelete) return;

    setShowDeleteConfirm(false);
    setIsDeleting(true);
    setDeletingFile(fileToDelete.path);
    setError(null);

    try {
      const response = await fetch('/api/disk-explorer', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: fileToDelete.path,
          action: 'delete'
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || `Error ${response.status}`);
      }

      console.log(`✅ GOD_MODE: Successfully deleted file: ${fileToDelete.name}`);

      // Refresh the directory content after successful deletion
      fetchDirectoryContent(currentPath);

    } catch (error: any) {
      console.error('❌ Error deleting file:', error);
      setError(error.message || 'Failed to delete file');
    } finally {
      setIsDeleting(false);
      setDeletingFile(null);
      setFileToDelete(null);
    }
  };

  // Function to cancel deletion
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setFileToDelete(null);
  };

  // Function to bulk delete all files (GOD_MODE only)
  const bulkDeleteFiles = () => {
    if (!isGodMode) {
      setError('Insufficient permissions to delete files');
      return;
    }

    const filesToDelete = items.filter(item => item.type === 'file');

    if (filesToDelete.length === 0) {
      setError('No files to delete');
      return;
    }

    setShowBulkDeleteConfirm(true);
  };

  // Function to confirm bulk deletion
  const confirmBulkDelete = async () => {
    setShowBulkDeleteConfirm(false);
    setIsBulkDeleting(true);
    setError(null);

    const filesToDelete = items.filter(item => item.type === 'file');
    setDeletionProgress({ current: 0, total: filesToDelete.length });

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < filesToDelete.length; i++) {
      const file = filesToDelete[i];
      setDeletionProgress({ current: i + 1, total: filesToDelete.length });

      try {
        const response = await fetch('/api/disk-explorer', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path: file.path,
            action: 'delete'
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          successCount++;
          console.log(`✅ Deleted: ${file.name}`);
        } else {
          errorCount++;
          console.error(`❌ Failed to delete: ${file.name}`, data.error);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error deleting: ${file.name}`, error);
      }

      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`🏁 Bulk delete completed: ${successCount} successful, ${errorCount} failed`);

    if (errorCount > 0) {
      setError(`Deleted ${successCount} files. ${errorCount} files failed to delete.`);
    }

    // Refresh the directory content
    fetchDirectoryContent(currentPath);

    setIsBulkDeleting(false);
    setDeletionProgress({ current: 0, total: 0 });
  };

  // Function to cancel bulk deletion
  const cancelBulkDelete = () => {
    setShowBulkDeleteConfirm(false);
  };

  // File card component for grid view
  const FileGridCard = ({ item }: { item: FileInfo }) => (
    <div
      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer group"
      onClick={() => {
        if (item.type === 'directory' && isGodMode) {
          const newPath = currentPath ? `${currentPath}/${item.name}` : item.name;
          navigateToDirectory(newPath);
        } else if (item.type === 'file' && isImageFile(item.extension)) {
          // ✅ Dodana obsługa kliknięcia na pliki obrazkowe
          const fakeEvent = { stopPropagation: () => {} } as React.MouseEvent;
          openImagePreview(item, fakeEvent);
        }
      }}
    >
      {/* Icon/thumbnail - większy rozmiar */}
      <div className="flex justify-center mb-3">
        {item.type === 'directory' ? (
          <Folder className="h-20 w-20 text-blue-500" />
        ) : isImageFile(item.extension) ? (
          <div className="relative group-hover:scale-105 transition-transform duration-200">
            <div
              className="w-24 h-24 rounded-lg border border-gray-200 bg-gray-100 overflow-hidden"
              style={{
                backgroundImage: `url(${getImageUrl(item.path)})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
              }}
            ></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
          </div>
        ) : (
          <div className="w-24 h-24 rounded-lg bg-gray-100 flex items-center justify-center">
            <File className="h-12 w-12 text-gray-400" />
          </div>
        )}
      </div>

      {/* File information - tylko nazwa i data */}
      <div className="text-center">
        <p className="text-sm font-medium text-gray-900 truncate mb-2" title={item.displayName || item.name}>
          {item.displayName || item.name}
        </p>
        <div className="text-xs text-gray-500">
          <p>{formatDate(item.modified)}</p>
        </div>
      </div>
    </div>
  );

  // Row component for list view
  const FileListRow = ({ item }: { item: FileInfo }) => (
    <div
      className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md hover:bg-gray-50 transition-all cursor-pointer group"
      onClick={() => {
        if (item.type === 'directory' && isGodMode) {
          const newPath = currentPath ? `${currentPath}/${item.name}` : item.name;
          navigateToDirectory(newPath);
        } else if (item.type === 'file' && isImageFile(item.extension)) {
          // ✅ Otwórz podgląd dla plików graficznych
          const fakeEvent = { stopPropagation: () => {} } as React.MouseEvent;
          openImagePreview(item, fakeEvent);
        }
      }}
    >
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        {/* Icon or thumbnail */}
        <div className="flex-shrink-0 relative">
          {item.type === 'directory' ? (
            <Folder className="h-10 w-10 text-blue-500" />
          ) : isImageFile(item.extension) ? (
            <div className="relative group-hover:scale-105 transition-transform duration-200">
              <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center">
                <img
                  src={getImageUrl(item.path)}
                  alt={item.displayName || item.name}
                  className="w-full h-full object-cover"
                  onLoad={() => {
                    console.log('✅ List thumbnail loaded:', item.displayName || item.name);
                  }}
                  onError={(e) => {
                    console.error('⌐ List thumbnail error:', item.displayName || item.name, getImageUrl(item.path));
                    const target = e.target as HTMLImageElement;
                    target.src = getPlaceholderImage();
                  }}
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
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
            {item.displayName || item.name}
          </p>
          {item.extension && (
            <p className="text-xs text-gray-500">{item.extension.toUpperCase()}</p>
          )}
        </div>
      </div>

      {/* Size and date information */}
      <div className="flex items-center space-x-6 text-sm text-gray-500 flex-shrink-0">
        <div className="text-right hidden sm:block">
          <p>{formatFileSize(item.size)}</p>
        </div>
        <div className="flex items-center space-x-1 hidden md:flex">
          <Calendar size={14} />
          <span>{formatDate(item.modified)}</span>
        </div>

        {/* GOD_MODE Delete button - only for files */}
        {isGodMode && item.type === 'file' && (
          <div className="flex items-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteFile(item.path, item.displayName || item.name);
              }}
              disabled={isDeleting && deletingFile === item.path}
              className="p-2 text-gray-400 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title="Delete file (permanent)"
            >
              {isDeleting && deletingFile === item.path ? (
                <Loader2 size={16} className="animate-spin text-red-500" />
              ) : (
                <Trash2 size={16} />
              )}
            </button>
          </div>
        )}
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
                <div className="flex items-center space-x-3">
                  <h2 className="text-xl font-bold text-gray-900">
                    {isGodMode ? 'Disk Explorer' : 'My Files'}
                  </h2>
                  {/* 🔥 GOD_MODE Badge */}
                  {isGodMode && (
                    <div className="flex items-center space-x-1 px-3 py-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-sm font-bold rounded-full shadow-lg animate-pulse">
                      <Crown className="h-4 w-4" />
                      <span>GOD_MODE</span>
                    </div>
                  )}
                  {/* 🔒 User restriction indicator */}
                  {!isGodMode && (
                    <div className="flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                      <Lock className="h-3 w-3" />
                      <span>Personal</span>
                    </div>
                  )}
                </div>
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
                disabled={!isGodMode && currentPath === getInitialPath()}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={isGodMode ? "Home directory" : "My files"}
              >
                <Home size={18} />
              </button>
              <button
                onClick={goBack}
                disabled={!isGodMode || !currentPath}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Parent directory"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="text-sm text-gray-600 font-mono bg-gray-100 px-3 py-1.5 rounded-lg">
                {isGodMode
                  ? `/${currentPath || 'root'}`
                  : 'My Files'
                }
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-xs text-gray-500 hidden sm:block">
                {isGodMode
                  ? `${stats.directories} directories, ${stats.files} files`
                  : `${stats.files} personal files`
                }
              </div>

              {/* GOD_MODE Bulk Delete button */}
              {isGodMode && stats.files > 0 && (
                <button
                  onClick={bulkDeleteFiles}
                  disabled={isBulkDeleting || isLoading}
                  className="flex items-center space-x-2 px-3 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  title={`Delete all ${stats.files} files`}
                >
                  {isBulkDeleting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span className="hidden sm:inline">
                        Deleting {deletionProgress.current}/{deletionProgress.total}
                      </span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      <span className="hidden sm:inline">Delete All</span>
                    </>
                  )}
                </button>
              )}

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
                  <p>{isGodMode ? 'Directory is empty' : 'No personal files found'}</p>
                  {!isGodMode && (
                    <p className="text-xs mt-1">Upload files to see them here</p>
                  )}
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
              <div className="p-4 space-y-2">
                {items.map((item, index) => (
                  <FileListRow key={index} item={item} />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-500">
              Total: {stats.totalItems} {isGodMode ? 'items' : 'personal files'}
              {isGodMode && <span className="text-yellow-600 font-medium ml-2">• God mode active</span>}
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
                {isGodMode && (
                  <div className="flex items-center space-x-1 px-2 py-1 bg-yellow-500/20 text-yellow-300 text-xs font-medium rounded-full">
                    <Crown className="h-3 w-3" />
                    <span>GOD</span>
                  </div>
                )}
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

      {/* Bulk delete confirmation modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fadeIn">

            {/* Header */}
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete All Files</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>

            {/* Content */}
            <div className="mb-6">
              <p className="text-gray-700 mb-3">
                Are you sure you want to permanently delete all <strong>{stats.files}</strong> files in this directory?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-800">
                    This will permanently delete all files. Directories will remain unchanged.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-3">
              <button
                onClick={cancelBulkDelete}
                className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmBulkDelete}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Delete All {stats.files} Files
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && fileToDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fadeIn">

            {/* Header */}
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete File</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>

            {/* Content */}
            <div className="mb-6">
              <p className="text-gray-700 mb-2">
                Are you sure you want to permanently delete:
              </p>
              <div className="bg-gray-50 rounded-lg p-3 border">
                <p className="font-medium text-gray-900 truncate" title={fileToDelete.name}>
                  {fileToDelete.name}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-3">
              <button
                onClick={cancelDelete}
                className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Delete
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};

export default DiskExplorerModal;