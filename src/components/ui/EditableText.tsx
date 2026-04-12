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
  editLabel?: string;       // Translated label for hover badge (default: "Edit")
  forceUnsaved?: boolean;   // Force unsaved indicator (for virtual sub-fields of a composite field)
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
      return;
    }

    setEditing(false);

    if (newText === originalValue.current) return;

    if (hasContext) {
      editContext.handleTextChange(fieldName, newText);
    } else if (onSave) {
      onSave(fieldName, newText).catch(console.error);
    } else if (onChange) {
      onChange(fieldName, newText);
    }
  }, [fieldName, hasContext, editContext, onChange, onSave, maxLength]);

  const handleClick = useCallback(() => {
    if (isEditMode && !editing) setEditing(true);
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
    }
  }, [multiline, commitEdit]);

  const handleBlur = useCallback(() => {
    if (editing) commitEdit();
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

  // Hover tint — semi-transparent overlay that works on both light and dark backgrounds
  const hoverStyle: React.CSSProperties = isHovered && !editing
    ? { backgroundColor: 'rgba(96,165,250,0.08)', borderRadius: '4px' }
    : {};

  // ----------------------------------------------------------------
  // EDITING — contentEditable, managed via ref, no React children
  // ----------------------------------------------------------------
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

  // ----------------------------------------------------------------
  // EDIT MODE idle — hoverable, clickable to start editing
  // ----------------------------------------------------------------
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

        {isHovered && (
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
        )}

        {hasUnsavedChanges && (
          <span
            className="absolute -right-1 -top-1 w-2 h-2 bg-amber-500 rounded-full pointer-events-none"
            title="Niezapisane zmiany"
          />
        )}
      </Tag>
    );
  }

  // ----------------------------------------------------------------
  // Normal display — no edit capability
  // ----------------------------------------------------------------
  return (
    <Tag
      className={`${className} ${hasUnsavedChanges ? 'relative' : ''}`}
      style={{ ...style, ...unsavedStyle }}
    >
      {displayValue || <span className="opacity-40 italic">{placeholder}</span>}
      {hasUnsavedChanges && (
        <span
          className="absolute -right-1 -top-1 w-2 h-2 bg-amber-500 rounded-full pointer-events-none"
          title="Niezapisane zmiany"
        />
      )}
    </Tag>
  );
};

export default EditableText;