'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Template } from './TemplateSelector';

// =============================================================================
// TYPES
// =============================================================================

export interface TemplateManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onTemplateDeleted?: (templateId: string) => void;
  onTemplateUpdated?: (template: Template) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function TemplateManager({
  isOpen,
  onClose,
  onTemplateDeleted,
  onTemplateUpdated,
}: TemplateManagerProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editProvider, setEditProvider] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/import/templates');
      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }
      const data = await response.json();
      setTemplates(data.templates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen, fetchTemplates]);

  // Start editing
  const handleStartEdit = useCallback((template: Template) => {
    setEditingId(template.id);
    setEditName(template.name);
    setEditProvider(template.provider);
    setEditNotes(template.notes || '');
  }, []);

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditName('');
    setEditProvider('');
    setEditNotes('');
  }, []);

  // Save edit
  const handleSaveEdit = useCallback(async () => {
    if (!editingId) return;
    if (!editName.trim() || !editProvider.trim()) {
      return;
    }

    try {
      const response = await fetch(`/api/import/templates/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          provider: editProvider.trim(),
          notes: editNotes.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update template');
      }

      const updatedTemplate = await response.json();

      setTemplates((prev) =>
        prev.map((t) => (t.id === editingId ? updatedTemplate : t))
      );

      onTemplateUpdated?.(updatedTemplate);
      handleCancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update template');
    }
  }, [editingId, editName, editProvider, editNotes, onTemplateUpdated, handleCancelEdit]);

  // Delete template
  const handleDelete = useCallback(async (templateId: string) => {
    setDeletingId(templateId);
    setError(null);

    try {
      const response = await fetch(`/api/import/templates/${templateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete template');
      }

      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      onTemplateDeleted?.(templateId);
      setConfirmDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setDeletingId(null);
    }
  }, [onTemplateDeleted]);

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatLastUsed = (dateStr: string | null): string => {
    if (!dateStr) return 'Never';
    return formatDate(dateStr);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Manage Templates</h2>
            <p className="text-sm text-slate-500">
              Edit or delete your saved import templates.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="w-8 h-8 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-12 h-12 mx-auto text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-slate-600 mb-2">No templates saved yet</p>
              <p className="text-sm text-slate-400">
                Templates will appear here after you save a column mapping.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`border rounded-lg ${
                    editingId === template.id
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-slate-200'
                  }`}
                >
                  {editingId === template.id ? (
                    // Edit Mode
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Template Name</label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Provider</label>
                          <input
                            type="text"
                            value={editProvider}
                            onChange={(e) => setEditProvider(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Notes</label>
                        <textarea
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          disabled={!editName.trim() || !editProvider.trim()}
                          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  ) : confirmDelete === template.id ? (
                    // Delete Confirmation
                    <div className="p-4">
                      <p className="text-sm text-slate-700 mb-3">
                        Delete <span className="font-medium">{template.name}</span>? This action cannot be undone.
                      </p>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setConfirmDelete(null)}
                          disabled={deletingId === template.id}
                          className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDelete(template.id)}
                          disabled={deletingId === template.id}
                          className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-300 flex items-center gap-2"
                        >
                          {deletingId === template.id ? (
                            <>
                              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Deleting...
                            </>
                          ) : (
                            'Delete'
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="p-4 flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-slate-900">{template.name}</p>
                          {template.use_count > 0 && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
                              {template.use_count} uses
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500">{template.provider}</p>
                        {template.notes && (
                          <p className="text-sm text-slate-400 mt-1 line-clamp-2">{template.notes}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                          <span>Created: {formatDate(template.created_at)}</span>
                          <span>Last used: {formatLastUsed(template.last_used_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-4">
                        <button
                          onClick={() => handleStartEdit(template)}
                          className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                          title="Edit template"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setConfirmDelete(template.id)}
                          className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                          title="Delete template"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
