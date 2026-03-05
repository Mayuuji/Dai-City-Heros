import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { CHARACTER_CLASSES } from '../data/characterClasses';

export interface ClassAlias {
  display_name: string;
  description: string;
}

/**
 * Hook to fetch and use campaign-specific class display names.
 * Falls back to the default class name if no alias is set.
 */
export function useClassAliases(campaignId: string | null) {
  const [aliases, setAliases] = useState<Record<string, ClassAlias>>({});
  const [loading, setLoading] = useState(true);

  const fetchAliases = useCallback(async () => {
    if (!campaignId) {
      setAliases({});
      setLoading(false);
      return;
    }

    try {
      const { data } = await supabase
        .from('game_settings')
        .select('value')
        .eq('campaign_id', campaignId)
        .eq('key', 'class_aliases')
        .single();

      if (data?.value) {
        setAliases(data.value);
      }
    } catch {
      // No aliases set — that's fine
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchAliases();
  }, [fetchAliases]);

  /**
   * Get the display name for a class. 
   * Accepts class id (e.g. 'bruiser') or class name (e.g. 'BRUISER').
   */
  const getClassName = useCallback((classIdOrName: string): string => {
    // Try by ID first
    const alias = aliases[classIdOrName.toLowerCase()];
    if (alias?.display_name) return alias.display_name;

    // Try matching by class name
    const cls = CHARACTER_CLASSES.find(
      c => c.name.toLowerCase() === classIdOrName.toLowerCase() || c.id === classIdOrName.toLowerCase()
    );
    if (cls) {
      const aliasById = aliases[cls.id];
      if (aliasById?.display_name) return aliasById.display_name;
      return cls.name;
    }

    return classIdOrName;
  }, [aliases]);

  /**
   * Get the custom description for a class, or the default description.
   */
  const getClassDescription = useCallback((classIdOrName: string): string => {
    const cls = CHARACTER_CLASSES.find(
      c => c.name.toLowerCase() === classIdOrName.toLowerCase() || c.id === classIdOrName.toLowerCase()
    );
    const id = cls?.id || classIdOrName.toLowerCase();
    const alias = aliases[id];
    if (alias?.description) return alias.description;
    return cls?.description || '';
  }, [aliases]);

  return { aliases, loading, getClassName, getClassDescription, refetch: fetchAliases };
}
