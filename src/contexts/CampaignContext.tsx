import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

// ============================================================
// Types
// ============================================================

export interface CampaignTheme {
  id: string;
  name: string;
  color_primary: string;
  color_secondary: string;
  color_tertiary: string;
  color_success: string;
  color_danger: string;
  color_bg_dark: string;
  color_bg_darker: string;
  color_text: string;
  color_text_muted: string;
  font_heading: string;
  font_body: string;
  shadow_primary: string;
  shadow_secondary: string;
  landing_title: string;
  landing_subtitle: string;
  landing_bg_image: string | null;
}

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  theme_id: string | null;
  owner_id: string;
  invite_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  theme?: CampaignTheme;
}

export interface CampaignMember {
  id: string;
  campaign_id: string;
  user_id: string;
  role: 'admin' | 'player';
  joined_at: string;
}

interface CampaignContextType {
  // Current active campaign
  campaign: Campaign | null;
  campaignId: string | null;
  campaignRole: 'admin' | 'player' | null;
  theme: CampaignTheme | null;

  // Available campaigns
  campaigns: Campaign[];
  campaignsLoading: boolean;

  // Splash screen state
  showingSplash: boolean;

  // Actions
  selectCampaign: (campaignId: string) => Promise<void>;
  leaveCampaign: () => void;
  createCampaign: (name: string, description?: string) => Promise<Campaign | null>;
  joinCampaign: (inviteCode: string) => Promise<{ success: boolean; error?: string }>;
  updateTheme: (themeUpdates: Partial<CampaignTheme>) => Promise<void>;
  refreshCampaigns: () => Promise<void>;
}

// ============================================================
// Default theme (cyberpunk — matches current app look)
// ============================================================
export const DEFAULT_THEME: CampaignTheme = {
  id: '',
  name: 'Cyberpunk',
  color_primary: '#40E0D0',
  color_secondary: '#D93654',
  color_tertiary: '#FF9F1C',
  color_success: '#1A3A3A',
  color_danger: '#FF003C',
  color_bg_dark: '#0D1117',
  color_bg_darker: '#010409',
  color_text: '#E6EDF3',
  color_text_muted: '#8B949E',
  font_heading: "'Orbitron', sans-serif",
  font_body: "'Courier New', monospace",
  shadow_primary: '0 0 5px #40E0D0, 0 0 20px rgba(64, 224, 208, 0.3)',
  shadow_secondary: '0 0 5px #D93654, 0 0 20px rgba(217, 54, 84, 0.3)',
  landing_title: '',
  landing_subtitle: '',
  landing_bg_image: null,
};

// ============================================================
// Preset themes for quick selection
// ============================================================
export const THEME_PRESETS: Record<string, Partial<CampaignTheme>> = {
  cyberpunk: {
    name: 'Cyberpunk',
    color_primary: '#40E0D0',
    color_secondary: '#D93654',
    color_tertiary: '#FF9F1C',
    color_success: '#1A3A3A',
    color_danger: '#FF003C',
    color_bg_dark: '#0D1117',
    color_bg_darker: '#010409',
    color_text: '#E6EDF3',
    color_text_muted: '#8B949E',
    font_heading: "'Orbitron', sans-serif",
    font_body: "'Courier New', monospace",
  },
  fantasy: {
    name: 'High Fantasy',
    color_primary: '#C9A84C',
    color_secondary: '#8B2F4F',
    color_tertiary: '#4A7C59',
    color_success: '#2D5016',
    color_danger: '#8B0000',
    color_bg_dark: '#1A1108',
    color_bg_darker: '#0D0A04',
    color_text: '#E8DCC8',
    color_text_muted: '#A09080',
    font_heading: "'Georgia', serif",
    font_body: "'Palatino Linotype', serif",
  },
  scifi: {
    name: 'Sci-Fi',
    color_primary: '#00B4D8',
    color_secondary: '#E63946',
    color_tertiary: '#F77F00',
    color_success: '#06D6A0',
    color_danger: '#EF233C',
    color_bg_dark: '#0B132B',
    color_bg_darker: '#040810',
    color_text: '#E0F0FF',
    color_text_muted: '#7A8BA0',
    font_heading: "'Segoe UI', sans-serif",
    font_body: "'Consolas', monospace",
  },
  horror: {
    name: 'Horror',
    color_primary: '#B8B8B8',
    color_secondary: '#8B0000',
    color_tertiary: '#4A0E0E',
    color_success: '#2D4A1A',
    color_danger: '#CC0000',
    color_bg_dark: '#0A0A0A',
    color_bg_darker: '#000000',
    color_text: '#D0D0D0',
    color_text_muted: '#707070',
    font_heading: "'Times New Roman', serif",
    font_body: "'Courier New', monospace",
  },
  steampunk: {
    name: 'Steampunk',
    color_primary: '#CD853F',
    color_secondary: '#8B4513',
    color_tertiary: '#DAA520',
    color_success: '#556B2F',
    color_danger: '#B22222',
    color_bg_dark: '#1C1410',
    color_bg_darker: '#0E0A08',
    color_text: '#E8D8C0',
    color_text_muted: '#A09080',
    font_heading: "'Georgia', serif",
    font_body: "'Courier New', monospace",
  },
  modern: {
    name: 'Modern/Urban',
    color_primary: '#4F46E5',
    color_secondary: '#E11D48',
    color_tertiary: '#0D9488',
    color_success: '#16A34A',
    color_danger: '#DC2626',
    color_bg_dark: '#F5F5F5',
    color_bg_darker: '#FFFFFF',
    color_text: '#1F2937',
    color_text_muted: '#6B7280',
    font_heading: "'Segoe UI', sans-serif",
    font_body: "'Inter', 'Segoe UI', sans-serif",
  },
};

// ============================================================
// Apply theme to CSS custom properties
// ============================================================
export function applyTheme(theme: CampaignTheme) {
  const root = document.documentElement;

  // Map theme colors to existing CSS variable names
  root.style.setProperty('--color-cyber-cyan', theme.color_primary);
  root.style.setProperty('--color-cyber-blue', theme.color_primary);
  root.style.setProperty('--color-cyber-magenta', theme.color_secondary);
  root.style.setProperty('--color-cyber-purple', theme.color_secondary);
  root.style.setProperty('--color-cyber-pink', theme.color_secondary);
  root.style.setProperty('--color-cyber-yellow', theme.color_tertiary);
  root.style.setProperty('--color-cyber-green', theme.color_success);
  root.style.setProperty('--color-cyber-red', theme.color_danger);
  root.style.setProperty('--color-cyber-dark', theme.color_bg_dark);
  root.style.setProperty('--color-cyber-darker', theme.color_bg_darker);
  root.style.setProperty('--color-text', theme.color_text || '#E6EDF3');
  root.style.setProperty('--color-text-muted', theme.color_text_muted || '#8B949E');

  root.style.setProperty('--font-cyber', theme.font_heading);
  root.style.setProperty('--font-mono', theme.font_body);

  // Compute neon shadows from theme colors
  const toRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  root.style.setProperty('--shadow-neon-cyan', `0 0 5px ${theme.color_primary}, 0 0 20px ${toRgba(theme.color_primary, 0.3)}`);
  root.style.setProperty('--shadow-neon-magenta', `0 0 5px ${theme.color_secondary}, 0 0 20px ${toRgba(theme.color_secondary, 0.3)}`);
  root.style.setProperty('--shadow-neon-green', `0 0 5px ${theme.color_success}, 0 0 20px ${toRgba(theme.color_success, 0.3)}`);
  root.style.setProperty('--shadow-neon-yellow', `0 0 5px ${theme.color_tertiary}, 0 0 20px ${toRgba(theme.color_tertiary, 0.3)}`);

  // Update body background
  document.body.style.background = `linear-gradient(180deg, ${theme.color_bg_dark} 0%, ${theme.color_bg_darker} 50%, ${theme.color_bg_dark} 100%)`;
  document.body.style.backgroundAttachment = 'fixed';
}

// ============================================================
// Context
// ============================================================
const CampaignContext = createContext<CampaignContextType | undefined>(undefined);

const CAMPAIGN_STORAGE_KEY = 'selected_campaign_id';

export function CampaignProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [campaignRole, setCampaignRole] = useState<'admin' | 'player' | null>(null);
  const [theme, setTheme] = useState<CampaignTheme | null>(null);
  const [campaignsLoading, setCampaignsLoading] = useState(true);

  const campaignId = campaign?.id || null;

  // ── Fetch all campaigns the user belongs to ──
  const refreshCampaigns = useCallback(async () => {
    if (!user) {
      setCampaigns([]);
      setCampaignsLoading(false);
      return;
    }

    setCampaignsLoading(true);
    try {
      console.log('[Campaign] Fetching memberships for user:', user.id);

      // Get campaign IDs for this user
      const { data: memberships, error: memError } = await supabase
        .from('campaign_members')
        .select('campaign_id, role')
        .eq('user_id', user.id);

      console.log('[Campaign] Memberships result:', { memberships, error: memError });

      if (!memberships || memberships.length === 0) {
        console.warn('[Campaign] No memberships found — user may not be in campaign_members table');
        setCampaigns([]);
        setCampaignsLoading(false);
        return;
      }

      const campaignIds = memberships.map(m => m.campaign_id);
      console.log('[Campaign] Fetching campaigns:', campaignIds);

      // Fetch campaigns with themes
      const { data: campaignData, error: campError } = await supabase
        .from('campaigns')
        .select('*, theme:campaign_themes(*)')
        .in('id', campaignIds)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      console.log('[Campaign] Campaigns result:', { campaignData, error: campError });

      setCampaigns(campaignData || []);
    } catch (err) {
      console.error('Error fetching campaigns:', err);
      setCampaigns([]);
    } finally {
      setCampaignsLoading(false);
    }
  }, [user]);

  // ── Load campaigns when user changes ──
  // Also clear any stored campaign so user always sees the selection screen on login
  useEffect(() => {
    setCampaign(null);
    setCampaignRole(null);
    setTheme(null);
    localStorage.removeItem(CAMPAIGN_STORAGE_KEY);
    refreshCampaigns();
  }, [refreshCampaigns]);

  // Campaign is only set when user explicitly calls selectCampaign()
  const [showingSplash, setShowingSplash] = useState(false);

  // ── Select a campaign ──
  const selectCampaign = async (id: string) => {
    const selected = campaigns.find(c => c.id === id);
    if (!selected || !user) return;

    // Show splash screen
    setShowingSplash(true);

    setCampaign(selected);
    localStorage.setItem(CAMPAIGN_STORAGE_KEY, id);

    // Get role
    const { data: membership } = await supabase
      .from('campaign_members')
      .select('role')
      .eq('campaign_id', id)
      .eq('user_id', user.id)
      .single();

    setCampaignRole((membership?.role as 'admin' | 'player') || 'player');

    // Apply theme
    const campaignTheme: CampaignTheme = selected.theme
      ? { ...DEFAULT_THEME, ...selected.theme }
      : DEFAULT_THEME;
    setTheme(campaignTheme);
    applyTheme(campaignTheme);

    // Auto-dismiss splash after 5s
    setTimeout(() => setShowingSplash(false), 5000);
  };

  // ── Leave campaign (go back to selection) ──
  const leaveCampaign = () => {
    setCampaign(null);
    setCampaignRole(null);
    setTheme(null);
    localStorage.removeItem(CAMPAIGN_STORAGE_KEY);
    // Reset to default theme
    applyTheme(DEFAULT_THEME);
  };

  // ── Create a new campaign ──
  const createCampaign = async (name: string, description?: string): Promise<Campaign | null> => {
    if (!user) return null;

    try {
      // Create a theme for the campaign
      const { data: newTheme, error: themeError } = await supabase
        .from('campaign_themes')
        .insert({ name: `${name} Theme` })
        .select()
        .single();

      if (themeError) throw themeError;

      // Create the campaign
      const { data: newCampaign, error: campError } = await supabase
        .from('campaigns')
        .insert({
          name,
          description: description || null,
          theme_id: newTheme.id,
          owner_id: user.id,
        })
        .select('*, theme:campaign_themes(*)')
        .single();

      if (campError) throw campError;

      // Add creator as admin member
      await supabase.from('campaign_members').insert({
        campaign_id: newCampaign.id,
        user_id: user.id,
        role: 'admin',
      });

      // Create default game_settings rows for this campaign
      await supabase.from('game_settings').insert([
        { key: 'players_locked', value: { locked: false, reason: '' }, campaign_id: newCampaign.id },
        { key: 'landing_subtitle', value: { text: '' }, campaign_id: newCampaign.id },
      ]);

      // Create default map_settings for this campaign
      await supabase.from('map_settings').insert({
        campaign_id: newCampaign.id,
      });

      await refreshCampaigns();
      return newCampaign;
    } catch (err: any) {
      console.error('Error creating campaign:', err);
      alert('Failed to create campaign: ' + err.message);
      return null;
    }
  };

  // ── Join a campaign via invite code ──
  const joinCampaign = async (inviteCode: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not logged in' };

    try {
      // Find campaign by invite code
      const { data: foundCampaign, error: findError } = await supabase
        .from('campaigns')
        .select('id, name')
        .eq('invite_code', inviteCode.trim().toLowerCase())
        .eq('is_active', true)
        .single();

      if (findError || !foundCampaign) {
        return { success: false, error: 'Invalid invite code' };
      }

      // Check if already a member
      const { data: existing } = await supabase
        .from('campaign_members')
        .select('id')
        .eq('campaign_id', foundCampaign.id)
        .eq('user_id', user.id)
        .single();

      if (existing) {
        return { success: false, error: 'Already a member of this campaign' };
      }

      // Join as player
      const { error: joinError } = await supabase.from('campaign_members').insert({
        campaign_id: foundCampaign.id,
        user_id: user.id,
        role: 'player',
      });

      if (joinError) throw joinError;

      await refreshCampaigns();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // ── Update the current campaign's theme ──
  const updateTheme = async (themeUpdates: Partial<CampaignTheme>) => {
    if (!campaign?.theme_id) return;

    try {
      const { error } = await supabase
        .from('campaign_themes')
        .update(themeUpdates)
        .eq('id', campaign.theme_id);

      if (error) throw error;

      // Apply locally
      const updatedTheme = { ...(theme || DEFAULT_THEME), ...themeUpdates };
      setTheme(updatedTheme);
      applyTheme(updatedTheme);

      // Update campaign in list
      setCampaigns(prev => prev.map(c =>
        c.id === campaign.id
          ? { ...c, theme: updatedTheme }
          : c
      ));
      setCampaign(prev => prev ? { ...prev, theme: updatedTheme } : null);
    } catch (err: any) {
      console.error('Error updating theme:', err);
      alert('Failed to update theme: ' + err.message);
    }
  };

  const value: CampaignContextType = {
    campaign,
    campaignId,
    campaignRole,
    theme,
    campaigns,
    campaignsLoading,
    showingSplash,
    selectCampaign,
    leaveCampaign,
    createCampaign,
    joinCampaign,
    updateTheme,
    refreshCampaigns,
  };

  return <CampaignContext.Provider value={value}>{children}</CampaignContext.Provider>;
}

export function useCampaign() {
  const context = useContext(CampaignContext);
  if (context === undefined) {
    throw new Error('useCampaign must be used within a CampaignProvider');
  }
  return context;
}
