"use client";

import { useEffect, useRef, useState } from "react";

import { useUpdateViewConfig } from "~/app/_components/useUpdateViewConfig";
import { useDebouncedValue } from "~/hooks/use-debounced-value";

export const SEARCH_DEBOUNCE_MS = 300;

/**
 * The toolbar's search box: the text as typed, the debounced text the rows
 * are queried with, and saving the debounced text to the view's config.
 */
export function useViewSearch(viewId: string, savedSearchOnMount: string) {
  const [searchInput, setSearchInput] = useState(savedSearchOnMount);
  const search = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);

  const saveSearch = useUpdateViewConfig(viewId);
  const savedSearch = useRef(savedSearchOnMount);
  useEffect(() => {
    if (search === savedSearch.current) return;
    savedSearch.current = search;
    saveSearch.update({ search });
  }, [search, saveSearch]);

  return { searchInput, setSearchInput, search };
}
