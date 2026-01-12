'use client';

import { useState, useEffect, useRef } from 'react';
import { TransactionWithRelations } from '@/lib/hooks/useTransactions';

interface Account {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  group_name: string;
}

interface TransactionEditModalProps {
  isOpen: boolean;
  transaction: TransactionWithRelations | null; // null = creating new
  onSave: (data: TransactionFormData) => Promise<void>;
  onClose: () => void;
}

export interface TransactionFormData {
  id?: string;
  date: string;
  description: string;
  amount: number;
  account_id: string;
  category_id: string | null;
}

export function TransactionEditModal({
  isOpen,
  transaction,
  onSave,
  onClose,
}: TransactionEditModalProps) {
  const [formData, setFormData] = useState<TransactionFormData>({
    date: '',
    description: '',
    amount: 0,
    account_id: '',
    category_id: null,
  });
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const categoryInputRef = useRef<HTMLInputElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  const isEditing = transaction !== null;

  // Load accounts and categories
  useEffect(() => {
    if (!isOpen) return;

    async function loadData() {
      try {
        const [accountsRes, categoriesRes] = await Promise.all([
          fetch('/api/accounts'),
          fetch('/api/categories'),
        ]);

        if (accountsRes.ok) {
          const data = await accountsRes.json();
          setAccounts(data.accounts || []);
        }

        if (categoriesRes.ok) {
          const data = await categoriesRes.json();
          setCategories(data);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      }
    }

    loadData();
  }, [isOpen]);

  // Initialize form when transaction changes
  useEffect(() => {
    if (isOpen) {
      if (transaction) {
        setFormData({
          id: transaction.id,
          date: transaction.date,
          description: transaction.description,
          amount: transaction.amount,
          account_id: transaction.account_id,
          category_id: transaction.category_id,
        });
        setCategorySearch(transaction.category?.name || '');
      } else {
        // New transaction defaults
        const today = new Date().toISOString().split('T')[0];
        setFormData({
          date: today,
          description: '',
          amount: 0,
          account_id: accounts[0]?.id || '',
          category_id: null,
        });
        setCategorySearch('');
      }
      setError(null);
    }
  }, [isOpen, transaction, accounts]);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Close category dropdown when clicking outside
  useEffect(() => {
    if (!showCategoryDropdown) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(e.target as Node) &&
        categoryInputRef.current &&
        !categoryInputRef.current.contains(e.target as Node)
      ) {
        setShowCategoryDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCategoryDropdown]);

  if (!isOpen) return null;

  // Filter and group categories
  const filteredCategories = categorySearch
    ? categories.filter(
        (cat) =>
          cat.name.toLowerCase().includes(categorySearch.toLowerCase()) ||
          cat.group_name.toLowerCase().includes(categorySearch.toLowerCase())
      )
    : categories;

  const groupedCategories = filteredCategories.reduce(
    (acc, cat) => {
      if (!acc[cat.group_name]) {
        acc[cat.group_name] = [];
      }
      acc[cat.group_name].push(cat);
      return acc;
    },
    {} as Record<string, Category[]>
  );

  const handleCategorySelect = (category: Category) => {
    setFormData((prev) => ({ ...prev, category_id: category.id }));
    setCategorySearch(category.name);
    setShowCategoryDropdown(false);
  };

  const handleClearCategory = () => {
    setFormData((prev) => ({ ...prev, category_id: null }));
    setCategorySearch('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save transaction');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 focus:outline-none"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 id="modal-title" className="text-lg font-semibold text-slate-900">
            {isEditing ? 'Edit Transaction' : 'Add Transaction'}
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, date: e.target.value }))
                }
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                required
                placeholder="Enter description"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                  £
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      amount: parseFloat(e.target.value) || 0,
                    }))
                  }
                  required
                  className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Use positive for income, negative for expenses
              </p>
            </div>

            {/* Account */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Account
              </label>
              <select
                value={formData.account_id}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, account_id: e.target.value }))
                }
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Category with search */}
            <div className="relative">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Category
              </label>
              <div className="relative">
                <input
                  ref={categoryInputRef}
                  type="text"
                  value={categorySearch}
                  onChange={(e) => {
                    setCategorySearch(e.target.value);
                    setShowCategoryDropdown(true);
                    if (e.target.value === '') {
                      setFormData((prev) => ({ ...prev, category_id: null }));
                    }
                  }}
                  onFocus={() => setShowCategoryDropdown(true)}
                  placeholder="Search categories..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {formData.category_id && (
                  <button
                    type="button"
                    onClick={handleClearCategory}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Category dropdown */}
              {showCategoryDropdown && (
                <div
                  ref={categoryDropdownRef}
                  className="absolute left-0 right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 z-10 max-h-60 overflow-y-auto"
                >
                  {Object.entries(groupedCategories).length === 0 ? (
                    <div className="px-3 py-2 text-sm text-slate-400">
                      No categories found
                    </div>
                  ) : (
                    Object.entries(groupedCategories).map(([group, cats]) => (
                      <div key={group}>
                        <div className="px-3 py-1.5 text-xs text-slate-500 bg-slate-50 sticky top-0 font-medium">
                          {group}
                        </div>
                        {cats.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => handleCategorySelect(cat)}
                            className={`w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${
                              formData.category_id === cat.id ? 'bg-blue-50 text-blue-700' : ''
                            }`}
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
            >
              {isLoading ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
