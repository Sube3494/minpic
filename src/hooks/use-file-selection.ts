import { useState, useCallback } from 'react';

export function useFileSelection() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(ids);
  }, []);
  
  const toggleSelectAll = useCallback((currentFilesIds: string[]) => {
      setSelectedIds(prev => prev.length === currentFilesIds.length ? [] : currentFilesIds);
  }, []);

  return {
    selectedIds,
    toggleSelect,
    clearSelection,
    selectAll,
    toggleSelectAll,
    setSelectedIds
  };
}
