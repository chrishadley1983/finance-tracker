'use client';

import { useState, useCallback, useMemo } from 'react';
import type { ImportFormat } from '@/lib/types/import';

// =============================================================================
// TYPES
// =============================================================================

export interface Template extends ImportFormat {
  last_used_at: string | null;
  use_count: number;
  sample_headers: string[] | null;
}

export interface TemplateSelectorProps {
  templates: Template[];
  currentHeaders: string[];
  selectedTemplateId: string | null;
  onSelect: (template: Template) => void;
  onManage: () => void;
  isLoading?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function TemplateSelector({
  templates,
  currentHeaders,
  selectedTemplateId,
  onSelect,
  onManage,
  isLoading = false,
}: TemplateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Calculate compatibility scores for templates
  const templatesWithScores = useMemo(() => {
    return templates.map((template) => {
      let matchScore = 0;
      let totalFields = 0;

      // Check if sample_headers match current headers
      if (template.sample_headers && template.sample_headers.length > 0) {
        const headerSet = new Set(currentHeaders.map(h => h.toLowerCase()));
        const matchingHeaders = template.sample_headers.filter(h =>
          headerSet.has(h.toLowerCase())
        );
        matchScore = matchingHeaders.length / template.sample_headers.length;
        totalFields = template.sample_headers.length;
      } else {
        // Check column mapping fields against current headers
        const mappingFields = Object.values(template.column_mapping || {}).filter(Boolean);
        const headerSet = new Set(currentHeaders.map(h => h.toLowerCase()));
        const matchingFields = mappingFields.filter(field =>
          typeof field === 'string' && headerSet.has(field.toLowerCase())
        );
        matchScore = mappingFields.length > 0 ? matchingFields.length / mappingFields.length : 0;
        totalFields = mappingFields.length;
      }

      return {
        ...template,
        matchScore,
        totalFields,
        isCompatible: matchScore >= 0.5,
      };
    });
  }, [templates, currentHeaders]);

  // Filter and sort templates
  const filteredTemplates = useMemo(() => {
    let filtered = templatesWithScores;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(search) ||
        t.provider.toLowerCase().includes(search)
      );
    }

    // Sort by: compatible first, then by match score, then by last used
    return filtered.sort((a, b) => {
      // Compatible templates first
      if (a.isCompatible !== b.isCompatible) {
        return a.isCompatible ? -1 : 1;
      }
      // Then by match score (higher first)
      if (a.matchScore !== b.matchScore) {
        return b.matchScore - a.matchScore;
      }
      // Then by last used (most recent first)
      if (a.last_used_at && b.last_used_at) {
        return new Date(b.last_used_at).getTime() - new Date(a.last_used_at).getTime();
      }
      if (a.last_used_at) return -1;
      if (b.last_used_at) return 1;
      return 0;
    });
  }, [templatesWithScores, searchTerm]);

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  const handleSelect = useCallback((template: Template) => {
    onSelect(template);
    setIsOpen(false);
    setSearchTerm('');
  }, [onSelect]);

  const formatLastUsed = (dateStr: string | null): string => {
    if (!dateStr) return 'Never used';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Used today';
    if (diffDays === 1) return 'Used yesterday';
    if (diffDays < 7) return `Used ${diffDays} days ago`;
    if (diffDays < 30) return `Used ${Math.floor(diffDays / 7)} weeks ago`;
    return `Used ${Math.floor(diffDays / 30)} months ago`;
  };

  return (
    <div className="relative">
      {/* Selected Template Display / Dropdown Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="w-full px-4 py-3 border border-slate-300 rounded-lg text-left bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              {selectedTemplate ? (
                <>
                  <p className="font-medium text-slate-900">{selectedTemplate.name}</p>
                  <p className="text-sm text-slate-500">{selectedTemplate.provider}</p>
                </>
              ) : (
                <>
                  <p className="font-medium text-slate-900">Select a template</p>
                  <p className="text-sm text-slate-500">
                    {templates.length === 0
                      ? 'No saved templates'
                      : `${templates.length} template${templates.length !== 1 ? 's' : ''} available`}
                  </p>
                </>
              )}
            </div>
          </div>
          <svg
            className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search templates..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
          </div>

          {/* Template List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredTemplates.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-sm">
                {searchTerm ? 'No templates match your search' : 'No templates saved yet'}
              </div>
            ) : (
              <div className="p-2">
                {filteredTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleSelect(template)}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      template.id === selectedTemplateId
                        ? 'bg-blue-50 border border-blue-200'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900 truncate">{template.name}</p>
                          {template.isCompatible && (
                            <span className="flex-shrink-0 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                              Compatible
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500">{template.provider}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {formatLastUsed(template.last_used_at)}
                          {template.use_count > 0 && ` • ${template.use_count} imports`}
                        </p>
                      </div>
                      {template.matchScore > 0 && (
                        <div className="flex-shrink-0 text-right">
                          <div
                            className={`text-xs font-medium ${
                              template.matchScore >= 0.8
                                ? 'text-green-600'
                                : template.matchScore >= 0.5
                                ? 'text-amber-600'
                                : 'text-slate-400'
                            }`}
                          >
                            {Math.round(template.matchScore * 100)}% match
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-slate-100 bg-slate-50">
            <button
              onClick={() => {
                setIsOpen(false);
                onManage();
              }}
              className="w-full py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Manage Templates
            </button>
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setIsOpen(false);
            setSearchTerm('');
          }}
        />
      )}
    </div>
  );
}
