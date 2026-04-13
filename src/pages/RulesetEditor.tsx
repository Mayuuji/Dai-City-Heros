import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCampaign } from '../contexts/CampaignContext';
import { useRuleset } from '../contexts/RulesetContext';
import { supabase } from '../lib/supabase';
import type {
  RulesetStat,
  RulesetSkill,
  RulesetModifier,
  RulesetClass,
  RulesetClassAbility,
  RulesetClassStarterItem,
  RulesetSubclass,
  RulesetSubclassAbility,
  RulesetLevelReward
} from '../types/ruleset';

type EditorTab = 'stats' | 'skills' | 'classes' | 'subclasses' | 'levels' | 'modifiers';

export default function RulesetEditor() {
  const { profile } = useAuth();
  const { campaignId } = useCampaign();
  const { ruleset, stats, skills, modifiers, classes, levelRewards, refreshRuleset, loading: rulesetLoading } = useRuleset();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<EditorTab>('stats');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // ============ Local edit states ============
  const [editStats, setEditStats] = useState<RulesetStat[]>([]);
  const [editSkills, setEditSkills] = useState<RulesetSkill[]>([]);
  const [editModifiers, setEditModifiers] = useState<RulesetModifier[]>([]);
  const [editClasses, setEditClasses] = useState<RulesetClass[]>([]);
  const [editLevelRewards, setEditLevelRewards] = useState<RulesetLevelReward[]>([]);
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [expandedSubclass, setExpandedSubclass] = useState<string | null>(null);

  // Sync from context
  useEffect(() => { setEditStats([...stats]); }, [stats]);
  useEffect(() => { setEditSkills([...skills]); }, [skills]);
  useEffect(() => { setEditModifiers([...modifiers]); }, [modifiers]);
  useEffect(() => { setEditClasses(classes.map(c => ({ ...c }))); }, [classes]);
  useEffect(() => { setEditLevelRewards([...levelRewards]); }, [levelRewards]);

  // ============ CREATE RULESET IF NONE ============
  const createRuleset = async () => {
    if (!campaignId || !profile?.id) return;
    setSaving(true);
    try {
      const { data: newRuleset, error: createError } = await supabase
        .from('rulesets')
        .insert({ name: 'Custom Ruleset', description: 'Campaign ruleset', owner_id: profile.id })
        .select()
        .single();
      if (createError) throw createError;

      // Link to campaign
      const { error: linkError } = await supabase
        .from('campaigns')
        .update({ ruleset_id: newRuleset.id })
        .eq('id', campaignId);
      if (linkError) throw linkError;

      // Seed default 6 stats
      const defaultStats = [
        { key: 'str', name: 'Strength', abbreviation: 'STR', sort_order: 1 },
        { key: 'dex', name: 'Dexterity', abbreviation: 'DEX', sort_order: 2 },
        { key: 'con', name: 'Constitution', abbreviation: 'CON', sort_order: 3 },
        { key: 'wis', name: 'Wisdom', abbreviation: 'WIS', sort_order: 4 },
        { key: 'int', name: 'Intelligence', abbreviation: 'INT', sort_order: 5 },
        { key: 'cha', name: 'Charisma', abbreviation: 'CHA', sort_order: 6 },
      ];
      await supabase.from('ruleset_stats').insert(defaultStats.map(s => ({ ...s, ruleset_id: newRuleset.id })));

      setMessage('Ruleset created! Reload to start editing.');
      await refreshRuleset();
    } catch (err: any) {
      setMessage('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ============ CLONE TEMPLATE ============
  const cloneTemplate = async () => {
    if (!campaignId || !profile?.id) return;
    setSaving(true);
    try {
      // Find the default template
      const { data: templates } = await supabase
        .from('rulesets')
        .select('id')
        .eq('is_template', true)
        .limit(1);

      if (!templates || templates.length === 0) {
        setMessage('No template found. Run seed-default-ruleset.sql first.');
        setSaving(false);
        return;
      }
      const templateId = templates[0].id;

      // Create new ruleset
      const { data: newRuleset, error: createError } = await supabase
        .from('rulesets')
        .insert({ name: 'Campaign Ruleset', description: 'Cloned from Cyberpunk (Default)', owner_id: profile.id })
        .select()
        .single();
      if (createError) throw createError;

      // Clone stats
      const { data: tStats } = await supabase.from('ruleset_stats').select('*').eq('ruleset_id', templateId);
      if (tStats?.length) {
        await supabase.from('ruleset_stats').insert(tStats.map(s => ({ ...s, id: undefined, ruleset_id: newRuleset.id })));
      }

      // Clone skills
      const { data: tSkills } = await supabase.from('ruleset_skills').select('*').eq('ruleset_id', templateId);
      if (tSkills?.length) {
        await supabase.from('ruleset_skills').insert(tSkills.map(s => ({ ...s, id: undefined, ruleset_id: newRuleset.id })));
      }

      // Clone modifiers
      const { data: tMods } = await supabase.from('ruleset_modifiers').select('*').eq('ruleset_id', templateId);
      if (tMods?.length) {
        await supabase.from('ruleset_modifiers').insert(tMods.map(m => ({ ...m, id: undefined, ruleset_id: newRuleset.id })));
      }

      // Clone classes + their abilities/starter items
      const { data: tClasses } = await supabase.from('ruleset_classes').select('*').eq('ruleset_id', templateId);
      if (tClasses?.length) {
        for (const cls of tClasses) {
          const oldClassId = cls.id;
          const { data: newClass } = await supabase.from('ruleset_classes')
            .insert({ ...cls, id: undefined, ruleset_id: newRuleset.id })
            .select().single();
          if (!newClass) continue;

          // Clone class abilities
          const { data: tAbils } = await supabase.from('ruleset_class_abilities').select('*').eq('class_id', oldClassId);
          if (tAbils?.length) {
            await supabase.from('ruleset_class_abilities').insert(tAbils.map(a => ({ ...a, id: undefined, class_id: newClass.id })));
          }

          // Clone starter items
          const { data: tItems } = await supabase.from('ruleset_class_starter_items').select('*').eq('class_id', oldClassId);
          if (tItems?.length) {
            await supabase.from('ruleset_class_starter_items').insert(tItems.map(i => ({ ...i, id: undefined, class_id: newClass.id })));
          }

          // Clone subclasses
          const { data: tSubs } = await supabase.from('ruleset_subclasses').select('*').eq('class_id', oldClassId);
          if (tSubs?.length) {
            for (const sub of tSubs) {
              const oldSubId = sub.id;
              const { data: newSub } = await supabase.from('ruleset_subclasses')
                .insert({ ...sub, id: undefined, class_id: newClass.id })
                .select().single();
              if (!newSub) continue;
              const { data: tSubAbils } = await supabase.from('ruleset_subclass_abilities').select('*').eq('subclass_id', oldSubId);
              if (tSubAbils?.length) {
                await supabase.from('ruleset_subclass_abilities').insert(tSubAbils.map(a => ({ ...a, id: undefined, subclass_id: newSub.id })));
              }
            }
          }

          // Clone level rewards
          const { data: tRewards } = await supabase.from('ruleset_level_rewards').select('*').eq('class_id', oldClassId);
          if (tRewards?.length) {
            await supabase.from('ruleset_level_rewards').insert(tRewards.map(r => ({ ...r, id: undefined, class_id: newClass.id })));
          }
        }
      }

      // Link to campaign
      await supabase.from('campaigns').update({ ruleset_id: newRuleset.id }).eq('id', campaignId);
      setMessage('Template cloned! Refreshing...');
      await refreshRuleset();
    } catch (err: any) {
      setMessage('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ============ SAVE FUNCTIONS ============

  const saveStats = async () => {
    if (!ruleset) return;
    setSaving(true);
    try {
      // Delete removed, upsert existing
      const existingIds = editStats.filter(s => !s.id.startsWith('new_')).map(s => s.id);
      // Delete stats not in edit list
      if (stats.length > 0) {
        const toDelete = stats.filter(s => !existingIds.includes(s.id));
        for (const d of toDelete) {
          await supabase.from('ruleset_stats').delete().eq('id', d.id);
        }
      }
      // Upsert
      for (let i = 0; i < editStats.length; i++) {
        const s = editStats[i];
        if (s.id.startsWith('new_')) {
          await supabase.from('ruleset_stats').insert({
            ruleset_id: ruleset.id, key: s.key, name: s.name, abbreviation: s.abbreviation, sort_order: i
          });
        } else {
          await supabase.from('ruleset_stats').update({
            key: s.key, name: s.name, abbreviation: s.abbreviation, sort_order: i
          }).eq('id', s.id);
        }
      }
      setMessage('Stats saved!');
      await refreshRuleset();
    } catch (err: any) {
      setMessage('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveSkills = async () => {
    if (!ruleset) return;
    setSaving(true);
    try {
      const existingIds = editSkills.filter(s => !s.id.startsWith('new_')).map(s => s.id);
      const toDelete = skills.filter(s => !existingIds.includes(s.id));
      for (const d of toDelete) {
        await supabase.from('ruleset_skills').delete().eq('id', d.id);
      }
      for (let i = 0; i < editSkills.length; i++) {
        const s = editSkills[i];
        if (s.id.startsWith('new_')) {
          await supabase.from('ruleset_skills').insert({
            ruleset_id: ruleset.id, key: s.key, name: s.name, linked_stat_key: s.linked_stat_key, sort_order: i
          });
        } else {
          await supabase.from('ruleset_skills').update({
            key: s.key, name: s.name, linked_stat_key: s.linked_stat_key, sort_order: i
          }).eq('id', s.id);
        }
      }
      setMessage('Skills saved!');
      await refreshRuleset();
    } catch (err: any) {
      setMessage('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveModifiers = async () => {
    if (!ruleset) return;
    setSaving(true);
    try {
      const existingIds = editModifiers.filter(m => !m.id.startsWith('new_')).map(m => m.id);
      const toDelete = modifiers.filter(m => !existingIds.includes(m.id));
      for (const d of toDelete) {
        await supabase.from('ruleset_modifiers').delete().eq('id', d.id);
      }
      for (let i = 0; i < editModifiers.length; i++) {
        const m = editModifiers[i];
        if (m.id.startsWith('new_')) {
          await supabase.from('ruleset_modifiers').insert({
            ruleset_id: ruleset.id, key: m.key, name: m.name, min_value: m.min_value, max_value: m.max_value, default_value: m.default_value, sort_order: i
          });
        } else {
          await supabase.from('ruleset_modifiers').update({
            key: m.key, name: m.name, min_value: m.min_value, max_value: m.max_value, default_value: m.default_value, sort_order: i
          }).eq('id', m.id);
        }
      }
      setMessage('Modifiers saved!');
      await refreshRuleset();
    } catch (err: any) {
      setMessage('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveClass = async (cls: RulesetClass) => {
    if (!ruleset) return;
    setSaving(true);
    try {
      if (cls.id.startsWith('new_')) {
        const { data: newClass, error: insertError } = await supabase.from('ruleset_classes').insert({
          ruleset_id: ruleset.id, key: cls.key, name: cls.name, description: cls.description,
          hp: cls.hp, ac: cls.ac, cdd: cls.cdd, speed: cls.speed,
          initiative_modifier: cls.initiative_modifier, implant_capacity: cls.implant_capacity,
          stat_bonuses: cls.stat_bonuses, skill_bonuses: cls.skill_bonuses,
          save_proficiencies: cls.save_proficiencies, weapon_proficiencies: cls.weapon_proficiencies,
          armor_proficiencies: cls.armor_proficiencies, tools: cls.tools, sort_order: cls.sort_order
        }).select().single();
        if (insertError) throw insertError;

        // Save abilities
        if (cls.abilities?.length) {
          for (const a of cls.abilities) {
            await supabase.from('ruleset_class_abilities').insert({
              class_id: newClass!.id, ability_name: a.ability_name, ability_description: a.ability_description,
              ability_type: a.ability_type, charge_type: a.charge_type, max_charges: a.max_charges,
              granted_at_level: a.granted_at_level, sort_order: a.sort_order
            });
          }
        }

        // Save starter items
        if (cls.starter_items?.length) {
          for (const item of cls.starter_items) {
            await supabase.from('ruleset_class_starter_items').insert({
              class_id: newClass!.id, item_name: item.item_name, item_type: item.item_type,
              item_description: item.item_description, sort_order: item.sort_order
            });
          }
        }
      } else {
        const { error: updateError } = await supabase.from('ruleset_classes').update({
          key: cls.key, name: cls.name, description: cls.description,
          hp: cls.hp, ac: cls.ac, cdd: cls.cdd, speed: cls.speed,
          initiative_modifier: cls.initiative_modifier, implant_capacity: cls.implant_capacity,
          stat_bonuses: cls.stat_bonuses, skill_bonuses: cls.skill_bonuses,
          save_proficiencies: cls.save_proficiencies, weapon_proficiencies: cls.weapon_proficiencies,
          armor_proficiencies: cls.armor_proficiencies, tools: cls.tools, sort_order: cls.sort_order
        }).eq('id', cls.id);
        if (updateError) throw updateError;

        // Re-save abilities (delete and re-insert)
        await supabase.from('ruleset_class_abilities').delete().eq('class_id', cls.id);
        if (cls.abilities?.length) {
          for (const a of cls.abilities) {
            await supabase.from('ruleset_class_abilities').insert({
              class_id: cls.id, ability_name: a.ability_name, ability_description: a.ability_description,
              ability_type: a.ability_type, charge_type: a.charge_type, max_charges: a.max_charges,
              granted_at_level: a.granted_at_level, sort_order: a.sort_order
            });
          }
        }

        // Re-save starter items
        await supabase.from('ruleset_class_starter_items').delete().eq('class_id', cls.id);
        if (cls.starter_items?.length) {
          for (const item of cls.starter_items) {
            await supabase.from('ruleset_class_starter_items').insert({
              class_id: cls.id, item_name: item.item_name, item_type: item.item_type,
              item_description: item.item_description, sort_order: item.sort_order
            });
          }
        }
      }

      setMessage(`Class "${cls.name}" saved!`);
      await refreshRuleset();
    } catch (err: any) {
      setMessage('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteClass = async (classId: string) => {
    if (classId.startsWith('new_')) {
      setEditClasses(prev => prev.filter(c => c.id !== classId));
      return;
    }
    if (!confirm('Delete this class? This cannot be undone.')) return;
    setSaving(true);
    try {
      await supabase.from('ruleset_classes').delete().eq('id', classId);
      setMessage('Class deleted.');
      await refreshRuleset();
    } catch (err: any) {
      setMessage('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveSubclass = async (sub: RulesetSubclass) => {
    setSaving(true);
    try {
      if (sub.id.startsWith('new_')) {
        const { data: newSub, error: insertError } = await supabase.from('ruleset_subclasses').insert({
          class_id: sub.class_id, key: sub.key, name: sub.name, description: sub.description,
          unlock_level: sub.unlock_level, stat_bonuses: sub.stat_bonuses,
          skill_bonuses: sub.skill_bonuses, sort_order: sub.sort_order
        }).select().single();
        if (insertError) throw insertError;

        if (sub.abilities?.length) {
          for (const a of sub.abilities) {
            await supabase.from('ruleset_subclass_abilities').insert({
              subclass_id: newSub!.id, ability_name: a.ability_name, ability_description: a.ability_description,
              ability_type: a.ability_type, charge_type: a.charge_type, max_charges: a.max_charges,
              granted_at_level: a.granted_at_level, sort_order: a.sort_order
            });
          }
        }
      } else {
        await supabase.from('ruleset_subclasses').update({
          key: sub.key, name: sub.name, description: sub.description,
          unlock_level: sub.unlock_level, stat_bonuses: sub.stat_bonuses,
          skill_bonuses: sub.skill_bonuses, sort_order: sub.sort_order
        }).eq('id', sub.id);

        await supabase.from('ruleset_subclass_abilities').delete().eq('subclass_id', sub.id);
        if (sub.abilities?.length) {
          for (const a of sub.abilities) {
            await supabase.from('ruleset_subclass_abilities').insert({
              subclass_id: sub.id, ability_name: a.ability_name, ability_description: a.ability_description,
              ability_type: a.ability_type, charge_type: a.charge_type, max_charges: a.max_charges,
              granted_at_level: a.granted_at_level, sort_order: a.sort_order
            });
          }
        }
      }
      setMessage(`Subclass "${sub.name}" saved!`);
      await refreshRuleset();
    } catch (err: any) {
      setMessage('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveLevelReward = async (reward: RulesetLevelReward) => {
    setSaving(true);
    try {
      if (reward.id.startsWith('new_')) {
        await supabase.from('ruleset_level_rewards').insert({
          class_id: reward.class_id, level: reward.level, reward_type: reward.reward_type,
          ability_name: reward.ability_name, ability_description: reward.ability_description,
          stat_key: reward.stat_key, boost_amount: reward.boost_amount,
          skill_key: reward.skill_key, feature_text: reward.feature_text, sort_order: reward.sort_order
        });
      } else {
        await supabase.from('ruleset_level_rewards').update({
          level: reward.level, reward_type: reward.reward_type,
          ability_name: reward.ability_name, ability_description: reward.ability_description,
          stat_key: reward.stat_key, boost_amount: reward.boost_amount,
          skill_key: reward.skill_key, feature_text: reward.feature_text, sort_order: reward.sort_order
        }).eq('id', reward.id);
      }
      setMessage('Level reward saved!');
      await refreshRuleset();
    } catch (err: any) {
      setMessage('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteLevelReward = async (rewardId: string) => {
    if (rewardId.startsWith('new_')) {
      setEditLevelRewards(prev => prev.filter(r => r.id !== rewardId));
      return;
    }
    setSaving(true);
    try {
      await supabase.from('ruleset_level_rewards').delete().eq('id', rewardId);
      setMessage('Reward deleted.');
      await refreshRuleset();
    } catch (err: any) {
      setMessage('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ============ HELPER: Update class in local state ============
  const updateClassField = (classId: string, field: string, value: any) => {
    setEditClasses(prev => prev.map(c => c.id === classId ? { ...c, [field]: value } : c));
  };

  // ============ RENDER HELPERS ============

  const inputStyle = {
    background: 'var(--color-cyber-darker)',
    border: '1px solid var(--color-cyber-cyan)',
    color: 'var(--color-cyber-cyan)',
    fontFamily: 'var(--font-mono)',
  };

  const tabButtonStyle = (tab: EditorTab) => ({
    background: activeTab === tab ? 'var(--color-cyber-cyan)' : 'transparent',
    color: activeTab === tab ? 'black' : 'var(--color-cyber-cyan)',
    border: '1px solid var(--color-cyber-cyan)',
    fontFamily: 'var(--font-mono)',
  });

  // ============ NO RULESET STATE ============
  if (!rulesetLoading && !ruleset) {
    return (
      <div className="min-h-screen p-8" style={{ background: 'var(--color-cyber-dark)' }}>
        <div className="max-w-2xl mx-auto">
          <button onClick={() => navigate('/dm')} className="mb-4 text-sm px-3 py-1 rounded" style={{ border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>← Back to DM</button>
          <h1 className="text-3xl mb-6" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>RULESET EDITOR</h1>
          <div className="glass-panel p-8 text-center">
            <p className="text-lg mb-6" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>No ruleset is linked to this campaign.</p>
            <div className="flex gap-4 justify-center flex-wrap">
              <button onClick={createRuleset} disabled={saving} className="neon-button px-6 py-3" style={{ fontFamily: 'var(--font-cyber)' }}>
                {saving ? 'Creating...' : 'Create New Ruleset'}
              </button>
              <button onClick={cloneTemplate} disabled={saving} className="neon-button-magenta px-6 py-3" style={{ fontFamily: 'var(--font-cyber)' }}>
                {saving ? 'Cloning...' : 'Clone Default Template'}
              </button>
            </div>
            {message && <p className="mt-4 text-sm" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>{message}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (rulesetLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-cyber-dark)' }}>
        <p style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Loading ruleset...</p>
      </div>
    );
  }

  // ============ MAIN EDITOR ============
  return (
    <div className="min-h-screen" style={{ background: 'var(--color-cyber-dark)' }}>
      {/* Header */}
      <div className="glass-panel neon-border" style={{ borderRadius: 0 }}>
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dm')} className="text-sm px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>← DM</button>
            <h1 className="text-xl neon-text" style={{ fontFamily: 'var(--font-cyber)' }}>RULESET EDITOR</h1>
            <span className="text-xs opacity-70" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{ruleset?.name}</span>
          </div>
          {message && <span className="text-xs" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>{message}</span>}
        </div>
      </div>

      {/* Tab Bar */}
      <div className="container mx-auto px-4 py-3 flex gap-2 flex-wrap">
        {(['stats', 'skills', 'classes', 'subclasses', 'levels', 'modifiers'] as EditorTab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className="px-4 py-2 rounded text-sm font-bold" style={tabButtonStyle(tab)}>
            {tab === 'stats' ? '📊 Stats' : tab === 'skills' ? '🎯 Skills' : tab === 'classes' ? '⚔️ Classes' :
             tab === 'subclasses' ? '🔀 Subclasses' : tab === 'levels' ? '📈 Level Rewards' : '🔧 Modifiers'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="container mx-auto px-4 pb-8">

        {/* ==================== STATS TAB ==================== */}
        {activeTab === 'stats' && (
          <div className="glass-panel p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>STAT DEFINITIONS</h2>
              <div className="flex gap-2">
                <button onClick={() => setEditStats(prev => [...prev, { id: 'new_' + Date.now(), ruleset_id: ruleset!.id, key: '', name: '', abbreviation: '', sort_order: prev.length }])}
                  className="px-3 py-1 rounded text-sm" style={{ border: '1px solid var(--color-cyber-green)', color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>+ Add Stat</button>
                <button onClick={saveStats} disabled={saving} className="neon-button text-sm px-4 py-1">{saving ? 'Saving...' : 'Save Stats'}</button>
              </div>
            </div>
            <div className="space-y-2">
              {editStats.map((stat, idx) => (
                <div key={stat.id} className="flex gap-2 items-center">
                  <span className="text-xs w-6" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{idx + 1}</span>
                  <input value={stat.key} onChange={e => { const v = e.target.value; setEditStats(prev => prev.map(s => s.id === stat.id ? { ...s, key: v } : s)); }}
                    className="px-2 py-1 rounded text-sm w-32" style={inputStyle} placeholder="key (e.g. str)" />
                  <input value={stat.name} onChange={e => { const v = e.target.value; setEditStats(prev => prev.map(s => s.id === stat.id ? { ...s, name: v } : s)); }}
                    className="px-2 py-1 rounded text-sm flex-1" style={inputStyle} placeholder="Name (e.g. Strength)" />
                  <input value={stat.abbreviation} onChange={e => { const v = e.target.value; setEditStats(prev => prev.map(s => s.id === stat.id ? { ...s, abbreviation: v } : s)); }}
                    className="px-2 py-1 rounded text-sm w-20" style={inputStyle} placeholder="ABR" />
                  <button onClick={() => setEditStats(prev => prev.filter(s => s.id !== stat.id))}
                    className="text-xs px-2 py-1 rounded" style={{ color: 'var(--color-cyber-magenta)' }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== SKILLS TAB ==================== */}
        {activeTab === 'skills' && (
          <div className="glass-panel p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>SKILL DEFINITIONS</h2>
              <div className="flex gap-2">
                <button onClick={() => setEditSkills(prev => [...prev, { id: 'new_' + Date.now(), ruleset_id: ruleset!.id, key: '', name: '', linked_stat_key: null, sort_order: prev.length }])}
                  className="px-3 py-1 rounded text-sm" style={{ border: '1px solid var(--color-cyber-green)', color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>+ Add Skill</button>
                <button onClick={saveSkills} disabled={saving} className="neon-button text-sm px-4 py-1">{saving ? 'Saving...' : 'Save Skills'}</button>
              </div>
            </div>
            <div className="space-y-2">
              {editSkills.map((skill, idx) => (
                <div key={skill.id} className="flex gap-2 items-center">
                  <span className="text-xs w-6" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{idx + 1}</span>
                  <input value={skill.key} onChange={e => { const v = e.target.value; setEditSkills(prev => prev.map(s => s.id === skill.id ? { ...s, key: v } : s)); }}
                    className="px-2 py-1 rounded text-sm w-36" style={inputStyle} placeholder="key" />
                  <input value={skill.name} onChange={e => { const v = e.target.value; setEditSkills(prev => prev.map(s => s.id === skill.id ? { ...s, name: v } : s)); }}
                    className="px-2 py-1 rounded text-sm flex-1" style={inputStyle} placeholder="Display Name" />
                  <select value={skill.linked_stat_key || ''} onChange={e => { const v = e.target.value || null; setEditSkills(prev => prev.map(s => s.id === skill.id ? { ...s, linked_stat_key: v } : s)); }}
                    className="px-2 py-1 rounded text-sm w-32" style={inputStyle}>
                    <option value="">No stat</option>
                    {editStats.map(s => <option key={s.key} value={s.key}>{s.abbreviation || s.key}</option>)}
                  </select>
                  <button onClick={() => setEditSkills(prev => prev.filter(s => s.id !== skill.id))}
                    className="text-xs px-2 py-1 rounded" style={{ color: 'var(--color-cyber-magenta)' }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== CLASSES TAB ==================== */}
        {activeTab === 'classes' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>CLASS DEFINITIONS</h2>
              <button onClick={() => {
                const newClass: RulesetClass = {
                  id: 'new_' + Date.now(), ruleset_id: ruleset!.id, key: '', name: '', description: null,
                  hp: 20, ac: 14, cdd: 'd8', speed: 30, initiative_modifier: 0, implant_capacity: 3,
                  stat_bonuses: {}, skill_bonuses: {}, save_proficiencies: [], weapon_proficiencies: [],
                  armor_proficiencies: [], tools: [], sort_order: editClasses.length, abilities: [], starter_items: []
                };
                setEditClasses(prev => [...prev, newClass]);
                setExpandedClass(newClass.id);
              }} className="px-3 py-1 rounded text-sm" style={{ border: '1px solid var(--color-cyber-green)', color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>+ Add Class</button>
            </div>

            {editClasses.map(cls => (
              <div key={cls.id} className="glass-panel p-4">
                <div className="flex justify-between items-center cursor-pointer" onClick={() => setExpandedClass(expandedClass === cls.id ? null : cls.id)}>
                  <div className="flex items-center gap-3">
                    <span className="text-lg" style={{ color: expandedClass === cls.id ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>
                      {expandedClass === cls.id ? '▼' : '▶'} {cls.name || '(Unnamed Class)'}
                    </span>
                    <span className="text-xs opacity-70" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>key: {cls.key}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); saveClass(cls); }} disabled={saving} className="neon-button text-xs px-3 py-1">
                      {saving ? '...' : 'Save'}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteClass(cls.id); }} className="text-xs px-2 py-1 rounded"
                      style={{ border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>Delete</button>
                  </div>
                </div>

                {expandedClass === cls.id && (
                  <div className="mt-4 space-y-4">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="text-xs block mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Key</label>
                        <input value={cls.key} onChange={e => updateClassField(cls.id, 'key', e.target.value)} className="w-full px-2 py-1 rounded text-sm" style={inputStyle} />
                      </div>
                      <div>
                        <label className="text-xs block mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Name</label>
                        <input value={cls.name} onChange={e => updateClassField(cls.id, 'name', e.target.value)} className="w-full px-2 py-1 rounded text-sm" style={inputStyle} />
                      </div>
                      <div>
                        <label className="text-xs block mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>HP</label>
                        <input type="number" value={cls.hp} onChange={e => updateClassField(cls.id, 'hp', parseInt(e.target.value) || 0)} className="w-full px-2 py-1 rounded text-sm" style={inputStyle} />
                      </div>
                      <div>
                        <label className="text-xs block mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>AC</label>
                        <input type="number" value={cls.ac} onChange={e => updateClassField(cls.id, 'ac', parseInt(e.target.value) || 0)} className="w-full px-2 py-1 rounded text-sm" style={inputStyle} />
                      </div>
                      <div>
                        <label className="text-xs block mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>CDD (Damage Die)</label>
                        <input value={cls.cdd} onChange={e => updateClassField(cls.id, 'cdd', e.target.value)} className="w-full px-2 py-1 rounded text-sm" style={inputStyle} />
                      </div>
                      <div>
                        <label className="text-xs block mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Speed</label>
                        <input type="number" value={cls.speed} onChange={e => updateClassField(cls.id, 'speed', parseInt(e.target.value) || 0)} className="w-full px-2 py-1 rounded text-sm" style={inputStyle} />
                      </div>
                      <div>
                        <label className="text-xs block mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Init Modifier</label>
                        <input type="number" value={cls.initiative_modifier} onChange={e => updateClassField(cls.id, 'initiative_modifier', parseInt(e.target.value) || 0)} className="w-full px-2 py-1 rounded text-sm" style={inputStyle} />
                      </div>
                      <div>
                        <label className="text-xs block mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Implant Capacity</label>
                        <input type="number" value={cls.implant_capacity} onChange={e => updateClassField(cls.id, 'implant_capacity', parseInt(e.target.value) || 0)} className="w-full px-2 py-1 rounded text-sm" style={inputStyle} />
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="text-xs block mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Description</label>
                      <textarea value={cls.description || ''} onChange={e => updateClassField(cls.id, 'description', e.target.value)} rows={2} className="w-full px-2 py-1 rounded text-sm" style={inputStyle} />
                    </div>

                    {/* Stat Bonuses */}
                    <div>
                      <label className="text-xs block mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Stat Bonuses (JSON)</label>
                      <input value={JSON.stringify(cls.stat_bonuses)} onChange={e => { try { updateClassField(cls.id, 'stat_bonuses', JSON.parse(e.target.value)); } catch {} }}
                        className="w-full px-2 py-1 rounded text-sm" style={inputStyle} placeholder='{"str": 2, "con": 1}' />
                    </div>

                    {/* Skill Bonuses */}
                    <div>
                      <label className="text-xs block mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Skill Bonuses (JSON)</label>
                      <input value={JSON.stringify(cls.skill_bonuses)} onChange={e => { try { updateClassField(cls.id, 'skill_bonuses', JSON.parse(e.target.value)); } catch {} }}
                        className="w-full px-2 py-1 rounded text-sm" style={inputStyle} placeholder='{"athletics": 3}' />
                    </div>

                    {/* Proficiencies */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs block mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Save Proficiencies</label>
                        <input value={cls.save_proficiencies.join(', ')} onChange={e => updateClassField(cls.id, 'save_proficiencies', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                          className="w-full px-2 py-1 rounded text-sm" style={inputStyle} placeholder="STR, CON" />
                      </div>
                      <div>
                        <label className="text-xs block mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Weapon Profs</label>
                        <input value={cls.weapon_proficiencies.join(', ')} onChange={e => updateClassField(cls.id, 'weapon_proficiencies', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                          className="w-full px-2 py-1 rounded text-sm" style={inputStyle} placeholder="melee, sidearms" />
                      </div>
                      <div>
                        <label className="text-xs block mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Armor Profs</label>
                        <input value={cls.armor_proficiencies.join(', ')} onChange={e => updateClassField(cls.id, 'armor_proficiencies', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                          className="w-full px-2 py-1 rounded text-sm" style={inputStyle} placeholder="light, medium" />
                      </div>
                    </div>

                    {/* Tools */}
                    <div>
                      <label className="text-xs block mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Tools (JSON array)</label>
                      <textarea value={JSON.stringify(cls.tools, null, 2)} onChange={e => { try { updateClassField(cls.id, 'tools', JSON.parse(e.target.value)); } catch {} }}
                        rows={3} className="w-full px-2 py-1 rounded text-sm" style={inputStyle} />
                    </div>

                    {/* Abilities */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-xs" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>Class Abilities</label>
                        <button onClick={() => {
                          const newAbil: RulesetClassAbility = { id: 'new_' + Date.now(), class_id: cls.id, ability_name: '', ability_description: '', ability_type: 'action', charge_type: 'uses', max_charges: 1, granted_at_level: 1, sort_order: (cls.abilities?.length || 0) };
                          updateClassField(cls.id, 'abilities', [...(cls.abilities || []), newAbil]);
                        }} className="text-xs px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-green)', color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>+ Ability</button>
                      </div>
                      {(cls.abilities || []).map((abil, ai) => (
                        <div key={abil.id || ai} className="flex gap-2 items-start mb-2 p-2 rounded" style={{ background: 'rgba(0,255,255,0.05)' }}>
                          <input value={abil.ability_name} onChange={e => {
                            const updated = [...(cls.abilities || [])];
                            updated[ai] = { ...updated[ai], ability_name: e.target.value };
                            updateClassField(cls.id, 'abilities', updated);
                          }} className="px-2 py-1 rounded text-xs w-32" style={inputStyle} placeholder="Name" />
                          <input value={abil.ability_description || ''} onChange={e => {
                            const updated = [...(cls.abilities || [])];
                            updated[ai] = { ...updated[ai], ability_description: e.target.value };
                            updateClassField(cls.id, 'abilities', updated);
                          }} className="px-2 py-1 rounded text-xs flex-1" style={inputStyle} placeholder="Description" />
                          <input type="number" value={abil.max_charges} onChange={e => {
                            const updated = [...(cls.abilities || [])];
                            updated[ai] = { ...updated[ai], max_charges: parseInt(e.target.value) || 1 };
                            updateClassField(cls.id, 'abilities', updated);
                          }} className="px-2 py-1 rounded text-xs w-16" style={inputStyle} title="Charges" />
                          <input type="number" value={abil.granted_at_level} onChange={e => {
                            const updated = [...(cls.abilities || [])];
                            updated[ai] = { ...updated[ai], granted_at_level: parseInt(e.target.value) || 1 };
                            updateClassField(cls.id, 'abilities', updated);
                          }} className="px-2 py-1 rounded text-xs w-16" style={inputStyle} title="Level" />
                          <button onClick={() => {
                            const updated = (cls.abilities || []).filter((_, i) => i !== ai);
                            updateClassField(cls.id, 'abilities', updated);
                          }} className="text-xs px-1" style={{ color: 'var(--color-cyber-magenta)' }}>✕</button>
                        </div>
                      ))}
                    </div>

                    {/* Starter Items */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-xs" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>Starter Items</label>
                        <button onClick={() => {
                          const newItem: RulesetClassStarterItem = { id: 'new_' + Date.now(), class_id: cls.id, item_name: '', item_type: 'item', item_description: null, sort_order: (cls.starter_items?.length || 0) };
                          updateClassField(cls.id, 'starter_items', [...(cls.starter_items || []), newItem]);
                        }} className="text-xs px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-green)', color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>+ Item</button>
                      </div>
                      {(cls.starter_items || []).map((item, ii) => (
                        <div key={item.id || ii} className="flex gap-2 items-center mb-2">
                          <input value={item.item_name} onChange={e => {
                            const updated = [...(cls.starter_items || [])];
                            updated[ii] = { ...updated[ii], item_name: e.target.value };
                            updateClassField(cls.id, 'starter_items', updated);
                          }} className="px-2 py-1 rounded text-xs flex-1" style={inputStyle} placeholder="Item name" />
                          <select value={item.item_type} onChange={e => {
                            const updated = [...(cls.starter_items || [])];
                            updated[ii] = { ...updated[ii], item_type: e.target.value };
                            updateClassField(cls.id, 'starter_items', updated);
                          }} className="px-2 py-1 rounded text-xs" style={inputStyle}>
                            <option value="weapon">Weapon</option>
                            <option value="armor">Armor</option>
                            <option value="item">Item</option>
                            <option value="cyberware">Cyberware</option>
                            <option value="consumable">Consumable</option>
                          </select>
                          <button onClick={() => {
                            const updated = (cls.starter_items || []).filter((_, i) => i !== ii);
                            updateClassField(cls.id, 'starter_items', updated);
                          }} className="text-xs px-1" style={{ color: 'var(--color-cyber-magenta)' }}>✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ==================== SUBCLASSES TAB ==================== */}
        {activeTab === 'subclasses' && (
          <div className="space-y-4">
            <h2 className="text-lg" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>SUBCLASSES</h2>
            {editClasses.filter(c => !c.id.startsWith('new_')).map(cls => (
              <div key={cls.id} className="glass-panel p-4">
                <h3 className="text-md mb-3" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)' }}>{cls.name}</h3>
                {(cls.subclasses || []).map(sub => (
                  <div key={sub.id} className="mb-4 p-3 rounded" style={{ border: '1px solid var(--color-cyber-cyan)', background: 'rgba(0,255,255,0.03)' }}>
                    <div className="flex justify-between items-center mb-2 cursor-pointer" onClick={() => setExpandedSubclass(expandedSubclass === sub.id ? null : sub.id)}>
                      <span style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                        {expandedSubclass === sub.id ? '▼' : '▶'} {sub.name || '(Unnamed)'}
                      </span>
                      <div className="flex gap-2">
                        <button onClick={(e) => { e.stopPropagation(); saveSubclass(sub); }} disabled={saving} className="neon-button text-xs px-2 py-1">Save</button>
                      </div>
                    </div>
                    {expandedSubclass === sub.id && (
                      <div className="space-y-3 mt-3">
                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <label className="text-xs block mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Key</label>
                            <input value={sub.key} onChange={e => {
                              const updated = (cls.subclasses || []).map(s => s.id === sub.id ? { ...s, key: e.target.value } : s);
                              updateClassField(cls.id, 'subclasses', updated);
                            }} className="w-full px-2 py-1 rounded text-sm" style={inputStyle} />
                          </div>
                          <div>
                            <label className="text-xs block mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Name</label>
                            <input value={sub.name} onChange={e => {
                              const updated = (cls.subclasses || []).map(s => s.id === sub.id ? { ...s, name: e.target.value } : s);
                              updateClassField(cls.id, 'subclasses', updated);
                            }} className="w-full px-2 py-1 rounded text-sm" style={inputStyle} />
                          </div>
                          <div>
                            <label className="text-xs block mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Unlock Level</label>
                            <input type="number" value={sub.unlock_level} onChange={e => {
                              const updated = (cls.subclasses || []).map(s => s.id === sub.id ? { ...s, unlock_level: parseInt(e.target.value) || 3 } : s);
                              updateClassField(cls.id, 'subclasses', updated);
                            }} className="w-full px-2 py-1 rounded text-sm" style={inputStyle} />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs block mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Description</label>
                          <textarea value={sub.description || ''} onChange={e => {
                            const updated = (cls.subclasses || []).map(s => s.id === sub.id ? { ...s, description: e.target.value } : s);
                            updateClassField(cls.id, 'subclasses', updated);
                          }} rows={2} className="w-full px-2 py-1 rounded text-sm" style={inputStyle} />
                        </div>
                        <div>
                          <label className="text-xs block mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Stat Bonuses (JSON)</label>
                          <input value={JSON.stringify(sub.stat_bonuses)} onChange={e => { try {
                            const updated = (cls.subclasses || []).map(s => s.id === sub.id ? { ...s, stat_bonuses: JSON.parse(e.target.value) } : s);
                            updateClassField(cls.id, 'subclasses', updated);
                          } catch {} }} className="w-full px-2 py-1 rounded text-sm" style={inputStyle} />
                        </div>
                        {/* Subclass abilities */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-xs" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>Subclass Abilities</label>
                            <button onClick={() => {
                              const newAbil: RulesetSubclassAbility = { id: 'new_' + Date.now(), subclass_id: sub.id, ability_name: '', ability_description: '', ability_type: 'action', charge_type: 'uses', max_charges: 1, granted_at_level: sub.unlock_level, sort_order: (sub.abilities?.length || 0) };
                              const updated = (cls.subclasses || []).map(s => s.id === sub.id ? { ...s, abilities: [...(s.abilities || []), newAbil] } : s);
                              updateClassField(cls.id, 'subclasses', updated);
                            }} className="text-xs px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-green)', color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>+ Ability</button>
                          </div>
                          {(sub.abilities || []).map((abil, ai) => (
                            <div key={abil.id || ai} className="flex gap-2 items-center mb-1">
                              <input value={abil.ability_name} onChange={e => {
                                const updatedSubs = (cls.subclasses || []).map(s => {
                                  if (s.id !== sub.id) return s;
                                  const updatedAbils = [...(s.abilities || [])];
                                  updatedAbils[ai] = { ...updatedAbils[ai], ability_name: e.target.value };
                                  return { ...s, abilities: updatedAbils };
                                });
                                updateClassField(cls.id, 'subclasses', updatedSubs);
                              }} className="px-2 py-1 rounded text-xs w-32" style={inputStyle} placeholder="Name" />
                              <input value={abil.ability_description || ''} onChange={e => {
                                const updatedSubs = (cls.subclasses || []).map(s => {
                                  if (s.id !== sub.id) return s;
                                  const updatedAbils = [...(s.abilities || [])];
                                  updatedAbils[ai] = { ...updatedAbils[ai], ability_description: e.target.value };
                                  return { ...s, abilities: updatedAbils };
                                });
                                updateClassField(cls.id, 'subclasses', updatedSubs);
                              }} className="px-2 py-1 rounded text-xs flex-1" style={inputStyle} placeholder="Description" />
                              <input type="number" value={abil.granted_at_level} onChange={e => {
                                const updatedSubs = (cls.subclasses || []).map(s => {
                                  if (s.id !== sub.id) return s;
                                  const updatedAbils = [...(s.abilities || [])];
                                  updatedAbils[ai] = { ...updatedAbils[ai], granted_at_level: parseInt(e.target.value) || 1 };
                                  return { ...s, abilities: updatedAbils };
                                });
                                updateClassField(cls.id, 'subclasses', updatedSubs);
                              }} className="px-2 py-1 rounded text-xs w-14" style={inputStyle} title="Level" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <button onClick={() => {
                  const newSub: RulesetSubclass = { id: 'new_' + Date.now(), class_id: cls.id, key: '', name: '', description: null, unlock_level: 3, stat_bonuses: {}, skill_bonuses: {}, sort_order: (cls.subclasses?.length || 0), abilities: [] };
                  updateClassField(cls.id, 'subclasses', [...(cls.subclasses || []), newSub]);
                  setExpandedSubclass(newSub.id);
                }} className="text-sm px-3 py-1 rounded mt-2" style={{ border: '1px solid var(--color-cyber-green)', color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>+ Add Subclass to {cls.name}</button>
              </div>
            ))}
          </div>
        )}

        {/* ==================== LEVEL REWARDS TAB ==================== */}
        {activeTab === 'levels' && (
          <div className="glass-panel p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>LEVEL REWARDS</h2>
            </div>
            {editClasses.filter(c => !c.id.startsWith('new_')).map(cls => {
              const classRewards = editLevelRewards.filter(r => r.class_id === cls.id);
              return (
                <div key={cls.id} className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <h3 style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)' }}>{cls.name}</h3>
                    <button onClick={() => {
                      const newReward: RulesetLevelReward = { id: 'new_' + Date.now(), class_id: cls.id, level: 2, reward_type: 'feature', ability_name: null, ability_description: null, stat_key: null, boost_amount: null, skill_key: null, feature_text: null, sort_order: classRewards.length };
                      setEditLevelRewards(prev => [...prev, newReward]);
                    }} className="text-xs px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-green)', color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>+ Reward</button>
                  </div>
                  {classRewards.length === 0 && (
                    <p className="text-xs opacity-50 mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>No rewards defined.</p>
                  )}
                  {classRewards.map(reward => (
                    <div key={reward.id} className="flex gap-2 items-center mb-2 p-2 rounded" style={{ background: 'rgba(0,255,255,0.05)' }}>
                      <input type="number" value={reward.level} onChange={e => setEditLevelRewards(prev => prev.map(r => r.id === reward.id ? { ...r, level: parseInt(e.target.value) || 2 } : r))}
                        className="px-2 py-1 rounded text-xs w-14" style={inputStyle} title="Level" />
                      <select value={reward.reward_type} onChange={e => setEditLevelRewards(prev => prev.map(r => r.id === reward.id ? { ...r, reward_type: e.target.value as any } : r))}
                        className="px-2 py-1 rounded text-xs w-32" style={inputStyle}>
                        <option value="ability">Ability</option>
                        <option value="stat_boost">Stat Boost</option>
                        <option value="skill_boost">Skill Boost</option>
                        <option value="hp_increase">HP Increase</option>
                        <option value="feature">Feature</option>
                        <option value="subclass_choice">Subclass Choice</option>
                      </select>
                      {(reward.reward_type === 'ability') && (
                        <>
                          <input value={reward.ability_name || ''} onChange={e => setEditLevelRewards(prev => prev.map(r => r.id === reward.id ? { ...r, ability_name: e.target.value } : r))}
                            className="px-2 py-1 rounded text-xs w-28" style={inputStyle} placeholder="Ability name" />
                          <input value={reward.ability_description || ''} onChange={e => setEditLevelRewards(prev => prev.map(r => r.id === reward.id ? { ...r, ability_description: e.target.value } : r))}
                            className="px-2 py-1 rounded text-xs flex-1" style={inputStyle} placeholder="Description" />
                        </>
                      )}
                      {(reward.reward_type === 'stat_boost' || reward.reward_type === 'skill_boost') && (
                        <>
                          <input value={reward.reward_type === 'stat_boost' ? (reward.stat_key || '') : (reward.skill_key || '')} onChange={e => setEditLevelRewards(prev => prev.map(r => r.id === reward.id ? (reward.reward_type === 'stat_boost' ? { ...r, stat_key: e.target.value } : { ...r, skill_key: e.target.value }) : r))}
                            className="px-2 py-1 rounded text-xs w-24" style={inputStyle} placeholder={reward.reward_type === 'stat_boost' ? 'stat key' : 'skill key'} />
                          <input type="number" value={reward.boost_amount || 0} onChange={e => setEditLevelRewards(prev => prev.map(r => r.id === reward.id ? { ...r, boost_amount: parseInt(e.target.value) || 0 } : r))}
                            className="px-2 py-1 rounded text-xs w-16" style={inputStyle} placeholder="Amount" />
                        </>
                      )}
                      {reward.reward_type === 'hp_increase' && (
                        <input type="number" value={reward.boost_amount || 0} onChange={e => setEditLevelRewards(prev => prev.map(r => r.id === reward.id ? { ...r, boost_amount: parseInt(e.target.value) || 0 } : r))}
                          className="px-2 py-1 rounded text-xs w-16" style={inputStyle} placeholder="HP+" />
                      )}
                      {reward.reward_type === 'feature' && (
                        <input value={reward.feature_text || ''} onChange={e => setEditLevelRewards(prev => prev.map(r => r.id === reward.id ? { ...r, feature_text: e.target.value } : r))}
                          className="px-2 py-1 rounded text-xs flex-1" style={inputStyle} placeholder="Feature description" />
                      )}
                      <div className="flex gap-1">
                        <button onClick={() => saveLevelReward(reward)} disabled={saving} className="neon-button text-xs px-2 py-1">Save</button>
                        <button onClick={() => deleteLevelReward(reward.id)} className="text-xs px-1" style={{ color: 'var(--color-cyber-magenta)' }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* ==================== MODIFIERS TAB ==================== */}
        {activeTab === 'modifiers' && (
          <div className="glass-panel p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>CUSTOM MODIFIERS</h2>
              <div className="flex gap-2">
                <button onClick={() => setEditModifiers(prev => [...prev, { id: 'new_' + Date.now(), ruleset_id: ruleset!.id, key: '', name: '', min_value: 0, max_value: 100, default_value: 0, sort_order: prev.length }])}
                  className="px-3 py-1 rounded text-sm" style={{ border: '1px solid var(--color-cyber-green)', color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>+ Add Modifier</button>
                <button onClick={saveModifiers} disabled={saving} className="neon-button text-sm px-4 py-1">{saving ? 'Saving...' : 'Save Modifiers'}</button>
              </div>
            </div>
            <p className="text-xs mb-4 opacity-70" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
              Custom modifiers appear on character sheets (e.g. Hunger, Radiation, Sanity). Items can also affect these.
            </p>
            <div className="space-y-2">
              {editModifiers.map((mod, idx) => (
                <div key={mod.id} className="flex gap-2 items-center">
                  <span className="text-xs w-6" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{idx + 1}</span>
                  <input value={mod.key} onChange={e => { const v = e.target.value; setEditModifiers(prev => prev.map(m => m.id === mod.id ? { ...m, key: v } : m)); }}
                    className="px-2 py-1 rounded text-sm w-32" style={inputStyle} placeholder="key" />
                  <input value={mod.name} onChange={e => { const v = e.target.value; setEditModifiers(prev => prev.map(m => m.id === mod.id ? { ...m, name: v } : m)); }}
                    className="px-2 py-1 rounded text-sm flex-1" style={inputStyle} placeholder="Display Name" />
                  <input type="number" value={mod.min_value} onChange={e => { const v = parseInt(e.target.value) || 0; setEditModifiers(prev => prev.map(m => m.id === mod.id ? { ...m, min_value: v } : m)); }}
                    className="px-2 py-1 rounded text-sm w-16" style={inputStyle} title="Min" />
                  <input type="number" value={mod.max_value} onChange={e => { const v = parseInt(e.target.value) || 100; setEditModifiers(prev => prev.map(m => m.id === mod.id ? { ...m, max_value: v } : m)); }}
                    className="px-2 py-1 rounded text-sm w-16" style={inputStyle} title="Max" />
                  <input type="number" value={mod.default_value} onChange={e => { const v = parseInt(e.target.value) || 0; setEditModifiers(prev => prev.map(m => m.id === mod.id ? { ...m, default_value: v } : m)); }}
                    className="px-2 py-1 rounded text-sm w-16" style={inputStyle} title="Default" />
                  <button onClick={() => setEditModifiers(prev => prev.filter(m => m.id !== mod.id))}
                    className="text-xs px-2 py-1 rounded" style={{ color: 'var(--color-cyber-magenta)' }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
