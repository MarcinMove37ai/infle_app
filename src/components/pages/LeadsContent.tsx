"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserCheck, Search, Download, Trash2, AlertCircle, RefreshCw, MessageCircle, AlertTriangle, Archive, Edit, Save, X, Sparkles, ChevronDown, Mail, Phone, Calendar, Globe, ArrowLeft, MessageSquarePlus } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Add declaration for the autoTable extension
declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: any) => jsPDF;
    }
}

// --- Tłumaczenia ---
const translations = {
    pl: {
        // Karty statystyk
        active: 'Aktywne',
        new: 'Nowe',
        contacted: 'Nawiązano kontakt',
        archived: 'Zarchiwizowane',

        // Pasek akcji
        searchPlaceholder: 'Szukaj leadów...',
        search: 'Szukaj',
        clear: 'Wyczyść',
        exportLeads: 'Eksportuj Leady',
        exportAsCsv: 'Jako .csv',
        exportAsXls: 'Jako .xls',
        exportAsPdf: 'Jako .pdf',

        // Tabela
        date: 'Data',
        lead: 'Lead',
        source: 'Źródło',
        status: 'Status',
        comment: 'Komentarz',
        actions: 'Akcje',
        addComment: 'Dodaj komentarz',
        noLeadsMatch: 'Brak leadów pasujących do kryteriów.',
        noLeadsYet: 'Nie masz jeszcze żadnych leadów.',
        loading: 'Ładowanie...',

        // Statusy
        statusNew: 'Nowy',
        statusContacted: 'Nawiązano kontakt',
        statusArchived: 'Zarchiwizowany',
        statusUnknown: 'Nieznany',

        // Błędy i komunikaty
        errorFetch: 'Nie udało się pobrać leadów.',
        errorUnknown: 'Wystąpił nieznany błąd.',
        errorChangeStatus: 'Nie udało się zmienić statusu.',
        errorSaveComment: 'Nie udało się zapisać komentarza.',
        errorDeleteComment: 'Nie udało się usunąć komentarza.',
        errorDeleteLead: 'Nie udało się usunąć leada.',
        errorPdf: 'Nie udało się wygenerować PDF. Sprawdź konsolę.',

        // Modal usuwania
        confirmDeletion: 'Potwierdź Usunięcie',
        deleteLeadMsg: 'Czy na pewno chcesz usunąć leada "{leadName}"? Tej akcji nie można cofnąć.',
        cancel: 'Anuluj',
        yesDelete: 'Tak, usuń',

        // Modal mobilny
        changeStatus: 'Zmień status',
        selectNewStatus: 'Wybierz nowy status dla tego leada',
        delete: 'Usuń',
        edit: 'Edytuj',
        noComment: 'Brak komentarza...',
        save: 'Zapisz',
        close: 'Zamknij',

        // Nagłówki eksportu
        exportHeaderId: 'ID',
        exportHeaderName: 'Imię',
        exportHeaderEmail: 'Email',
        exportHeaderPhone: 'Telefon',
        exportHeaderPage: 'Strona',
        exportHeaderStatus: 'Status',
        exportHeaderDate: 'Data Utworzenia',
        exportHeaderComment: 'Komentarz',
        exportTitle: 'Lista Leadów',
        exportDate: 'Data eksportu'
    },
    en: {
        // Stat Cards
        active: 'Active',
        new: 'New',
        contacted: 'Contacted',
        archived: 'Archived',

        // Action Bar
        searchPlaceholder: 'Search leads...',
        search: 'Search',
        clear: 'Clear',
        exportLeads: 'Export Leads',
        exportAsCsv: 'As .csv',
        exportAsXls: 'As .xls',
        exportAsPdf: 'As .pdf',

        // Table
        date: 'Date',
        lead: 'Lead',
        source: 'Source',
        status: 'Status',
        comment: 'Comment',
        actions: 'Actions',
        addComment: 'Add comment',
        noLeadsMatch: 'No leads match the criteria.',
        noLeadsYet: 'You have no leads yet.',
        loading: 'Loading...',

        // Statuses
        statusNew: 'New',
        statusContacted: 'Contacted',
        statusArchived: 'Archived',
        statusUnknown: 'Unknown',

        // Errors and Messages
        errorFetch: 'Failed to fetch leads.',
        errorUnknown: 'An unknown error occurred.',
        errorChangeStatus: 'Error changing status',
        errorSaveComment: 'Error saving comment',
        errorDeleteComment: 'Error deleting comment',
        errorDeleteLead: 'Error deleting lead',
        errorPdf: 'Failed to generate PDF. Check the console for details.',

        // Delete Modal
        confirmDeletion: 'Confirm Deletion',
        deleteLeadMsg: 'Are you sure you want to delete the lead "{leadName}"? This action cannot be undone.',
        cancel: 'Cancel',
        yesDelete: 'Yes, delete',

        // Mobile Modal
        changeStatus: 'Change Status',
        selectNewStatus: 'Select a new status for this lead',
        delete: 'Delete',
        edit: 'Edit',
        noComment: 'No comment...',
        save: 'Save',
        close: 'Close',

        // Export Headers
        exportHeaderId: 'ID',
        exportHeaderName: 'Name',
        exportHeaderEmail: 'Email',
        exportHeaderPhone: 'Phone',
        exportHeaderPage: 'Page',
        exportHeaderStatus: 'Status',
        exportHeaderDate: 'Creation Date',
        exportHeaderComment: 'Comment',
        exportTitle: 'Lead List',
        exportDate: 'Export Date'
    }
};

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

    // States for editing, deleting, and menus
    const [editingComment, setEditingComment] = useState<{ id: number; text: string } | null>(null);
    const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
    const [openStatusMenu, setOpenStatusMenu] = useState<{ id: number, top: number, left: number } | null>(null);
    const [tooltip, setTooltip] = useState<{ content: string; top: number; left: number } | null>(null);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

    // State for the mobile lead details modal
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

    // 🆕 State for managing the status change view within the mobile modal
    const [isChangingStatus, setIsChangingStatus] = useState(false);

    // 🆕 Language state
    const [currentLang, setCurrentLang] = useState<'pl' | 'en'>('pl');

    const statusMenuRef = useRef<HTMLDivElement>(null);
    const exportMenuRef = useRef<HTMLDivElement>(null);
    const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const savedLang = localStorage.getItem('appLanguage');
        if (savedLang === 'en' || savedLang === 'pl') {
            setCurrentLang(savedLang);
        }
    }, []);

    const t = translations[currentLang];

    // --- Fetching data from the server ---
    const fetchLeads = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (searchTerm) {
                params.append('search', searchTerm);
            }
            if (activeFilter !== 'all') {
                params.append('status', activeFilter);
            }

            const response = await fetch(`/api/leads?${params.toString()}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || t.errorFetch);
            }
            const data = await response.json();
            setLeads(data.leads || []);
            setStats(data.stats || { total: 0, active: 0, new: 0, contacted: 0, archived: 0 });
        } catch (err) {
            setError(err instanceof Error ? err.message : t.errorUnknown);
        } finally {
            setIsLoading(false);
        }
    }, [searchTerm, activeFilter, t]);

    useEffect(() => {
        fetchLeads();
    }, [activeFilter, fetchLeads]);


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

    // 🆕 Reset modal-specific states when the main modal is closed
    useEffect(() => {
        if (!selectedLead) {
            setIsChangingStatus(false);
            setEditingComment(null);
        }
    }, [selectedLead]);


    // --- Helper Functions ---
    const allStatuses = [
        { id: 'b_contact', text: t.statusNew, color: 'bg-green-100 text-green-700', icon: <Sparkles size={14} /> },
        { id: 'a_contact', text: t.statusContacted, color: 'bg-orange-100 text-orange-700', icon: <MessageCircle size={14} /> },
        { id: 'archive', text: t.statusArchived, color: 'bg-gray-100 text-gray-700', icon: <Archive size={14} /> }
    ];

    // Update `allStatuses` when language changes
    useEffect(() => {
        setLeads(prevLeads => [...prevLeads]); // Re-trigger render to update status text in table
    }, [t]);

    const getStatusProps = (status: string) => {
        // Find by ID first
        let found = allStatuses.find(s => s.id === status);
        if (found) {
            // Return with translated text
            return {
                ...found,
                text: t[status.replace('b_contact', 'statusNew').replace('a_contact', 'statusContacted').replace('archive', 'statusArchived') as keyof typeof t] || t.statusUnknown
            };
        }
        return { text: t.statusUnknown, color: 'bg-gray-100 text-gray-700', icon: <AlertCircle size={14} /> };
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString(currentLang === 'pl' ? 'pl-PL' : 'en-US', {
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        });
    };

    // --- Export Functions ---
    const handleExportCSV = () => {
        const worksheet = XLSX.utils.json_to_sheet(leads.map(lead => ({
            [t.exportHeaderId]: lead.id,
            [t.exportHeaderName]: lead.name,
            [t.exportHeaderEmail]: lead.email,
            [t.exportHeaderPhone]: lead.phone || '',
            [t.exportHeaderPage]: lead.page,
            [t.exportHeaderStatus]: getStatusProps(lead.status).text,
            [t.exportHeaderDate]: formatDate(lead.createdAt),
            [t.exportHeaderComment]: lead.comment || ''
        })));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
        XLSX.writeFile(workbook, "leads.csv", { bookType: "csv" });
        setIsExportMenuOpen(false);
    };

    const handleExportXLS = () => {
        const worksheet = XLSX.utils.json_to_sheet(leads.map(lead => ({
            [t.exportHeaderId]: lead.id,
            [t.exportHeaderName]: lead.name,
            [t.exportHeaderEmail]: lead.email,
            [t.exportHeaderPhone]: lead.phone || '',
            [t.exportHeaderPage]: lead.page,
            [t.exportHeaderStatus]: getStatusProps(lead.status).text,
            [t.exportHeaderDate]: formatDate(lead.createdAt),
            [t.exportHeaderComment]: lead.comment || ''
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

            // Pobieranie fontów (ważne dla polskich znaków)
            const fontUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf';
            const fontBoldUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf';

            const [font, fontBold] = await Promise.all([
                fetch(fontUrl).then(res => res.arrayBuffer()),
                fetch(fontBoldUrl).then(res => res.arrayBuffer())
            ]);

            const convertBufferToBase64 = (buffer: ArrayBuffer) => {
                let binary = '';
                const bytes = new Uint8Array(buffer);
                for (let i = 0; i < bytes.byteLength; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                return btoa(binary);
            };

            doc.addFileToVFS('Roboto-Regular.ttf', convertBufferToBase64(font));
            doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');

            doc.addFileToVFS('Roboto-Medium.ttf', convertBufferToBase64(fontBold));
            doc.addFont('Roboto-Medium.ttf', 'Roboto', 'bold');

            doc.setFont('Roboto', 'normal');

            doc.setFontSize(16);
            doc.setFont('Roboto', 'bold');
            doc.text(t.exportTitle, 14, 15);

            doc.setFontSize(10);
            doc.setFont('Roboto', 'normal');
            doc.text(`${t.exportDate}: ${new Date().toLocaleString(currentLang === 'pl' ? 'pl-PL' : 'en-US')}`, 14, 22);

            const headers = [[t.exportHeaderId, t.exportHeaderName, t.exportHeaderEmail, t.exportHeaderPhone, t.exportHeaderPage, t.exportHeaderStatus, t.exportHeaderDate, t.exportHeaderComment]];
            const body = leads.map(lead => [
                lead.id.toString(), lead.name, lead.email, lead.phone || '-', lead.page,
                getStatusProps(lead.status).text, formatDate(lead.createdAt), lead.comment || '-'
            ]);

            autoTable(doc, {
                head: headers,
                body: body,
                startY: 28,
                theme: 'grid',
                styles: { font: 'Roboto', fontSize: 9 },
                headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: [38, 41, 46], textColor: [255, 255, 255] },
            });

            doc.save(`leads_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
            alert(t.errorPdf);
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
            if (!response.ok) throw new Error(t.errorChangeStatus);
            await fetchLeads();
            // If the mobile modal is open for this lead, update its data and switch view
            if (selectedLead && selectedLead.id === leadId) {
                setSelectedLead(prev => prev ? { ...prev, status: newStatus } : null);
                setIsChangingStatus(false);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : t.errorChangeStatus);
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
            if (!response.ok) throw new Error(t.errorSaveComment);
            setEditingComment(null);
            await fetchLeads();
             // If the mobile modal is open for this lead, update its data
            if (selectedLead && selectedLead.id === id) {
                setSelectedLead(prev => prev ? { ...prev, comment: text } : null);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : t.errorSaveComment);
        } finally {
            setUpdatingStatusId(null);
        }
    }, [editingComment, fetchLeads, selectedLead, t]);

    // 🆕 Handler for deleting a comment
    const handleDeleteComment = useCallback(async (leadId: number) => {
        setUpdatingStatusId(leadId);
        try {
            const response = await fetch(`/api/leads/${leadId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment: '' }) // Saving an empty string deletes the comment
            });
            if (!response.ok) throw new Error(t.errorDeleteComment);
            await fetchLeads();
            if (selectedLead && selectedLead.id === leadId) {
                setSelectedLead(prev => prev ? { ...prev, comment: null } : null);
            }
        } catch(e) {
            setError(e instanceof Error ? e.message : t.errorDeleteComment);
        } finally {
            setUpdatingStatusId(null);
        }
    }, [fetchLeads, selectedLead, t]);

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
            if (!response.ok) throw new Error(t.errorDeleteLead);
            setShowDeleteConfirm(false);
            setLeadToDelete(null);
            await fetchLeads();
        } catch (e) {
            setError(e instanceof Error ? e.message : t.errorDeleteLead);
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
        if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
        if (!comment) return;

        const pTag = e.currentTarget.querySelector('p');
        if (pTag && (pTag.scrollWidth > pTag.clientWidth || pTag.scrollHeight > pTag.clientHeight)) {
            const rect = e.currentTarget.getBoundingClientRect();
            setTooltip({ content: comment, top: rect.top, left: rect.left });
        }
    };

    const handleCommentMouseLeave = () => {
        tooltipTimeoutRef.current = setTimeout(() => setTooltip(null), 100);
    };

    return (
        <div className="space-y-6">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <button onClick={() => setActiveFilter('active')} className={`bg-blue-50 rounded-xl p-4 sm:p-6 border transition-all duration-200 text-left hover:shadow-md cursor-pointer ${activeFilter === 'active' ? 'border-blue-400 ring-2 ring-blue-200 bg-blue-100' : 'border-blue-200 hover:border-blue-300'}`}>
                    <div className="flex items-center justify-between">
                        <div><p className="text-blue-600 text-sm font-medium">{t.active}</p><p className="text-xl sm:text-2xl font-bold text-blue-900">{stats.active}</p></div>
                        <UserCheck className="text-blue-600" size={28} />
                    </div>
                </button>
                <button onClick={() => setActiveFilter('new')} className={`bg-green-50 rounded-xl p-4 sm:p-6 border transition-all duration-200 text-left hover:shadow-md cursor-pointer ${activeFilter === 'new' ? 'border-green-400 ring-2 ring-green-200 bg-green-100' : 'border-green-200 hover:border-green-300'}`}>
                    <div className="flex items-center justify-between">
                        <div><p className="text-green-600 text-sm font-medium">{t.new}</p><p className="text-xl sm:text-2xl font-bold text-green-900">{stats.new}</p></div>
                        <Sparkles className="text-green-600" size={28} />
                    </div>
                </button>
                <button onClick={() => setActiveFilter('contacted')} className={`bg-orange-50 rounded-xl p-4 sm:p-6 border transition-all duration-200 text-left hover:shadow-md cursor-pointer ${activeFilter === 'contacted' ? 'border-orange-400 ring-2 ring-orange-200 bg-orange-100' : 'border-orange-200 hover:border-orange-300'}`}>
                    <div className="flex items-center justify-between">
                        <div><p className="text-orange-600 text-sm font-medium">{t.contacted}</p><p className="text-xl sm:text-2xl font-bold text-orange-900">{stats.contacted}</p></div>
                        <MessageCircle className="text-orange-600" size={28} />
                    </div>
                </button>
                <button onClick={() => setActiveFilter('archived')} className={`bg-gray-50 rounded-xl p-4 sm:p-6 border transition-all duration-200 text-left hover:shadow-md cursor-pointer ${activeFilter === 'archived' ? 'border-gray-400 ring-2 ring-gray-200 bg-gray-100' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className="flex items-center justify-between">
                        <div><p className="text-gray-600 text-sm font-medium">{t.archived}</p><p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.archived}</p></div>
                        <Archive className="text-gray-600" size={28} />
                    </div>
                </button>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                <form onSubmit={(e) => { e.preventDefault(); fetchLeads(); }} className="flex w-full sm:max-w-md items-center gap-2">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            placeholder={t.searchPlaceholder}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:border-gray-400"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="hidden sm:inline-flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
                    >
                        {t.search}
                    </button>
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => { setSearchTerm(''); fetchLeads(); }}
                            className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
                        >
                            {t.clear}
                        </button>
                    )}
                </form>

                 <div className="relative w-full sm:w-auto" ref={exportMenuRef}>
                    <button
                        onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                        className="w-full sm:w-auto flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium cursor-pointer"
                    >
                        <Download size={16} className="mr-2" />
                        {t.exportLeads}
                        <ChevronDown size={16} className={`ml-2 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isExportMenuOpen && (
                        <div className="absolute top-full right-0 mt-2 w-full sm:w-40 bg-white rounded-md shadow-lg border border-gray-200 z-10 animate-menu-fade-in">
                            <ul className="py-1">
                                <li><button onClick={handleExportCSV} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">{t.exportAsCsv}</button></li>
                                <li><button onClick={handleExportXLS} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">{t.exportAsXls}</button></li>
                                <li><button onClick={handleExportPDF} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">{t.exportAsPdf}</button></li>
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            {/* Leads Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 table-fixed">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="hidden sm:table-cell w-[15%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.date}</th>
                                <th className="w-3/5 sm:w-[30%] px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.lead}</th>
                                <th className="hidden md:table-cell w-[20%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.source}</th>
                                <th className="w-2/5 sm:w-[15%] px-4 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t.status}</th>
                                <th className="hidden sm:table-cell w-[15%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.comment}</th>
                                <th className="hidden sm:table-cell w-[5%] px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t.actions}</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {isLoading ? (
                                <tr><td colSpan={6} className="text-center py-12"><RefreshCw className="mx-auto h-8 w-8 text-gray-400 animate-spin" /></td></tr>
                            ) : error ? (
                                <tr><td colSpan={6} className="text-center py-12 text-red-600">{error}</td></tr>
                            ) : leads.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-12 text-gray-500">{searchTerm || activeFilter !== 'all' ? t.noLeadsMatch : t.noLeadsYet}</td></tr>
                            ) : (
                                leads.map(lead => (
                                    <tr
                                        key={lead.id}
                                        onClick={() => {
                                            if (typeof window !== 'undefined' && window.innerWidth < 640) {
                                                setSelectedLead(lead);
                                            }
                                        }}
                                        className="sm:hover:bg-gray-50 transition-colors cursor-pointer sm:cursor-default"
                                    >
                                        <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatDate(lead.createdAt)}</td>
                                        <td className="px-4 sm:px-6 py-4 min-w-0 max-w-0 w-3/5 sm:w-[30%]">
                                            <div className="min-w-0">
                                                <div className="text-sm font-medium text-gray-900 truncate" title={lead.name}>
                                                    {lead.name}
                                                </div>
                                                <div className="text-xs sm:text-sm text-gray-500 truncate" title={lead.email}>
                                                    {lead.email}
                                                </div>
                                                {lead.phone && (
                                                    <div className="text-xs sm:text-sm text-gray-500 truncate" title={lead.phone || ''}>
                                                        {lead.phone}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="hidden md:table-cell px-6 py-4 min-w-0 max-w-0 w-[20%] text-sm text-gray-800">
                                            <div className="truncate" title={lead.page}>
                                                {lead.page}
                                            </div>
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap w-2/5 sm:w-[15%]">
                                            <button onClick={(e) => { e.stopPropagation(); handleOpenStatusMenu(lead.id, e); }} disabled={updatingStatusId === lead.id} className={`flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium rounded-full w-full justify-center transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-wait cursor-pointer ${getStatusProps(lead.status).color}`}>
                                                {updatingStatusId === lead.id ? <RefreshCw size={14} className="animate-spin" /> : getStatusProps(lead.status).icon}
                                                <span>{getStatusProps(lead.status).text}</span>
                                            </button>
                                        </td>
                                        <td className="hidden sm:table-cell px-6 py-4 text-sm text-gray-600">
                                            <div
                                                className="group flex items-center justify-between gap-2"
                                                onMouseEnter={(e) => handleCommentMouseEnter(e, lead.comment)}
                                                onMouseLeave={handleCommentMouseLeave}
                                                onClick={(e) => e.stopPropagation()} // Prevents mobile modal from opening when editing comment on desktop
                                            >
                                                {editingComment?.id === lead.id ? (
                                                    <div className="flex items-center gap-2 w-full">
                                                        <textarea value={editingComment.text} onChange={(e) => setEditingComment({ ...editingComment, text: e.target.value })} onKeyDown={handleCommentKeyDown} className="w-full p-1 border border-gray-300 rounded-md text-xs" rows={2} autoFocus />
                                                        <button onClick={handleSaveComment} className="p-1 text-green-600 hover:bg-green-100 rounded-full cursor-pointer"><Save size={14} /></button>
                                                        <button onClick={() => setEditingComment(null)} className="p-1 text-red-600 hover:bg-red-100 rounded-full cursor-pointer"><X size={14} /></button>
                                                    </div>
                                                ) : (
                                                    lead.comment ? (
                                                        // Jeśli komentarz istnieje - zachowaj stare zachowanie
                                                        <>
                                                            <p className="italic text-gray-500 line-clamp-2">{lead.comment}</p>
                                                            <button onClick={() => setEditingComment({ id: lead.id, text: lead.comment || '' })} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-500 hover:bg-gray-200 rounded-full flex-shrink-0 cursor-pointer"><Edit size={14} /></button>
                                                        </>
                                                    ) : (
                                                        // Jeśli komentarz NIE istnieje - pokaż nowy, zawsze widoczny przycisk
                                                        <button
                                                            onClick={() => setEditingComment({ id: lead.id, text: '' })}
                                                            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 py-1 px-2 rounded-md transition-colors w-full justify-start cursor-pointer"
                                                        >
                                                            <MessageSquarePlus size={14} className="flex-shrink-0" />
                                                            <span>{t.addComment}</span>
                                                        </button>
                                                    )
                                                )}
                                            </div>
                                        </td>
                                        <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(lead); }} disabled={deletingId === lead.id} className="p-2 text-red-600 hover:bg-red-100 rounded-full transition-colors disabled:opacity-50 cursor-pointer">
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

            {/* --- Modals and Popups --- */}

            {/* 🆕 Mobile Lead Details Modal with Status Change and Comment Deletion */}
            {/* 🆕 Mobile Lead Details Modal with new styling */}
            {selectedLead && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm sm:hidden animate-fadeIn">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">

                        {/* Header */}
                        <div className="flex items-start justify-between p-6 border-b border-gray-200 bg-gray-50">
                            <div className="flex items-center space-x-4">
                                {isChangingStatus ? (
                                    <button onClick={() => setIsChangingStatus(false)} className="p-1 text-gray-500 hover:text-gray-700 cursor-pointer">
                                        <ArrowLeft size={20} />
                                    </button>
                                ) : (
                                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 border-4 border-white shadow-sm">
                                        <UserCheck className="h-6 w-6 text-blue-600" />
                                    </div>
                                )}
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900">
                                        {isChangingStatus ? t.changeStatus : selectedLead.name}
                                    </h3>
                                    <p className="text-sm text-gray-500 break-words line-clamp-3 max-w-[250px]" title={selectedLead.page}>
                                        {isChangingStatus ? t.selectNewStatus : selectedLead.page}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedLead(null)} className="text-gray-500 hover:text-gray-700 transition-colors cursor-pointer">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Content: Switches between details and status change view */}
                        {isChangingStatus ? (
                            <div className="p-4 space-y-2 overflow-y-auto bg-white">
                                {allStatuses.map(statusOption => (
                                    <button
                                        key={statusOption.id}
                                        onClick={() => handleStatusChange(selectedLead.id, statusOption.id)}
                                        disabled={updatingStatusId === selectedLead.id}
                                        className="w-full text-left flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-gray-800 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-all disabled:opacity-50 cursor-pointer"
                                    >
                                        <div className="flex items-center gap-3">
                                            {React.cloneElement(statusOption.icon, { className: getStatusProps(statusOption.id).color.split(' ')[1] })}
                                            <span>{getStatusProps(statusOption.id).text}</span>
                                        </div>
                                        {updatingStatusId === selectedLead.id && <RefreshCw size={16} className="animate-spin text-blue-600" />}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="p-6 space-y-6 overflow-y-auto bg-white">
                                {/* Lead Details */}
                                <div className="space-y-4 text-sm">
                                    <div className="flex items-start">
                                        <Mail size={14} className="text-gray-400 mr-4 mt-0.5 flex-shrink-0" />
                                        <span className="text-gray-800 break-all">{selectedLead.email}</span>
                                    </div>
                                    {selectedLead.phone && (
                                        <div className="flex items-start">
                                            <Phone size={14} className="text-gray-400 mr-4 mt-0.5 flex-shrink-0" />
                                            <span className="text-gray-800">{selectedLead.phone}</span>
                                        </div>
                                    )}
                                    <div className="flex items-start">
                                        <Calendar size={14} className="text-gray-400 mr-4 mt-0.5 flex-shrink-0" />
                                        <span className="text-gray-800">{formatDate(selectedLead.createdAt)}</span>
                                    </div>
                                    {/* Status badge and Delete button */}
                                    <div className="pt-2 flex items-center justify-between">
                                        <button
                                            onClick={() => setIsChangingStatus(true)}
                                            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-full transition-transform hover:scale-105 cursor-pointer ${getStatusProps(selectedLead.status).color}`}
                                        >
                                            {getStatusProps(selectedLead.status).icon}
                                            <span>{getStatusProps(selectedLead.status).text}</span>
                                        </button>

                                        <button
                                            onClick={() => {
                                                setSelectedLead(null); // Zamknij modal
                                                handleDeleteClick(selectedLead); // Wywołaj funkcję usuwania
                                            }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors cursor-pointer"
                                        >
                                            <Trash2 size={14} />
                                            <span>{t.delete}</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="border-t border-gray-200"></div>

                                {/* Comment Section */}
                                <div>
                                    <h4 className="text-base font-semibold text-gray-800 mb-3">{t.comment}</h4>
                                    {editingComment?.id === selectedLead.id ? (
                                        <div className="space-y-2">
                                            <textarea
                                                value={editingComment.text}
                                                onChange={(e) => setEditingComment({ ...editingComment, text: e.target.value })}
                                                onKeyDown={handleCommentKeyDown}
                                                className="w-full p-3 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 placeholder:text-gray-500 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                rows={4}
                                                autoFocus
                                            />
                                            <div className="flex justify-end gap-3">
                                                <button onClick={() => setEditingComment(null)} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors cursor-pointer">{t.cancel}</button>
                                                <button onClick={handleSaveComment} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium cursor-pointer">{t.save}</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="group">
                                            <div className="bg-gray-50 rounded-lg p-4 border min-h-[4rem]">
                                                <p className="text-gray-700 text-sm whitespace-pre-wrap">
                                                    {selectedLead.comment || <span className="text-gray-400 italic">{t.noComment}</span>}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-4 mt-3">
                                                <button
                                                    onClick={() => setEditingComment({ id: selectedLead.id, text: selectedLead.comment || '' })}
                                                    className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                                                >
                                                    <Edit size={14} />
                                                    {selectedLead.comment ? t.edit : t.addComment}
                                                </button>
                                                {selectedLead.comment && (
                                                    <button
                                                        onClick={() => handleDeleteComment(selectedLead.id)}
                                                        className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-800 font-medium cursor-pointer"
                                                    >
                                                        <Trash2 size={14} />
                                                        {t.delete}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Footer */}
                        {!isChangingStatus && (
                            <div className="p-4 bg-gray-50 border-t border-gray-200 mt-auto">
                               <button onClick={() => setSelectedLead(null)} className="w-full px-4 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium cursor-pointer">
                                    {t.close}
                               </button>
                            </div>
                        )}
                    </div>
                </div>
            )}


            {tooltip && (
                <div
                    className="fixed z-50 w-max max-w-xs bg-white/90 backdrop-blur-sm text-gray-800 text-sm rounded-lg p-3 shadow-2xl border border-gray-200 animate-tooltip"
                    style={{
                        top: `${tooltip.top}px`, left: `${tooltip.left}px`,
                        transform: 'translateY(calc(-100% - 8px))',
                        maxWidth: typeof window !== 'undefined' ? `min(320px, ${window.innerWidth - tooltip.left - 24}px)` : '320px',
                        transformOrigin: 'bottom left',
                    }}
                    onMouseEnter={() => tooltipTimeoutRef.current && clearTimeout(tooltipTimeoutRef.current)}
                    onMouseLeave={handleCommentMouseLeave}
                >
                    <p className="whitespace-pre-wrap text-left">{tooltip.content}</p>
                    <div className="absolute top-full left-4 w-3 h-3 bg-inherit border-inherit" style={{ transform: 'translateY(-50%) rotate(45deg)', borderTop: 'none', borderLeft: 'none', clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }}></div>
                </div>
            )}

            {openStatusMenu && (
                <div ref={statusMenuRef} className="fixed z-50 w-40 bg-white rounded-md shadow-lg border border-gray-200 animate-menu-fade-in" style={{ top: `${openStatusMenu.top}px`, left: `${openStatusMenu.left}px` }}>
                    <ul className="py-1">
                        {allStatuses.map(statusOption => (
                            <li key={statusOption.id}>
                                <button onClick={() => handleStatusChange(openStatusMenu.id, statusOption.id)} className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">
                                    {React.cloneElement(statusOption.icon, { className: getStatusProps(statusOption.id).color.split(' ')[1] })}
                                    <span>{getStatusProps(statusOption.id).text}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 cursor-pointer" onClick={() => setShowDeleteConfirm(false)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 cursor-default" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-gray-800">{t.confirmDeletion}</h3>
                        <p className="text-gray-600 my-4">{t.deleteLeadMsg.replace('{leadName}', leadToDelete?.name || '')}</p>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50 cursor-pointer">{t.cancel}</button>
                            <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer">{t.yesDelete}</button>
                        </div>
                    </div>
                </div>
            )}
            <style jsx>{`
                .animate-menu-fade-in { animation: menu-fade-in 0.15s ease-in-out; }
                @keyframes menu-fade-in {
                    from { opacity: 0; transform: scale(0.98) translateY(-5px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .animate-tooltip { animation: tooltip-fade-in 0.15s ease-out; }
                @keyframes tooltip-fade-in {
                    from { opacity: 0; transform: scale(0.95) translateY(calc(-100% - 0px)); }
                    to { opacity: 1; transform: scale(1) translateY(calc(-100% - 8px)); }
                }
                .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.97); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
};

export default LeadsContent;