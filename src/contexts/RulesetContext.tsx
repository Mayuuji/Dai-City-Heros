import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useCampaign } from './CampaignContext';
import type {
  Ruleset,
  RulesetStat,
  RulesetSkill,
  RulesetModifier,
  RulesetClass,
  RulesetLevelReward
} from '../types/ruleset';

// ============================================================
// Context Types
// ============================================================

interface RulesetContextType {
  ruleset: Ruleset | null;
  stats: RulesetStat[];
  skills: RulesetSkill[];
  modifiers: RulesetModifier[];
  classes: RulesetClass[];
  levelRewards: RulesetLevelReward[];
  loading: boolean;
  error: string | null;

  // Helper functions
  getStatName: (key: string) => string;
  getStatAbbrev: (key: string) => string;
  getSkillName: (key: string) => string;
  getModifierName: (key: string) => string;
  getClassName: (key: string) => string;
  getClassById: (id: string) => RulesetClass | undefined;

  // Character stat/skill readers (handles core + custom)
  getCharacterStat: (character: any, statKey: string) => number;
  getCharacterSkill: (character: any, skillKey: string) => number;

  // Refresh
  refreshRuleset: () => Promise<void>;
}

const RulesetContext = createContext<RulesetContextType>({
  ruleset: null,
  stats: [],
  skills: [],
  modifiers: [],
  classes: [],
  levelRewards: [],
  loading: true,
  error: null,
  getStatName: () => '',
  getStatAbbrev: () => '',
  getSkillName: () => '',
  getModifierName: () => '',
  getClassName: () => '',
  getClassById: () => undefined,
  getCharacterStat: () => 0,
  getCharacterSkill: () => 0,
  refreshRuleset: async () => {},
});

export function useRuleset() {
  return useContext(RulesetContext);
}

// Core stat keys that have dedicated DB columns
const CORE_STAT_KEYS = ['str', 'dex', 'con', 'wis', 'int', 'cha'];

// Core skill keys that have dedicated DB columns (skill_<key>)
const CORE_SKILL_KEYS = [
  'acrobatics', 'animal_handling', 'athletics', 'biology',
  'deception', 'hacking', 'history', 'insight', 'intimidation',
  'investigation', 'medicine', 'nature', 'perception',
  'performance', 'persuasion', 'sleight_of_hand', 'stealth', 'survival'
];

export function RulesetProvider({ children }: { children: ReactNode }) {
  const { campaignId } = useCampaign();

  const [ruleset, setRuleset] = useState<Ruleset | null>(null);
  const [stats, setStats] = useState<RulesetStat[]>([]);
  const [skills, setSkills] = useState<RulesetSkill[]>([]);
  const [modifiers, setModifiers] = useState<RulesetModifier[]>([]);
  const [classes, setClasses] = useState<RulesetClass[]>([]);
  const [levelRewards, setLevelRewards] = useState<RulesetLevelReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRuleset = useCallback(async () => {
    if (!campaignId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get campaign's ruleset_id
      const { data: campaignData } = await supabase
        .from('campaigns')
        .select('ruleset_id')
        .eq('id', campaignId)
        .single();

      const rulesetId = campaignData?.ruleset_id;
      if (!rulesetId) {
        // No ruleset assigned — use defaults (loading stays false, empty arrays)
        setLoading(false);
        return;
      }

      // Load ruleset
      const { data: rulesetData, error: rulesetError } = await supabase
        .from('rulesets')
        .select('*')
        .eq('id', rulesetId)
        .single();
      if (rulesetError) throw rulesetError;
      setRuleset(rulesetData);

      // Load all related data in parallel
      const [statsRes, skillsRes, modsRes, classesRes, rewardsRes] = await Promise.all([
        supabase.from('ruleset_stats').select('*').eq('ruleset_id', rulesetId).order('sort_order'),
        supabase.from('ruleset_skills').select('*').eq('ruleset_id', rulesetId).order('sort_order'),
        supabase.from('ruleset_modifiers').select('*').eq('ruleset_id', rulesetId).order('sort_order'),
        supabase.from('ruleset_classes').select('*, starter_items:ruleset_class_starter_items(*), abilities:ruleset_class_abilities(*), subclasses:ruleset_subclasses(*, abilities:ruleset_subclass_abilities(*))').eq('ruleset_id', rulesetId).order('sort_order'),
        supabase.from('ruleset_level_rewards').select('*').order('level').order('sort_order'),
      ]);

      setStats(statsRes.data || []);
      setSkills(skillsRes.data || []);
      setModifiers(modsRes.data || []);

      // For classes, we need to filter level rewards by the class IDs in this ruleset
      const classData = (classesRes.data || []) as RulesetClass[];
      setClasses(classData);

      const classIds = classData.map(c => c.id);
      const filteredRewards = (rewardsRes.data || []).filter((r: RulesetLevelReward) => classIds.includes(r.class_id));
      setLevelRewards(filteredRewards);

    } catch (err: any) {
      console.error('Error loading ruleset:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    loadRuleset();
  }, [loadRuleset]);

  // Helper functions
  const getStatName = useCallback((key: string): string => {
    const stat = stats.find(s => s.key === key);
    if (stat) return stat.name;
    // Fallback for core stats
    const fallbacks: Record<string, string> = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', wis: 'Wisdom', int: 'Intelligence', cha: 'Charisma' };
    return fallbacks[key] || key;
  }, [stats]);

  const getStatAbbrev = useCallback((key: string): string => {
    const stat = stats.find(s => s.key === key);
    if (stat) return stat.abbreviation;
    return key.toUpperCase().slice(0, 3);
  }, [stats]);

  const getSkillName = useCallback((key: string): string => {
    const skill = skills.find(s => s.key === key);
    if (skill) return skill.name;
    // Fallback: convert key to title case
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }, [skills]);

  const getModifierName = useCallback((key: string): string => {
    const mod = modifiers.find(m => m.key === key);
    return mod ? mod.name : key;
  }, [modifiers]);

  const getClassName = useCallback((key: string): string => {
    const cls = classes.find(c => c.key === key || c.id === key);
    return cls ? cls.name : key;
  }, [classes]);

  const getClassById = useCallback((id: string): RulesetClass | undefined => {
    return classes.find(c => c.id === id);
  }, [classes]);

  const getCharacterStat = useCallback((character: any, statKey: string): number => {
    if (CORE_STAT_KEYS.includes(statKey)) {
      return (character[statKey] as number) || 0;
    }
    return character.custom_stats?.[statKey] ?? 0;
  }, []);

  const getCharacterSkill = useCallback((character: any, skillKey: string): number => {
    if (CORE_SKILL_KEYS.includes(skillKey)) {
      const col = 'skill_' + skillKey;
      return (character[col] as number) || 0;
    }
    return character.custom_skills?.[skillKey] ?? 0;
  }, []);

  return (
    <RulesetContext.Provider value={{
      ruleset, stats, skills, modifiers, classes, levelRewards, loading, error,
      getStatName, getStatAbbrev, getSkillName, getModifierName, getClassName, getClassById,
      getCharacterStat, getCharacterSkill,
      refreshRuleset: loadRuleset,
    }}>
      {children}
    </RulesetContext.Provider>
  );
}

export default RulesetContext;
