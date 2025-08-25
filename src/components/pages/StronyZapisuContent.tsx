// src/components/pages/StronyZapisuContent.tsx
"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, Search, Plus, Eye, Edit, Trash2, Clock, Check, AlertTriangle,
         BookOpen, ShoppingCart, Copy, X, Video, QrCode, Lock, Sparkles, ImageIcon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/hooks/useAuth';

// Interfaces
interface PageItem {
  id: string;
  title: string;
  headline?: string;
  subtitle?: string;
  creator: string;
  supervisorCode?: string;
  visits: number;
  leads: number;
  type: string;
  status: string;
  createdAt: string;
  url: string;
  draft_url: string;
  coverImage: string;
  x_amz_meta_title?: string;
  videoPassword?: string;
  isOwnedByUser?: boolean;
}

interface SupervisorDescription {
  code: string;
  description: string;
}

interface PageStats {
  total: number;
  published: number;
  pending: number;
  draft: number;
  ebook: number;
  sales: number;
}

interface PagesApiResponse {
  pages: PageItem[];
  stats: PageStats;
}

const PagesView = () => {
  const { user, userRole, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const coverImageSize = 240;
  const [activeFilter, setActiveFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [stats, setStats] = useState<PageStats>({ total: 0, published: 0, pending: 0, draft: 0, ebook: 0, sales: 0 });
  const [supervisorDescriptions, setSupervisorDescriptions] = useState<Record<string, string>>({});
  const [loadingSupervisors, setLoadingSupervisors] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<PageItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{url: string, title: string, subtitle?: string} | null>(null);
  const [previewNotification, setPreviewNotification] = useState<boolean>(false);
  const [qrCodeData, setQrCodeData] = useState<{url: string, title: string, creator: string, logoUrl?: string} | null>(null);
  const [copyingQr, setCopyingQr] = useState(false);
  const [qrCopied, setQrCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const qrCodeRef = React.useRef<SVGSVGElement>(null);
  const previewModalRef = useRef<HTMLDivElement>(null);

  const getOrCreatePreviewUrl = useCallback(async (pageId: string, existingDraftUrl?: string): Promise<string | null> => {
    if (existingDraftUrl) {
      return `${window.location.origin}${existingDraftUrl}`;
    }

    try {
      setActionLoading(pageId);
      setActionError(null);

      const response = await fetch(`/api/pages/${pageId}/preview`, { method: 'POST' });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate preview link');
      }

      const data = await response.json();

      if (data.success && data.preview_url) {
        setPages(prevPages =>
          prevPages.map(p =>
            p.id === pageId ? { ...p, draft_url: data.draft_url } : p
          )
        );
        return data.preview_url;
      } else {
        throw new Error('Invalid response from preview API');
      }
    } catch (error) {
      console.error('Error in getOrCreatePreviewUrl:', error);
      setActionError(error instanceof Error ? error.message : 'Unknown error');
      setTimeout(() => setActionError(null), 5000);
      return null;
    } finally {
      setActionLoading(null);
    }
  }, []);

  const getAssetUrl = (coverImagePath: string | null | undefined) => {
    if (!coverImagePath) return '';
    if (coverImagePath.startsWith('/uploads/')) {
      const filename = coverImagePath.substring('/uploads/'.length);
      return `/api/assets/uploads/${filename}`;
    }
    return `/api/assets/uploads/${coverImagePath}`;
  };

  const VideoCoverPlaceholder = ({ width, height, className = "" }: { width: number | string; height: number | string; className?: string; }) => (
    <div className={`bg-gray-100 rounded-md flex flex-col items-center justify-center border border-gray-200 ${className}`} style={{ width, height }}>
      <Video size={typeof width === 'number' ? width/3 : 48} className="text-gray-400 mb-2" />
      <span className="text-gray-400 text-xs">No cover</span>
    </div>
  );

  const fetchSupervisorDescription = useCallback(async (code: string) => {
    if (!code) return null;
    try {
      const response = await fetch(`/api/supervisor/${code}`);
      if (!response.ok) { return null; }
      const data = await response.json();
      return data.description;
    } catch (error) {
      return null;
    }
  }, []);

  const fetchAllSupervisorDescriptions = useCallback(async (pagesToProcess: PageItem[]) => {
    if (!pagesToProcess || pagesToProcess.length === 0) return;
    setLoadingSupervisors(true);
    try {
      const supervisorCodes = Array.from(new Set(pagesToProcess.filter(page => page.supervisorCode).map(page => page.supervisorCode as string)));
      if (supervisorCodes.length === 0) { setLoadingSupervisors(false); return; }
      const results = await Promise.all(supervisorCodes.map(async (code) => ({ code, description: await fetchSupervisorDescription(code) })));
      const descriptionsMap: Record<string, string> = {};
      results.forEach(result => { if (result.code && result.description) { descriptionsMap[result.code] = result.description; } });
      setSupervisorDescriptions(descriptionsMap);
    } catch (error) {
      console.error('Error fetching supervisor descriptions:', error);
    } finally {
      setLoadingSupervisors(false);
    }
  }, [fetchSupervisorDescription]);

  const copyUrlToClipboard = (pageId: string, url: string) => {
    if (url) {
      navigator.clipboard.writeText(url)
        .then(() => {
          setCopiedUrl(pageId);
          setTimeout(() => setCopiedUrl(null), 800);
        });
    }
  };

  const openCoverPreview = (url: string, title: string, subtitle?: string) => setPreviewImage({ url, title, subtitle });
  const closeCoverPreview = () => setPreviewImage(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') closeCoverPreview();
    };
    const handleClickOutside = (event: MouseEvent) => {
        if (previewModalRef.current && !previewModalRef.current.contains(event.target as Node)) {
            closeCoverPreview();
        }
    };

    if (previewImage) {
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [previewImage]);

  const openQrCode = (url: string, title: string, creator: string) => setQrCodeData({ url, title, creator, logoUrl: '/logo.png' });
  const closeQrCode = () => {
    setQrCodeData(null);
    setQrCopied(false);
  };

  const copyQrCodeToClipboard = async () => {
    if (!qrCodeRef.current) return;
    try {
      setCopyingQr(true);
      const svgElement = qrCodeRef.current;
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = async () => {
        canvas.width = img.width;
        canvas.height = img.height;
        if (ctx) {
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        }
        canvas.toBlob(async (blob) => {
          if (blob) {
            try {
              await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
              setQrCopied(true);
              setTimeout(() => setQrCopied(false), 2000);
            } catch (error) {
              console.error('Error copying to clipboard:', error);
            }
          }
          setCopyingQr(false);
        }, 'image/png');
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    } catch (error) {
      console.error('Error copying QR code:', error);
      setCopyingQr(false);
    }
  };

  const fetchPages = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (activeFilter === 'published') params.append('status', 'published');
      else if (activeFilter === 'draft') params.append('status', 'draft');

      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/pages?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error fetching data');
      }

      const data = await response.json() as PagesApiResponse;
      setPages(data.pages);
      setStats(data.stats);
      fetchAllSupervisorDescriptions(data.pages);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, activeFilter, searchTerm, fetchAllSupervisorDescriptions]);

  useEffect(() => {
    if (!isAuthLoading) {
      fetchPages();
    }
  }, [isAuthLoading, fetchPages]);

  const openEditor = async (pageId: string, draftUrl?: string) => {
    const finalUrl = await getOrCreatePreviewUrl(pageId, draftUrl);
    if (finalUrl) {
      const editUrl = finalUrl.split('?')[0] + '?mode=edit';
      window.location.href = editUrl;
    }
  };

  const openPreview = async (pageId: string, draftUrl?: string) => {
    const finalUrl = await getOrCreatePreviewUrl(pageId, draftUrl);
    if (finalUrl) {
      const previewUrl = new URL(finalUrl);
      previewUrl.searchParams.set('view_mode', 'preview');

      setPreviewNotification(true);
      setTimeout(() => setPreviewNotification(false), 2000);
      window.open(previewUrl.toString(), '_blank');
    }
  };

  const handleDeletePage = (page: PageItem) => {
    setPageToDelete(page);
    setIsDeleteModalOpen(true);
    setDeleteError(null);
  };

  const handleFilterClick = (filter: 'all' | 'published' | 'draft') => {
    setActiveFilter(filter);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPages();
  };

  const confirmDeletePage = async () => {
    if (!pageToDelete || !isAuthenticated) {
      console.error('Missing page data to delete or user not logged in');
      setDeleteError('Missing required data or authorization to delete the page');
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const requestData = {
        pageId: pageToDelete.id,
      };

      console.log('Sending delete request to /api/pages:', requestData);

      const response = await fetch('/api/pages', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Error deleting page: ${response.status}`);
      }

      console.log('Response from API:', data.message);

      await fetchPages();

      setIsDeleteModalOpen(false);
      setPageToDelete(null);

    } catch (err) {
      console.error('Error while deleting page:', err);
      setDeleteError(err instanceof Error ? err.message : 'An unknown error occurred while deleting the page');
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDeletePage = () => {
    setIsDeleteModalOpen(false);
    setPageToDelete(null);
    setDeleteError(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };
  const getSupervisorDescription = (code?: string) => code ? supervisorDescriptions[code] || code : null;
  const isGodRole = userRole === 'free';

  if (isAuthLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p>You must be logged in to view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 mb-6 rounded-md">
            <p>{error}</p>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center lg:justify-end pb-3 mb-5">
            <form onSubmit={handleSearch} className="flex gap-2 lg:flex-1 lg:max-w-md lg:justify-end">
                <input
                    type="text"
                    placeholder="Search pages..."
                    className="flex-1 lg:min-w-0 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:border-gray-400"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button
                    type="submit"
                    disabled={isLoading}
                    className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
                >
                    Search
                </button>
                {searchTerm && (
                    <button
                        type="button"
                        onClick={() => { setSearchTerm(''); }}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
                    >
                        Clear
                    </button>
                )}
            </form>
        </div>

        {!isLoading && stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
            <button
              onClick={() => handleFilterClick('all')}
              className={`bg-blue-50 rounded-xl p-4 sm:p-6 border transition-all duration-200 text-left hover:shadow-md cursor-pointer ${
                activeFilter === 'all' ? 'border-blue-400 ring-2 ring-blue-200 bg-blue-100' : 'border-blue-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-600 text-sm font-medium">All Pages</p>
                  <p className="text-xl sm:text-2xl font-bold text-blue-900">{stats.total}</p>
                </div>
                <BookOpen className="text-blue-600" size={28} />
              </div>
            </button>
            <button
              onClick={() => handleFilterClick('published')}
              className={`bg-green-50 rounded-xl p-4 sm:p-6 border transition-all duration-200 text-left hover:shadow-md cursor-pointer ${
                activeFilter === 'published' ? 'border-green-400 ring-2 ring-green-200 bg-green-100' : 'border-green-200 hover:border-green-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-600 text-sm font-medium">Published</p>
                  <p className="text-xl sm:text-2xl font-bold text-green-900">{stats.published}</p>
                </div>
                <Sparkles className="text-green-600" size={28} />
              </div>
            </button>
            <button
              onClick={() => handleFilterClick('draft')}
              className={`bg-orange-50 rounded-xl p-4 sm:p-6 border transition-all duration-200 text-left hover:shadow-md sm:col-span-2 lg:col-span-1 cursor-pointer ${
                activeFilter === 'draft' ? 'border-orange-400 ring-2 ring-orange-200 bg-orange-100' : 'border-orange-200 hover:border-orange-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-600 text-sm font-medium">Drafts</p>
                  <p className="text-xl sm:text-2xl font-bold text-orange-900">{stats.draft}</p>
                </div>
                <Edit className="text-orange-600" size={28} />
              </div>
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-800">Your Pages</h2>
                {stats && stats.total > 0 && (
                <p className="text-sm text-gray-600">
                    Showing {pages.length} of {stats.total} pages
                </p>
                )}
            </div>

            {isLoading ? (
            <div className="text-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto"></div>
                <p className="mt-4 text-gray-500">Loading pages...</p>
            </div>
            ) : (
            <>
                {pages.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
                    <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Pages</h3>
                    <p>No pages were found that meet the search criteria.</p>
                </div>
                ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                    {pages.map(page => (
                    <div key={page.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
                        <div className={`h-2 ${page.status === 'published' ? 'bg-green-500' : page.status === 'pending' ? 'bg-amber-400' : 'bg-gray-400'}`}></div>
                        <div className="p-5">
                        <div className="flex mb-4">
                            <div className="flex justify-between items-start w-full">
                            <h3 className="font-medium text-gray-900 text-lg line-clamp-2 max-w-[65%] min-h-[3rem]">{page.title}</h3>
                            <div className="flex flex-nowrap space-x-1.5 min-w-fit ml-2">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${page.type === 'ebook' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'}`}>{page.type === 'ebook' ? 'e-book' : 'sales'}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${page.status === 'published' ? 'bg-green-100 text-green-700' : page.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>{page.status}</span>
                            </div>
                            </div>
                        </div>
                        <div className="border-t border-gray-100 mb-4"></div>
                        <div className="block sm:flex sm:gap-4">
                            <div className="flex flex-row gap-1 sm:hidden mb-4">
                            <div className="w-3/5">
                                <div className="bg-gray-50 rounded-lg p-3 space-y-2.5">
                                <div className="flex items-center"><div className="w-20 text-gray-400 text-xs whitespace-nowrap">Subtitle:</div><div className="text-gray-600 font-medium flex-1 truncate text-xs">{page.subtitle || ""}</div></div>
                                <div className="flex items-center"><div className="w-20 text-gray-400 text-xs whitespace-nowrap">Author:</div><div className="text-gray-800 font-medium flex-1 truncate text-xs">{page.creator}</div></div>
                                <div className="border-t border-gray-200 my-1.5"></div>
                                {page.supervisorCode && !isGodRole && (<div className="flex items-center"><div className="w-20 text-gray-400 text-xs whitespace-nowrap">Supervisor:</div><div className="text-gray-800 font-medium flex-1 truncate text-xs">{getSupervisorDescription(page.supervisorCode)}</div></div>)}
                                <div className="flex items-center"><div className="w-20 text-gray-400 text-xs whitespace-nowrap">Date:</div><div className="text-gray-800 flex-1 truncate text-xs">{formatDate(page.createdAt)}</div></div>
                                {page.isOwnedByUser && page.videoPassword && (<><div className="border-t border-gray-200 my-1.5"></div><div className="flex items-center"><div className="w-20 text-gray-400 text-xs whitespace-nowrap flex items-center"><Lock size={12} className="mr-1 text-amber-500" /> Password:</div><div className="text-amber-600 font-medium flex-1 truncate text-xs">{page.videoPassword}</div></div></>)}
                                </div>
                                {page.url && (<div className="mt-2.5 flex items-center relative bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500 truncate w-full"><span className="text-gray-400 mr-1 hidden sm:inline">Link:</span><span className="text-sky-600 font-medium truncate">{page.url}</span></p><div className="flex items-center ml-2"><button onClick={() => openQrCode(page.url, page.headline || page.title, page.creator)} className="flex-shrink-0 p-1 text-gray-500 hover:text-sky-600 hover:bg-gray-200 rounded transition-colors cursor-pointer mr-1" title="Generate QR Code"><QrCode className="h-4 w-4" /></button><button onClick={() => copyUrlToClipboard(page.id, page.url)} className="flex-shrink-0 p-1 text-gray-500 hover:text-sky-600 hover:bg-gray-200 rounded transition-colors cursor-pointer" title="Copy link to clipboard"><Copy className="h-4 w-4" /></button></div>{copiedUrl === page.id && (<div className="absolute right-0 -top-7 bg-green-100 text-green-800 px-2 py-1 rounded-md shadow-sm text-xs z-10 animate-pulse">URL copied!</div>)}</div>)}
                            </div>
                            <div className="w-2/5 flex items-center p-0">
                                {page.coverImage ? (
                                    <img
                                        src={getAssetUrl(page.coverImage)}
                                        alt={`Cover for ${page.title}`}
                                        className="w-full h-auto object-cover cursor-pointer rounded-md"
                                        style={{ maxHeight: `${coverImageSize * 0.7}px`, objectFit: 'contain' }}
                                        onClick={() => openCoverPreview(getAssetUrl(page.coverImage), page.headline || page.title, page.subtitle)}
                                    />
                                ) : (
                                    <VideoCoverPlaceholder width="100%" height={`${coverImageSize * 0.7}px`} />
                                )}
                            </div>
                            </div>
                            <div className="hidden sm:block sm:w-3/5 sm:space-y-4 sm:pr-4">
                            <div className="bg-gray-50 rounded-lg p-3 space-y-2.5">
                                <div className="flex items-center text-sm"><div className="w-24 text-gray-400">Subtitle:</div><div className="text-gray-800 font-medium flex-1 truncate">{page.subtitle || ""}</div></div>
                                <div className="flex items-center text-sm"><div className="w-24 text-gray-400">Author:</div><div className="text-gray-800 font-medium flex-1 truncate">{page.creator}</div></div>
                                <div className="border-t border-gray-200 my-1.5"></div>
                                {page.supervisorCode && !isGodRole && (<div className="flex items-center text-sm"><div className="w-24 text-gray-400">Supervisor:</div><div className="text-gray-800 font-medium flex-1 truncate">{getSupervisorDescription(page.supervisorCode)}</div></div>)}
                                <div className="flex items-center text-sm"><div className="w-24 text-gray-400">Created At:</div><div className="text-gray-800 flex-1 truncate">{formatDate(page.createdAt)}</div></div>
                                {page.isOwnedByUser && page.videoPassword && (<><div className="border-t border-gray-200 my-1.5"></div><div className="flex items-center text-sm"><div className="w-24 text-gray-400 flex items-center"><Lock size={14} className="mr-1.5 text-amber-500" /> Password:</div><div className="text-amber-600 font-medium flex-1 truncate">{page.videoPassword}</div></div></>)}
                            </div>
                            <div className="flex gap-3">
                                <div className="flex-1 bg-blue-50 rounded-lg p-3 border border-blue-100 hover:border-blue-200 transition-colors"><p className="text-blue-600 text-xl font-semibold">{page.visits}</p><p className="text-blue-500 text-xs uppercase tracking-wide font-medium">visits</p></div>
                                <div className="flex-1 bg-green-50 rounded-lg p-3 border border-green-100 hover:border-green-200 transition-colors"><p className="text-green-600 text-xl font-semibold">{page.leads}</p><p className="text-green-500 text-xs uppercase tracking-wide font-medium">leads</p></div>
                            </div>
                            {page.status === 'pending' && (<div className="text-amber-500 flex items-center text-sm"><Clock size={16} className="mr-2" />Awaiting publication</div>)}
                            </div>
                            <div className="hidden sm:flex sm:w-2/5 sm:items-center sm:justify-center">
                                {page.coverImage ? (
                                    <img
                                        src={getAssetUrl(page.coverImage)}
                                        alt={`Cover for ${page.title}`}
                                        style={{ maxWidth: `${coverImageSize * 0.75}px`, maxHeight: `${coverImageSize}px`, objectFit: 'contain' }}
                                        className="mx-auto rounded-md cursor-pointer"
                                        onClick={() => openCoverPreview(getAssetUrl(page.coverImage), page.headline || page.title, page.subtitle)}
                                    />
                                ) : (
                                    <VideoCoverPlaceholder width={`${coverImageSize * 0.75}px`} height={`${coverImageSize}px`} className="mx-auto" />
                                )}
                            </div>
                            <div className="block sm:hidden w-full">
                            <div className="flex gap-3">
                                <div className="flex-1 bg-blue-50 rounded-lg p-3 border border-blue-100 hover:border-blue-200 transition-colors"><p className="text-blue-600 text-xl font-semibold">{page.visits}</p><p className="text-blue-500 text-xs uppercase tracking-wide font-medium">visits</p></div>
                                <div className="flex-1 bg-green-50 rounded-lg p-3 border border-green-100 hover:border-green-200 transition-colors"><p className="text-green-600 text-xl font-semibold">{page.leads}</p><p className="text-green-500 text-xs uppercase tracking-wide font-medium">leads</p></div>
                            </div>
                            </div>
                            {page.status === 'pending' && (<div className="block sm:hidden text-amber-500 flex items-center text-sm mt-3"><Clock size={16} className="mr-2" />Awaiting moderation</div>)}
                        </div>
                        {page.url && (<div className="hidden sm:flex mt-4 items-center relative bg-gray-50 rounded-md p-2"><p className="text-xs text-gray-500 truncate flex-grow"><span className="text-gray-400 mr-1">Link:</span><span className="text-sky-600 font-medium">{page.url}</span></p><div className="flex items-center ml-2"><button onClick={() => openQrCode(page.url, page.headline || page.title, page.creator)} className="p-1 text-gray-500 hover:text-sky-600 hover:bg-gray-200 rounded transition-colors cursor-pointer mr-1" title="Generate QR Code"><QrCode className="h-4 w-4" /></button><button onClick={() => copyUrlToClipboard(page.id, page.url)} className="p-1 text-gray-500 hover:text-sky-600 hover:bg-gray-200 rounded transition-colors cursor-pointer" title="Copy link to clipboard"><Copy className="h-4 w-4" /></button></div>{copiedUrl === page.id && (<div className="absolute right-0 top-8 bg-green-100 text-green-800 px-2 py-1 rounded-md shadow-sm text-xs z-10 animate-pulse">URL copied!</div>)}</div>)}
                        <div className="mt-5 pt-3 border-t border-gray-100 flex justify-between">
                            <div className="space-x-3">
                            <button className="text-sm text-sky-600 hover:text-sky-700 cursor-pointer bg-sky-50 hover:bg-sky-100 px-2.5 py-1.5 rounded transition-colors" onClick={() => openEditor(page.id, page.draft_url)} disabled={actionLoading === page.id}>
                                {actionLoading === page.id ? (
                                <div className="inline-block h-3 w-3 animate-spin rounded-full border border-gray-500 border-t-transparent mr-1.5"></div>
                                ) : (
                                <Edit size={14} className="inline mr-1.5" />
                                )}
                                Edit
                            </button>
                            <button
                                className="text-sm text-gray-600 hover:text-gray-700 cursor-pointer bg-gray-50 hover:bg-gray-100 px-2.5 py-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={() => openPreview(page.id, page.draft_url)}
                                disabled={actionLoading === page.id}
                            >
                                {actionLoading === page.id ? (
                                <>
                                    <div className="inline-block h-3 w-3 animate-spin rounded-full border border-gray-500 border-t-transparent mr-1.5"></div>
                                    Loading...
                                </>
                                ) : (
                                <>
                                    <Eye size={14} className="inline mr-1.5" />
                                    Preview
                                </>
                                )}
                            </button>
                            </div>
                            <button className="text-sm text-red-600 hover:text-red-700 cursor-pointer bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded transition-colors" onClick={() => handleDeletePage(page)} title="Delete page"><Trash2 size={14} className="inline mr-1.5" />Delete</button>
                        </div>
                        </div>
                    </div>
                    ))}
                </div>
                )}
            </>
            )}

            <div className="px-4 sm:px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex justify-center">
                    <button className="flex items-center border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 px-4 py-2 rounded-md text-sm cursor-pointer">
                        <Plus size={16} className="mr-2" />
                        Show more pages
                    </button>
                </div>
            </div>
        </div>
      </div>

      {actionError && (
      <div className="fixed bottom-4 left-4 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center max-w-md">
        <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0" />
        <div>
          <p className="font-medium">Action Error</p>
          <p className="text-sm opacity-90">{actionError}</p>
        </div>
        <button
          onClick={() => setActionError(null)}
          className="ml-3 text-white hover:text-gray-200"
        >
          <X size={16} />
        </button>
      </div>
    )}

      {isDeleteModalOpen && pageToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={cancelDeletePage} />
          <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md p-6 mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Confirm Deletion</h3>
            <div className="my-4">
              <p className="text-gray-600 mb-2">
                Are you sure you want to delete the page <span className="font-semibold text-gray-800">{pageToDelete.headline || pageToDelete.title}</span>?
              </p>
              <p className="text-sm text-red-600">
                This action is irreversible. All files and data associated with this page will be deleted.
              </p>
            </div>
            {deleteError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
                <p>{deleteError}</p>
              </div>
            )}
            <div className="flex justify-end space-x-3 mt-6">
              <button type="button" onClick={cancelDeletePage} disabled={isDeleting} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={confirmDeletePage} disabled={isDeleting} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md text-white disabled:bg-red-400">
                {isDeleting ? (<div className="flex items-center"><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div><span>Deleting...</span></div>) : ('Delete Page')}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
            <div ref={previewModalRef} className="relative w-full max-w-screen-xl max-h-[95vh] flex flex-col bg-black/50 rounded-lg animate-fadeIn">
                <div className="flex items-center justify-between p-4 flex-shrink-0 border-b border-white/10">
                    <div className="flex items-center space-x-3 min-w-0">
                        <ImageIcon className="h-5 w-5 text-white flex-shrink-0" />
                        <h3 className="text-white font-medium truncate">Cover Preview</h3>
                    </div>
                    <button onClick={closeCoverPreview} className="text-white hover:text-gray-300 transition-colors flex-shrink-0 ml-4">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 flex flex-col md:flex-row gap-6 p-4 min-h-0">
                    <div className="md:w-2/3 flex items-center justify-center">
                        <div className="max-w-full max-h-full rounded-lg shadow-2xl overflow-hidden" style={{ height: 'calc(95vh - 160px)' }}>
                            <img
                                src={previewImage.url}
                                alt={`Cover for: ${previewImage.title}`}
                                className="w-full h-full object-contain"
                            />
                        </div>
                    </div>

                    <div className="md:w-1/3 bg-black/20 rounded-lg flex flex-col overflow-hidden border border-white/10">
                        <div className="p-3 flex-shrink-0 bg-black/20">
                        <h4 className="font-semibold text-white flex items-center">
                            <FileText size={18} className="mr-2 text-gray-300"/>
                            Page Information
                        </h4>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3">
                            <ul className="space-y-4">
                                <li>
                                    <span className="block text-xs text-gray-400 font-medium uppercase tracking-wider">Title</span>
                                    <p className="text-gray-200 text-base">{previewImage.title}</p>
                                </li>
                                {previewImage.subtitle && (
                                    <li>
                                        <span className="block text-xs text-gray-400 font-medium uppercase tracking-wider">Subtitle</span>
                                        <p className="text-gray-300 text-sm">{previewImage.subtitle}</p>
                                    </li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="flex justify-center items-center p-4 flex-shrink-0 space-x-3 border-t border-white/10">
                    <button onClick={closeCoverPreview} className="px-6 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors font-medium">
                        Close
                    </button>
                </div>
            </div>
        </div>
      )}

      {previewNotification && (
        <div className="fixed bottom-4 right-4 bg-indigo-600 text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center animate-fade-in">
          <Eye className="h-5 w-5 mr-3" />
          <span>Opening preview in a new tab...</span>
        </div>
      )}

      {qrCodeData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeQrCode} />
          <div className="relative bg-white rounded-lg shadow-lg p-6 mx-4 max-w-md w-full">
            <button onClick={closeQrCode} className="absolute top-2 right-2 p-2 rounded-full bg-white/80 text-gray-700 hover:bg-gray-200 transition-colors"><X size={24} /></button>
            <div className="flex flex-col items-center">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">{qrCodeData.title}</h3>
              <div className="mb-4 text-center">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-2 overflow-hidden border border-gray-200">{qrCodeData.logoUrl ? (<img src={qrCodeData.logoUrl} alt="Company Logo" className="w-full h-full object-contain p-1" onError={(e) => { const imgElement = e.currentTarget as HTMLImageElement; imgElement.style.display = 'none'; const parent = imgElement.parentElement; if (parent) { const fallbackIcon = document.createElement('div'); fallbackIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-600"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8"y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`; parent.appendChild(fallbackIcon); } }} />) : (<FileText size={32} className="text-blue-600" />)}</div>
                <p className="text-sm text-gray-600 mb-1">Creator: {qrCodeData.creator}</p>
                <p className="text-xs text-gray-500 truncate max-w-xs">{qrCodeData.url}</p>
              </div>
              <div className="w-64 h-64 bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-center relative">
                <QRCodeSVG value={qrCodeData.url} size={200} bgColor={"#ffffff"} fgColor={"#000000"} level={"H"} includeMargin={true} ref={qrCodeRef} />
                <div className="absolute -bottom-8 text-center w-full">
                  <p className="text-xs text-gray-500">Scan the QR code to visit the page</p>
                </div>
              </div>
              <div className="mt-14 flex flex-col space-y-3">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center" onClick={copyQrCodeToClipboard} disabled={copyingQr || qrCopied}>
                  {copyingQr ? (<><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div><span>Copying...</span></>) : qrCopied ? (<><Check className="h-4 w-4 mr-2" /><span>Copied to clipboard!</span></>) : (<><Copy className="h-4 w-4 mr-2" /><span>Copy QR Code to clipboard</span></>)}
                </button>
                <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors" onClick={closeQrCode}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-in-out;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default PagesView;