// src/components/ui/EditableText.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useEditMode } from '@/contexts/EditModeContext';

interface EditableTextProps {
  fieldName: string;
  value: string;
  tag?: 'h1' | 'h2' | 'h3' | 'p' | 'div' | 'span';
  isEditMode: boolean;
  onChange?: (fieldName: string, newValue: string) => void;
  onSave?: (fieldName: string, newValue: string) => Promise<void>;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  overrideContext?: boolean;
  /** Tekst hover hinta (niebieski badge w prawym górnym rogu na hover). Default: 'Edit'. */
  editLabel?: string;
  /** Tekst przy niezapisanych zmianach (pomarańczowy badge). Default: 'Edited'. */
  editedLabel?: string;
  /** Wymuszenie wskaźnika niezapisanych zmian (dla virtual sub-fields). */
  forceUnsaved?: boolean;
}

const EditableText: React.FC<EditableTextProps> = ({
  fieldName,
  value,
  tag = 'p',
  isEditMode,
  onChange,
  onSave,
  className = '',
  style = {},
  placeholder = 'Kliknij, aby edytować tekst',
  multiline = false,
  maxLength = 1000,
  overrideContext = false,
  editLabel = 'Edit',
  editedLabel = 'Edited',
  forceUnsaved = false
}) => {
  const [editing, setEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const editableRef = useRef<HTMLElement | null>(null);
  const originalValue = useRef(value);

  const editContext = useEditMode();
  const hasContext = !!editContext && !overrideContext;
  const hasUnsavedChanges = forceUnsaved || (hasContext && editContext.isFieldChanged(fieldName));

  useEffect(() => {
    originalValue.current = value;
  }, [value]);

  const getDisplayValue = useCallback(() => {
    if (hasContext && hasUnsavedChanges) {
      const pendingValue = editContext.pendingChanges[fieldName];
      return pendingValue !== undefined ? pendingValue : value;
    }
    return value;
  }, [hasContext, hasUnsavedChanges, editContext, fieldName, value]);

  const commitEdit = useCallback(() => {
    const el = editableRef.current;
    if (!el) return;

    const newText = el.textContent?.trim() ?? '';

    if (maxLength && newText.length > maxLength) {
      el.textContent = originalValue.current;
      setEditing(false);
      setIsHovered(false);
      return;
    }

    setEditing(false);
    setIsHovered(false);

    // Wracamy do oryginału — jeśli pole było wcześniej zmienione,
    // usuń je z pendingChanges (revert), żeby badge "Edited" zniknął
    // i podgląd pokazał aktualną wartość z bazy zamiast starej zmiany.
    if (newText === originalValue.current) {
      if (hasContext && editContext.isFieldChanged(fieldName)) {
        editContext.revertField(fieldName);
      }
      return;
    }

    if (hasContext) {
      editContext.handleTextChange(fieldName, newText);
    } else if (onSave) {
      onSave(fieldName, newText).catch(console.error);
    } else if (onChange) {
      onChange(fieldName, newText);
    }
  }, [fieldName, hasContext, editContext, onChange, onSave, maxLength]);

  const handleClick = useCallback(() => {
    if (isEditMode && !editing) {
      setEditing(true);
      setIsHovered(false);
    }
  }, [isEditMode, editing]);

  useEffect(() => {
    if (editing && editableRef.current) {
      const el = editableRef.current;
      el.textContent = getDisplayValue();
      el.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(el);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [editing]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (!multiline || e.shiftKey)) {
      e.preventDefault();
      commitEdit();
    }
    if (e.key === 'Escape') {
      if (editableRef.current) editableRef.current.textContent = originalValue.current;
      setEditing(false);
      setIsHovered(false);
    }
  }, [multiline, commitEdit]);

  const handleBlur = useCallback(() => {
    if (editing) commitEdit();
    setIsHovered(false);
  }, [editing, commitEdit]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  const Tag = tag as keyof React.JSX.IntrinsicElements;
  const displayValue = getDisplayValue();

  const unsavedStyle: React.CSSProperties = hasUnsavedChanges
    ? { borderLeft: '3px solid #f59e0b', paddingLeft: '0.5rem' }
    : {};

  const editingOutline: React.CSSProperties = {
    outline: '2px solid rgba(96,165,250,0.5)',
    outlineOffset: '2px',
    borderRadius: '4px',
  };

  const hoverStyle: React.CSSProperties = isHovered && !editing
    ? { backgroundColor: 'rgba(96,165,250,0.08)', borderRadius: '4px' }
    : {};

  // Badge "Edited" — pokazywany tylko przy niezapisanych zmianach
  const editedBadge = hasUnsavedChanges ? (
    <span
      className="absolute right-0 top-0 px-1.5 py-0.5 rounded pointer-events-none flex items-center gap-1 text-white"
      style={{
        fontSize: '0.6rem',
        fontWeight: 600,
        backgroundColor: '#f59e0b',
        lineHeight: 1.2,
        transform: 'translate(0, -50%)',
      }}
      title="Niezapisane zmiany"
    >
      <span
        className="rounded-full"
        style={{ width: '0.35rem', height: '0.35rem', backgroundColor: '#fff' }}
      />
      {editedLabel}
    </span>
  ) : null;

  // Badge "Edit" — hover hint przed kliknięciem (priorytet ma "Edited")
  const hoverBadge = isHovered && !editing && !hasUnsavedChanges ? (
    <span
      className="absolute right-0 top-0 text-white px-1.5 py-0.5 rounded pointer-events-none"
      style={{
        fontSize: '0.6rem',
        fontWeight: 600,
        backgroundColor: 'rgba(59,130,246,0.85)',
        lineHeight: 1.2,
      }}
    >
      {editLabel}
    </span>
  ) : null;

  // ─── EDITING — contentEditable, managed via ref ────────────────────────
  if (isEditMode && editing) {
    return (
      <Tag
        key={`${fieldName}-editing`}
        ref={editableRef as any}
        className={className}
        style={{ ...style, ...unsavedStyle, ...editingOutline }}
        contentEditable
        suppressContentEditableWarning
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onPaste={handlePaste}
      />
    );
  }

  // ─── EDIT MODE idle — hoverable, clickable to start editing ────────────
  if (isEditMode) {
    return (
      <Tag
        key={`${fieldName}-display`}
        className={`${className} relative cursor-pointer transition-colors`}
        style={{ ...style, ...unsavedStyle, ...hoverStyle }}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {displayValue || <span className="opacity-40 italic">{placeholder}</span>}
        {hoverBadge}
        {editedBadge}
      </Tag>
    );
  }

  // ─── Normal display — no edit capability ───────────────────────────────
  return (
    <Tag
      className={`${className} ${hasUnsavedChanges ? 'relative' : ''}`}
      style={{ ...style, ...unsavedStyle }}
    >
      {displayValue || <span className="opacity-40 italic">{placeholder}</span>}
      {editedBadge}
    </Tag>
  );
};

export default EditableText;