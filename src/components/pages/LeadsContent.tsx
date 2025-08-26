"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserCheck, Search, Download, Trash2, AlertCircle, RefreshCw, MessageCircle, AlertTriangle, Archive, Edit, Save, X, Sparkles, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Add declaration for the autoTable extension
declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: any) => jsPDF;
    }
}

// --- Interfaces ---
interface Lead {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    page: string;
    status: string;
    comment: string | null;
    createdAt: string;
    creatorId?: string;
}

interface Stats {
    total: number;
    active: number;
    new: number;
    contacted: number;
    archived: number;
}

// --- Main Component ---
const LeadsContent = () => {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [stats, setStats] = useState<Stats>({ total: 0, active: 0, new: 0, contacted: 0, archived: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // States for filtering and searching
    const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'new' | 'contacted' | 'archived'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

    // States for editing, deleting, and menus
    const [editingComment, setEditingComment] = useState<{ id: number; text: string } | null>(null);
    const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
    const [openStatusMenu, setOpenStatusMenu] = useState<{ id: number, top: number, left: number } | null>(null);
    const [tooltip, setTooltip] = useState<{ content: string; top: number; left: number } | null>(null);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

    const statusMenuRef = useRef<HTMLDivElement>(null);
    const exportMenuRef = useRef<HTMLDivElement>(null);
    const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // --- Debouncing logic for search ---
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);

        return () => {
            clearTimeout(timer);
        };
    }, [searchTerm]);

    // --- Fetching data from the server ---
    const fetchLeads = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (debouncedSearchTerm) {
                params.append('search', debouncedSearchTerm);
            }
            if (activeFilter !== 'all') {
                params.append('status', activeFilter);
            }

            const response = await fetch(`/api/leads?${params.toString()}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch leads.');
            }
            const data = await response.json();
            setLeads(data.leads || []);
            setStats(data.stats || { total: 0, active: 0, new: 0, contacted: 0, archived: 0 });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    }, [debouncedSearchTerm, activeFilter]);

    useEffect(() => {
        fetchLeads();
    }, [fetchLeads]);

    // --- Closing menus on outside click ---
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) {
                setOpenStatusMenu(null);
            }
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setIsExportMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // --- Helper Functions ---
    const allStatuses = [
        { id: 'b_contact', text: 'New', color: 'bg-green-100 text-green-700', icon: <Sparkles size={14} /> },
        { id: 'a_contact', text: 'Contacted', color: 'bg-orange-100 text-orange-700', icon: <MessageCircle size={14} /> },
        { id: 'archive', text: 'Archived', color: 'bg-gray-100 text-gray-700', icon: <Archive size={14} /> }
    ];

    const getStatusProps = (status: string) => {
        return allStatuses.find(s => s.id === status) || { text: 'Unknown', color: 'bg-gray-100 text-gray-700', icon: <AlertCircle size={14} /> };
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('en-US', {
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        });
    };

    // --- Export Functions ---
    const handleExportCSV = () => {
        const worksheet = XLSX.utils.json_to_sheet(leads.map(lead => ({
            'ID': lead.id,
            'Name': lead.name,
            'Email': lead.email,
            'Phone': lead.phone || '',
            'Page': lead.page,
            'Status': getStatusProps(lead.status).text,
            'Creation Date': formatDate(lead.createdAt),
            'Comment': lead.comment || ''
        })));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
        XLSX.writeFile(workbook, "leads.csv", { bookType: "csv" });
        setIsExportMenuOpen(false);
    };

    const handleExportXLS = () => {
        const worksheet = XLSX.utils.json_to_sheet(leads.map(lead => ({
            'ID': lead.id,
            'Name': lead.name,
            'Email': lead.email,
            'Phone': lead.phone || '',
            'Page': lead.page,
            'Status': getStatusProps(lead.status).text,
            'Creation Date': formatDate(lead.createdAt),
            'Comment': lead.comment || ''
        })));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
        XLSX.writeFile(workbook, "leads.xlsx");
        setIsExportMenuOpen(false);
    };

    const handleExportPDF = async () => {
        try {
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            // Step 1: Load font files
            const fontUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf';
            const fontBoldUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf';

            const [font, fontBold] = await Promise.all([
                fetch(fontUrl).then(res => res.arrayBuffer()),
                fetch(fontBoldUrl).then(res => res.arrayBuffer())
            ]);

            // Step 2: Safely convert buffer to Base64
            const convertBufferToBase64 = (buffer: ArrayBuffer) => {
                let binary = '';
                const bytes = new Uint8Array(buffer);
                const len = bytes.byteLength;
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                return btoa(binary);
            };

            const base64Font = convertBufferToBase64(font);
            const base64FontBold = convertBufferToBase64(fontBold);

            // Step 3: Add fonts to the PDF's VFS and register them
            doc.addFileToVFS('Roboto-Regular.ttf', base64Font);
            doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');

            doc.addFileToVFS('Roboto-Medium.ttf', base64FontBold);
            doc.addFont('Roboto-Medium.ttf', 'Roboto', 'bold');

            // Step 4: Set the loaded font as default
            doc.setFont('Roboto', 'normal');

            // Document Title
            doc.setFontSize(16);
            doc.setFont('Roboto', 'bold');
            doc.text('Lead List', 14, 15);

            doc.setFontSize(10);
            doc.setFont('Roboto', 'normal');
            doc.text(`Export Date: ${new Date().toLocaleString('en-US')}`, 14, 22);

            // Prepare table data
            const headers = [[
                'ID',
                'Name',
                'Email',
                'Phone',
                'Page',
                'Status',
                'Date',
                'Comment'
            ]];

            const body = leads.map(lead => [
                lead.id.toString(),
                lead.name || '',
                lead.email || '',
                lead.phone || '-',
                lead.page || '',
                getStatusProps(lead.status).text || '',
                formatDate(lead.createdAt) || '',
                lead.comment || '-'
            ]);

            // Generate table using the new font
            autoTable(doc, {
                head: headers,
                body: body,
                startY: 28,
                theme: 'grid',
                styles: {
                    font: 'Roboto',
                    fontSize: 9,
                },
                headStyles: {
                    font: 'Roboto',
                    fontStyle: 'bold',
                    fillColor: [38, 41, 46],
                    textColor: [255, 255, 255],
                },
            });

            // Save the PDF
            doc.save(`leads_${new Date().toISOString().split('T')[0]}.pdf`);

            console.info('PDF generated successfully with full Unicode support.');

        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Failed to generate PDF. Make sure you have an internet connection to download the fonts. Check the console for details.");
        } finally {
            setIsExportMenuOpen(false);
        }
    };

    // --- Action Handlers (edit, delete, tooltip) ---
    const handleStatusChange = async (leadId: number, newStatus: string) => {
        setOpenStatusMenu(null);
        setUpdatingStatusId(leadId);
        try {
            const response = await fetch(`/api/leads/${leadId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            if (!response.ok) throw new Error('Error changing status');
            await fetchLeads();
        } catch (e) {
            setError('Failed to change status.');
        } finally {
            setUpdatingStatusId(null);
        }
    };

    const handleSaveComment = useCallback(async () => {
        if (!editingComment) return;
        const { id, text } = editingComment;
        setUpdatingStatusId(id);
        try {
            const response = await fetch(`/api/leads/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment: text })
            });
            if (!response.ok) throw new Error('Error saving comment');
            setEditingComment(null);
            await fetchLeads();
        } catch (e) {
            setError('Failed to save comment.');
        } finally {
            setUpdatingStatusId(null);
        }
    }, [editingComment, fetchLeads]);

    const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSaveComment();
        }
    };

    const handleDeleteClick = (lead: Lead) => {
        setLeadToDelete(lead);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (!leadToDelete) return;
        setDeletingId(leadToDelete.id);
        try {
            const response = await fetch(`/api/leads/${leadToDelete.id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Error deleting lead');
            setShowDeleteConfirm(false);
            setLeadToDelete(null);
            await fetchLeads();
        } catch (e) {
            setError('Failed to delete lead.');
        } finally {
            setDeletingId(null);
        }
    };

    const handleOpenStatusMenu = (leadId: number, event: React.MouseEvent) => {
        if (openStatusMenu?.id === leadId) {
            setOpenStatusMenu(null);
            return;
        }
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const MENU_HEIGHT = 120;
        const SPACE_BELOW = window.innerHeight - rect.bottom;

        const topPosition = SPACE_BELOW < MENU_HEIGHT
            ? rect.top + window.scrollY - MENU_HEIGHT - 4
            : rect.bottom + window.scrollY + 4;

        setOpenStatusMenu({
            id: leadId,
            top: topPosition,
            left: rect.left
        });
    };

    const handleCommentMouseEnter = (e: React.MouseEvent<HTMLDivElement>, comment: string | null) => {
        if (tooltipTimeoutRef.current) {
            clearTimeout(tooltipTimeoutRef.current);
        }
        if (!comment) return;

        const pTag = e.currentTarget.querySelector('p');
        if (pTag && (pTag.scrollWidth > pTag.clientWidth || pTag.scrollHeight > pTag.clientHeight)) {
            const rect = e.currentTarget.getBoundingClientRect();
            setTooltip({
                content: comment,
                top: rect.top,
                left: rect.left,
            });
        }
    };

    const handleCommentMouseLeave = () => {
        tooltipTimeoutRef.current = setTimeout(() => {
            setTooltip(null);
        }, 100);
    };

    // --- Component Rendering ---
    return (
        <div className="space-y-6">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <button onClick={() => setActiveFilter('active')} className={`bg-blue-50 rounded-xl p-4 sm:p-6 border transition-all duration-200 text-left hover:shadow-md cursor-pointer ${activeFilter === 'active' ? 'border-blue-400 ring-2 ring-blue-200 bg-blue-100' : 'border-blue-200 hover:border-blue-300'}`}>
                    <div className="flex items-center justify-between">
                        <div><p className="text-blue-600 text-sm font-medium">Active</p><p className="text-xl sm:text-2xl font-bold text-blue-900">{stats.active}</p></div>
                        <UserCheck className="text-blue-600" size={28} />
                    </div>
                </button>
                <button onClick={() => setActiveFilter('new')} className={`bg-green-50 rounded-xl p-4 sm:p-6 border transition-all duration-200 text-left hover:shadow-md cursor-pointer ${activeFilter === 'new' ? 'border-green-400 ring-2 ring-green-200 bg-green-100' : 'border-green-200 hover:border-green-300'}`}>
                    <div className="flex items-center justify-between">
                        <div><p className="text-green-600 text-sm font-medium">New</p><p className="text-xl sm:text-2xl font-bold text-green-900">{stats.new}</p></div>
                        <Sparkles className="text-green-600" size={28} />
                    </div>
                </button>
                <button onClick={() => setActiveFilter('contacted')} className={`bg-orange-50 rounded-xl p-4 sm:p-6 border transition-all duration-200 text-left hover:shadow-md cursor-pointer ${activeFilter === 'contacted' ? 'border-orange-400 ring-2 ring-orange-200 bg-orange-100' : 'border-orange-200 hover:border-orange-300'}`}>
                    <div className="flex items-center justify-between">
                        <div><p className="text-orange-600 text-sm font-medium">Contacted</p><p className="text-xl sm:text-2xl font-bold text-orange-900">{stats.contacted}</p></div>
                        <MessageCircle className="text-orange-600" size={28} />
                    </div>
                </button>
                <button onClick={() => setActiveFilter('archived')} className={`bg-gray-50 rounded-xl p-4 sm:p-6 border transition-all duration-200 text-left hover:shadow-md cursor-pointer ${activeFilter === 'archived' ? 'border-gray-400 ring-2 ring-gray-200 bg-gray-100' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className="flex items-center justify-between">
                        <div><p className="text-gray-600 text-sm font-medium">Archived</p><p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.archived}</p></div>
                        <Archive className="text-gray-600" size={28} />
                    </div>
                </button>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="relative w-full sm:max-w-xs">
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                            aria-label="Clear search"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                <div className="relative w-full sm:w-auto" ref={exportMenuRef}>
                    <button
                        onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                        className="w-full sm:w-auto flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium cursor-pointer"
                    >
                        <Download size={16} className="mr-2" />
                        Export Leads
                        <ChevronDown size={16} className={`ml-2 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isExportMenuOpen && (
                        <div className="absolute top-full right-0 mt-2 w-40 bg-white rounded-md shadow-lg border border-gray-200 z-10 animate-menu-fade-in">
                            <ul className="py-1">
                                <li><button onClick={handleExportCSV} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">As .csv</button></li>
                                <li><button onClick={handleExportXLS} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">As .xls</button></li>
                                <li><button onClick={handleExportPDF} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">As .pdf</button></li>
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            {/* Leads Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[15%]">Lead</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[25%]">Source</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[35%]">Comment</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-[5%]">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {isLoading ? (
                                <tr><td colSpan={6} className="text-center py-12"><RefreshCw className="mx-auto h-8 w-8 text-gray-400 animate-spin" /></td></tr>
                            ) : error ? (
                                <tr><td colSpan={6} className="text-center py-12 text-red-600">{error}</td></tr>
                            ) : leads.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-12 text-gray-500">{searchTerm || activeFilter !== 'all' ? 'No leads match the criteria.' : 'You have no leads yet.'}</td></tr>
                            ) : (
                                leads.map(lead => (
                                    <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatDate(lead.createdAt)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900 truncate">{lead.name}</div>
                                            <div className="text-sm text-gray-500 truncate">{lead.email}</div>
                                            {lead.phone && <div className="text-sm text-gray-500 truncate">{lead.phone}</div>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 truncate">{lead.page}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <button onClick={(e) => handleOpenStatusMenu(lead.id, e)} disabled={updatingStatusId === lead.id} className={`flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium rounded-full w-full justify-center transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-wait cursor-pointer ${getStatusProps(lead.status).color}`}>
                                                {updatingStatusId === lead.id ? <RefreshCw size={14} className="animate-spin" /> : getStatusProps(lead.status).icon}
                                                <span>{getStatusProps(lead.status).text}</span>
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {editingComment?.id === lead.id ? (
                                                <div className="flex items-center gap-2">
                                                    <textarea
                                                        value={editingComment.text}
                                                        onChange={(e) => setEditingComment({ ...editingComment, text: e.target.value })}
                                                        onKeyDown={handleCommentKeyDown}
                                                        className="w-full p-1 border border-gray-300 rounded-md text-xs"
                                                        rows={2}
                                                        autoFocus
                                                    />
                                                    <button onClick={handleSaveComment} className="p-1 text-green-600 hover:bg-green-100 rounded-full cursor-pointer"><Save size={14} /></button>
                                                    <button onClick={() => setEditingComment(null)} className="p-1 text-red-600 hover:bg-red-100 rounded-full cursor-pointer"><X size={14} /></button>
                                                </div>
                                            ) : (
                                                <div
                                                    className="group flex items-center justify-between gap-2"
                                                    onMouseEnter={(e) => handleCommentMouseEnter(e, lead.comment)}
                                                    onMouseLeave={handleCommentMouseLeave}
                                                >
                                                    <p className="italic text-gray-500 line-clamp-2">
                                                        {lead.comment || '-'}
                                                    </p>
                                                    <button onClick={() => setEditingComment({ id: lead.id, text: lead.comment || '' })} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-500 hover:bg-gray-200 rounded-full flex-shrink-0 cursor-pointer">
                                                        <Edit size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button onClick={() => handleDeleteClick(lead)} disabled={deletingId === lead.id} className="p-2 text-red-600 hover:bg-red-100 rounded-full transition-colors disabled:opacity-50 cursor-pointer">
                                                {deletingId === lead.id ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Comment Tooltip */}
            {tooltip && (
                <div
                    className="fixed z-50 w-max max-w-xs bg-white/90 backdrop-blur-sm text-gray-800 text-sm rounded-lg p-3 shadow-2xl border border-gray-200 animate-tooltip"
                    style={{
                        top: `${tooltip.top}px`,
                        left: `${tooltip.left}px`,
                        transform: 'translateY(calc(-100% - 8px))',
                        maxWidth: typeof window !== 'undefined' ? `min(320px, ${window.innerWidth - tooltip.left - 24}px)` : '320px',
                        transformOrigin: 'bottom left',
                    }}
                    onMouseEnter={() => tooltipTimeoutRef.current && clearTimeout(tooltipTimeoutRef.current)}
                    onMouseLeave={handleCommentMouseLeave}
                >
                    <p style={{ whiteSpace: 'pre-wrap', textAlign: 'left' }}>
                        {tooltip.content}
                    </p>
                    <div
                        className="absolute top-full left-4 w-3 h-3 bg-inherit border-inherit"
                        style={{
                            transform: 'translateY(-50%) rotate(45deg)',
                            borderTop: 'none',
                            borderLeft: 'none',
                            clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)',
                        }}
                    ></div>
                </div>
            )}

            {/* Status Popup */}
            {openStatusMenu && (
                <div
                    ref={statusMenuRef}
                    className="fixed z-50 w-40 bg-white rounded-md shadow-lg border border-gray-200 animate-menu-fade-in"
                    style={{ top: `${openStatusMenu.top}px`, left: `${openStatusMenu.left}px` }}
                >
                    <ul className="py-1">
                        {allStatuses.map(statusOption => (
                            <li key={statusOption.id}>
                                <button
                                    onClick={() => handleStatusChange(openStatusMenu.id, statusOption.id)}
                                    className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                                >
                                    {React.cloneElement(statusOption.icon, { className: getStatusProps(statusOption.id).color.split(' ')[1] })}
                                    <span>{statusOption.text}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Modals */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                        <h3 className="text-lg font-bold text-gray-800">Confirm Deletion</h3>
                        <p className="text-gray-600 my-4">Are you sure you want to delete the lead "{leadToDelete?.name}"? This action cannot be undone.</p>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50 cursor-pointer">Cancel</button>
                            <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer">Yes, delete</button>
                        </div>
                    </div>
                </div>
            )}
            <style jsx>{`
                .animate-menu-fade-in {
                    animation: menu-fade-in 0.15s ease-in-out;
                }
                @keyframes menu-fade-in {
                    from { opacity: 0; transform: scale(0.98) translateY(-5px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .animate-tooltip {
                    animation: tooltip-fade-in 0.15s ease-out;
                }
                @keyframes tooltip-fade-in {
                    from { opacity: 0; transform: scale(0.95) translateY(calc(-100% - 0px)); }
                    to { opacity: 1; transform: scale(1) translateY(calc(-100% - 8px)); }
                }
            `}</style>
        </div>
    );
};

export default LeadsContent;