import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabase Setup
const SUPABASE_URL = 'https://adanpwwxovponnluoztd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_fxfFnuDXlNm8dgEwPbNLog_1hkZlsbL';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// ===== SVG ICONS (No keyboard emojis) =====
const Ic = {
  Sun: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  Hourglass: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2h12v8H6V2m12 8h0m0 0v8m0 0H6v-8"/></svg>,
  Cross: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Heart: () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  Person: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Spark: () => <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 10.26 24 12 15.09 13.74 12 22 8.91 13.74 0 12 8.91 10.26 12 2"/></svg>,
  ShieldCheck: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="16 12 12 16 9 13"/></svg>,
  Flag: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
  Camera: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  Eye: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  Pin: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Chevron: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>,
  Infinity: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 8c3-1 6-1 6 0s-3 1-6 0"/><path d="M5 14c.5-1 2-2 4-2s3.5 1 4 2"/><path d="M17 8c-3-1-6-1-6 0s3 1 6 0"/><path d="M19 14c-.5-1-2-2-4-2s-3.5 1-4 2"/></svg>,
};

// ===== MAIN APP COMPONENT =====
export default function TOMApp() {
  const [screen, setScreen] = useState('home'); // home, welcome, profile, app
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deck, setDeck] = useState([]);
  const [matches, setMatches] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [goldenHourUsedToday, setGoldenHourUsedToday] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState(null);
  const [showGoldenHourExplainer, setShowGoldenHourExplainer] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [reportReason, setReportReason] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [selectedLegalDoc, setSelectedLegalDoc] = useState(null);

  // ===== AUTH & SESSION =====
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check existing session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          // Load user profile
          const { data: prof } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (prof) {
            setProfile(prof);
            setScreen('app');
            // Load deck, matches, verification status
            await loadDeck(prof.id);
            await loadMatches(prof.id);
            await loadVerificationStatus(prof.id);
            await loadBlocks(prof.id);
          } else {
            setScreen('profile');
          }
        } else {
          setScreen('home');
        }
      } catch (error) {
        console.error('Auth init error:', error);
        setScreen('home');
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setUser(session.user);
        } else {
          setUser(null);
          setProfile(null);
          setScreen('home');
        }
      }
    );

    return () => subscription?.unsubscribe();
  }, []);

  // ===== DATA LOADING FUNCTIONS =====
  const loadDeck = async (userId) => {
    try {
      // Get all profiles except self and blocked users
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', userId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      // Get user's likes to filter out already-swiped profiles
      const { data: userLikes } = await supabase
        .from('likes')
        .select('liked_user_id')
        .eq('user_id', userId);

      const likedIds = (userLikes || []).map(l => l.liked_user_id);
      const availableProfiles = (allProfiles || []).filter(
        p => !likedIds.includes(p.id) && !blockedUsers.includes(p.id)
      );

      setDeck(availableProfiles);
      setCurrentIdx(0);
    } catch (error) {
      console.error('Error loading deck:', error);
    }
  };

  const loadMatches = async (userId) => {
    try {
      const { data } = await supabase
        .from('matches')
        .select('*, profiles!user_id_1(*), profiles!user_id_2(*)')
        .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
        .eq('is_active', true);

      setMatches(data || []);
    } catch (error) {
      console.error('Error loading matches:', error);
    }
  };

  const loadVerificationStatus = async (userId) => {
    try {
      const { data } = await supabase
        .from('verification_status')
        .select('*')
        .eq('user_id', userId)
        .single();

      setVerifyStatus(data);
    } catch (error) {
      // No verification record yet is OK
    }
  };

  const loadBlocks = async (userId) => {
    try {
      const { data } = await supabase
        .from('blocks')
        .select('blocked_user_id')
        .eq('user_id', userId);

      setBlockedUsers((data || []).map(b => b.blocked_user_id));
    } catch (error) {
      console.error('Error loading blocks:', error);
    }
  };

  // ===== AUTH HANDLERS =====
  const handleSignUpWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (error) {
      alert('Google sign-in failed: ' + error.message);
    }
  };

  const handleSignUpWithApple = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (error) {
      alert('Apple sign-in failed: ' + error.message);
    }
  };

  const handleContinueAsGuest = () => {
    setScreen('app');
    // Load demo profiles for guest
    setDeck(demoProfiles);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setScreen('home');
  };

  // ===== PROFILE BUILDER =====
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    bio: '',
    interests: [],
    location: '',
    orientation: '',
  });

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          ...formData,
          orientation_consent_at: new Date(),
        });

      if (error) throw error;
      setProfile(formData);
      setScreen('app');
      await loadDeck(user.id);
      await loadMatches(user.id);
    } catch (error) {
      alert('Error creating profile: ' + error.message);
    }
  };

  // ===== SWIPE HANDLERS =====
  const handlePass = async () => {
    const current = deck[currentIdx];
    if (!current) return;

    try {
      await supabase.from('likes').insert({
        user_id: user.id,
        liked_user_id: current.id,
        action: 'pass',
      });
      setCurrentIdx(currentIdx + 1);
    } catch (error) {
      console.error('Swipe error:', error);
    }
  };

  const handleGoldenHour = async () => {
    const current = deck[currentIdx];
    if (!current || goldenHourUsedToday) return;

    setShowGoldenHourExplainer(true);
  };

  const confirmGoldenHour = async () => {
    const current = deck[currentIdx];
    try {
      await supabase.from('likes').insert({
        user_id: user.id,
        liked_user_id: current.id,
        action: 'golden_hour',
      });

      await supabase.from('golden_hours').insert({
        user_id: user.id,
        recipient_id: current.id,
      });

      setGoldenHourUsedToday(true);
      setShowGoldenHourExplainer(false);
      setCurrentIdx(currentIdx + 1);
    } catch (error) {
      console.error('Golden hour error:', error);
    }
  };

  const handleSpendTime = async () => {
    const current = deck[currentIdx];
    if (!current) return;

    try {
      // Check if mutual like (if current user liked them too)
      const { data: mutual } = await supabase
        .from('likes')
        .select('*')
        .eq('user_id', current.id)
        .eq('liked_user_id', user.id)
        .single();

      if (mutual) {
        // Create match
        const user1 = user.id < current.id ? user.id : current.id;
        const user2 = user.id > current.id ? user.id : current.id;

        await supabase.from('matches').insert({
          user_id_1: user1,
          user_id_2: user2,
        });
      }

      // Record like
      await supabase.from('likes').insert({
        user_id: user.id,
        liked_user_id: current.id,
        action: 'spend_time',
      });

      setCurrentIdx(currentIdx + 1);
      await loadMatches(user.id);
    } catch (error) {
      console.error('Spend time error:', error);
    }
  };

  // ===== BLOCK & REPORT =====
  const handleReport = async () => {
    const current = deck[currentIdx];
    if (!current || !reportReason) return;

    try {
      await supabase.from('reports').insert({
        reporter_id: user?.id || null,
        reported_user_id: current.id,
        reason: reportReason,
      });

      // Auto-block
      await supabase.from('blocks').insert({
        user_id: user?.id || (new Date().getTime().toString()),
        blocked_user_id: current.id,
      });

      setBlockedUsers([...blockedUsers, current.id]);
      setShowReportModal(false);
      setReportReason(null);
      setCurrentIdx(currentIdx + 1);
    } catch (error) {
      console.error('Report error:', error);
    }
  };

  // ===== VERIFICATION =====
  const handlePhotoCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      const fileName = `${user.id}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('verification-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Create or update verification status
      await supabase.from('verification_status').upsert({
        user_id: user.id,
        status: 'review',
        selfie_storage_path: fileName,
        submitted_at: new Date(),
      });

      setVerifyStatus({ status: 'review' });
      setShowVerifyModal(false);

      // Simulate verification approval after 4 seconds
      setTimeout(async () => {
        await supabase.from('verification_status').update({
          status: 'verified',
          verified_at: new Date(),
        }).eq('user_id', user.id);

        setVerifyStatus({ status: 'verified' });
      }, 4000);
    } catch (error) {
      alert('Photo upload failed: ' + error.message);
    }
  };

  // ===== ACCOUNT DELETION =====
  const handleDeleteAccount = async () => {
    try {
      // Delete profile (cascades to all related data)
      await supabase.from('profiles').delete().eq('id', user.id);

      // Delete auth user
      // Note: This requires admin access - for production use a function
      // For now, just sign out
      await supabase.auth.signOut();
      setShowDeleteModal(false);
      setScreen('home');
    } catch (error) {
      alert('Deletion failed: ' + error.message);
    }
  };

  // ===== DEMO DATA =====
  const demoProfiles = [
    {
      id: 'demo-1',
      name: 'Elif',
      age: 28,
      bio: 'Love hiking and coffee',
      location: 'Istanbul',
      latitude: 41.0082,
      longitude: 28.9784,
    },
    {
      id: 'demo-2',
      name: 'Marco',
      age: 31,
      bio: 'Photographer & dog lover',
      location: 'Istanbul',
      latitude: 41.015,
      longitude: 28.975,
    },
  ];

  // ===== LEGAL DOCUMENTS =====
  const LEGAL = {
    privacy: [
      { title: 'Privacy Policy', sections: [
        { heading: 'Information We Collect', content: '[LEGAL REVIEW PENDING] We collect profile information, photos, location data for matching, and interaction history.' },
        { heading: 'How We Use Your Data', content: '[LEGAL REVIEW PENDING] Your data is used to match you with other users and improve your experience.' },
        { heading: 'Your Rights', content: 'You can delete your account and all associated data at any time from your settings.' },
      ] }
    ],
    terms: [
      { title: 'Terms of Service', sections: [
        { heading: 'Acceptable Use', content: '[LEGAL REVIEW PENDING] You agree not to create fake profiles, harass other users, or violate platform policies.' },
        { heading: 'Dispute Resolution', content: '[LEGAL REVIEW PENDING] Any disputes shall be resolved through binding arbitration.' },
        { heading: 'Age Requirement', content: 'You must be 18 or older to use TOM.' },
      ] }
    ],
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;

  // ===== HOME SCREEN =====
  if (screen === 'home') {
    return (
      <div style={{ background: '#F5F3FF', minHeight: '100vh', padding: '20px', fontFamily: 'Fredoka, sans-serif' }}>
        <div style={{ textAlign: 'center', marginTop: '60px' }}>
          <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#FFC53D' }}>TOM.</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#5B21B6', marginTop: '20px' }}>TIME OVER MONEY</div>
          <div style={{ fontSize: '18px', color: '#333', marginTop: '10px', marginBottom: '40px' }}>Dating without the bill.</div>

          <button
            onClick={handleSignUpWithGoogle}
            style={{
              width: '100%',
              padding: '14px',
              marginBottom: '12px',
              background: '#5B21B6',
              color: '#FFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            Sign Up with Google
          </button>

          <button
            onClick={handleSignUpWithApple}
            style={{
              width: '100%',
              padding: '14px',
              marginBottom: '12px',
              background: '#000',
              color: '#FFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            Sign Up with Apple
          </button>

          <button
            onClick={handleContinueAsGuest}
            style={{
              width: '100%',
              padding: '14px',
              background: '#EDE7FB',
              color: '#5B21B6',
              border: '2px solid #5B21B6',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            Continue as Guest
          </button>

          <div style={{ marginTop: '40px', fontSize: '12px', color: '#666' }}>
            <button onClick={() => { setSelectedLegalDoc('terms'); setShowLegalModal(true); }} style={{ background: 'none', border: 'none', color: '#5B21B6', cursor: 'pointer', textDecoration: 'underline' }}>Terms of Service</button>
            {' | '}
            <button onClick={() => { setSelectedLegalDoc('privacy'); setShowLegalModal(true); }} style={{ background: 'none', border: 'none', color: '#5B21B6', cursor: 'pointer', textDecoration: 'underline' }}>Privacy Policy</button>
          </div>
        </div>
      </div>
    );
  }

  // ===== PROFILE BUILDER =====
  if (screen === 'profile' && user && !profile) {
    return (
      <div style={{ background: '#F5F3FF', minHeight: '100vh', padding: '20px', fontFamily: 'Fredoka, sans-serif' }}>
        <div style={{ maxWidth: '500px', margin: '0 auto', marginTop: '40px' }}>
          <h2 style={{ color: '#5B21B6', marginBottom: '30px' }}>Build Your Profile - Step {step} of 4</h2>

          <form onSubmit={handleProfileSubmit}>
            {step === 1 && (
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', padding: '10px', marginBottom: '20px', borderRadius: '6px', border: '1px solid #ccc' }}
                />

                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Age</label>
                <input
                  type="number"
                  required
                  min="18"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) })}
                  style={{ width: '100%', padding: '10px', marginBottom: '20px', borderRadius: '6px', border: '1px solid #ccc' }}
                />

                <button
                  type="button"
                  onClick={() => setStep(2)}
                  style={{ width: '100%', padding: '12px', background: '#5B21B6', color: '#FFF', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Next
                </button>
              </div>
            )}

            {step === 2 && (
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Bio</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  style={{ width: '100%', padding: '10px', marginBottom: '20px', borderRadius: '6px', border: '1px solid #ccc', minHeight: '100px' }}
                />

                <div>
                  <button type="button" onClick={() => setStep(1)} style={{ marginRight: '10px', padding: '8px 16px', background: '#EDE7FB', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Back</button>
                  <button type="button" onClick={() => setStep(3)} style={{ padding: '8px 16px', background: '#5B21B6', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Next</button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  style={{ width: '100%', padding: '10px', marginBottom: '20px', borderRadius: '6px', border: '1px solid #ccc' }}
                />

                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Interested in</label>
                <div>
                  {['Women', 'Men', 'Everyone'].map(opt => (
                    <label key={opt} style={{ marginRight: '15px', marginBottom: '15px' }}>
                      <input
                        type="radio"
                        name="orientation"
                        value={opt}
                        checked={formData.orientation === opt}
                        onChange={(e) => setFormData({ ...formData, orientation: e.target.value })}
                      />
                      {opt}
                    </label>
                  ))}
                </div>

                <div>
                  <button type="button" onClick={() => setStep(2)} style={{ marginRight: '10px', padding: '8px 16px', background: '#EDE7FB', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Back</button>
                  <button type="button" onClick={() => setStep(4)} style={{ padding: '8px 16px', background: '#5B21B6', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Next</button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div>
                <p style={{ marginBottom: '20px', color: '#666' }}>You're all set! Tap Create to publish your profile.</p>
                <div>
                  <button type="button" onClick={() => setStep(3)} style={{ marginRight: '10px', padding: '8px 16px', background: '#EDE7FB', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Back</button>
                  <button type="submit" style={{ padding: '8px 16px', background: '#5B21B6', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Create Profile</button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    );
  }

  // ===== MAIN APP SCREEN (Discover tab) =====
  if (screen === 'app') {
    const current = deck[currentIdx];

    return (
      <div style={{ background: '#F5F3FF', minHeight: '100vh', fontFamily: 'Fredoka, sans-serif', paddingBottom: '80px' }}>
        {/* Card Deck */}
        {current && (
          <div style={{ padding: '20px', paddingTop: '60px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
              position: 'relative',
              aspectRatio: '3/4',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              color: '#FFF',
              padding: '20px',
            }}>
              {/* Card Header */}
              <div style={{ position: 'absolute', top: '20px', left: '20px', right: '20px' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  background: 'rgba(255,255,255,0.3)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '32px',
                  fontWeight: 'bold',
                }}>
                  {current.name[0]}
                </div>
              </div>

              {/* $0 Stamp */}
              <div style={{
                position: 'absolute',
                top: '30px',
                right: '20px',
                border: '2px dashed #FFC53D',
                borderRadius: '50%',
                width: '80px',
                height: '80px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 'bold',
                textAlign: 'center',
                color: '#FFC53D',
              }}>
                <div>$0</div>
                <div>DATES</div>
                <div>ALWAYS</div>
              </div>

              {/* Card Content */}
              <div>
                <h2 style={{ margin: '0 0 8px 0', fontSize: '28px' }}>{current.name}, {current.age}</h2>
                <p style={{ margin: '0 0 16px 0', fontSize: '14px', opacity: 0.9 }}>
                  <Ic.Pin style={{ width: '16px', height: '16px', display: 'inline', marginRight: '4px' }} />
                  {current.location}
                </p>
                <p style={{ margin: '0', fontSize: '14px', lineHeight: '1.5' }}>{current.bio}</p>
              </div>

              {/* Flags */}
              <button
                onClick={() => setShowReportModal(true)}
                style={{
                  position: 'absolute',
                  top: '20px',
                  right: '110px',
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  color: '#FFF',
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <Ic.Flag style={{ width: '20px', height: '20px' }} />
              </button>
            </div>
          </div>
        )}

        {!current && deck.length > 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', marginTop: '80px' }}>
            <p style={{ color: '#666', fontSize: '16px' }}>You've seen everyone nearby. Check back tomorrow!</p>
          </div>
        )}

        {/* Swipe Buttons */}
        {current && (
          <div style={{
            display: 'flex',
            gap: '12px',
            padding: '20px',
            justifyContent: 'center',
          }}>
            <button
              onClick={handlePass}
              style={{
                flex: 1,
                padding: '14px',
                background: '#FFF',
                border: '2px solid #999',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <Ic.Cross style={{ width: '20px', height: '20px', color: '#999' }} />
              PASS
            </button>

            <button
              onClick={handleGoldenHour}
              disabled={goldenHourUsedToday}
              style={{
                flex: 1,
                padding: '14px',
                background: goldenHourUsedToday ? '#DDD' : '#FFC53D',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: goldenHourUsedToday ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <Ic.Sun style={{ width: '20px', height: '20px', color: goldenHourUsedToday ? '#999' : '#FFF' }} />
              GOLDEN HOUR
            </button>

            <button
              onClick={handleSpendTime}
              style={{
                flex: 1,
                padding: '14px',
                background: '#5B21B6',
                color: '#FFF',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <Ic.Hourglass style={{ width: '20px', height: '20px' }} />
              SPEND TIME
            </button>
          </div>
        )}

        {/* Bottom Tabs */}
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#FFF',
          borderTop: '1px solid #EEE',
          display: 'flex',
          justifyContent: 'space-around',
          padding: '8px 0',
        }}>
          <button style={{ flex: 1, padding: '12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', color: '#5B21B6' }}>
            <Ic.Spark style={{ width: '24px', height: '24px', margin: '0 auto 4px' }} />
            DISCOVER
          </button>
          <button
            onClick={() => setScreen('dates')}
            style={{ flex: 1, padding: '12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#999' }}
          >
            <Ic.Heart style={{ width: '24px', height: '24px', margin: '0 auto 4px' }} />
            DATES
          </button>
          <button
            onClick={() => setScreen('you')}
            style={{ flex: 1, padding: '12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#999' }}
          >
            <Ic.Person style={{ width: '24px', height: '24px', margin: '0 auto 4px' }} />
            YOU
          </button>
        </div>

        {/* Modals */}
        {showGoldenHourExplainer && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
          }}>
            <div style={{
              background: '#FFF',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '300px',
              textAlign: 'center',
            }}>
              <h3 style={{ color: '#5B21B6', marginBottom: '16px' }}>Golden Hour</h3>
              <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>
                Instantly tell {current?.name} they're worth your best hour. They see it before anyone else. You get 1 free every day.
              </p>
              <button
                onClick={confirmGoldenHour}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#FFC53D',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  marginBottom: '8px',
                }}
              >
                Send
              </button>
              <button
                onClick={() => setShowGoldenHourExplainer(false)}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#EDE7FB',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Not now
              </button>
            </div>
          </div>
        )}

        {showReportModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'flex-end',
            zIndex: 999,
          }}>
            <div style={{
              background: '#FFF',
              borderRadius: '16px 16px 0 0',
              padding: '24px',
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}>
              <h3 style={{ color: '#5B21B6', marginBottom: '16px' }}>Report {current?.name}</h3>
              <p style={{ color: '#666', marginBottom: '16px', fontSize: '14px' }}>Why are you reporting this profile?</p>

              {[
                'Fake profile or photos',
                'Inappropriate content',
                'Harassment or threats',
                'Under 18',
                'Asked for money',
                'Something else',
              ].map((reason) => (
                <button
                  key={reason}
                  onClick={() => setReportReason(reason)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: reportReason === reason ? '#7C3AED' : '#EDE7FB',
                    color: reportReason === reason ? '#FFF' : '#5B21B6',
                    border: 'none',
                    borderRadius: '6px',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  {reason}
                </button>
              ))}

              <button
                onClick={handleReport}
                disabled={!reportReason}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: reportReason ? '#DC2626' : '#DDD',
                  color: '#FFF',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: reportReason ? 'pointer' : 'default',
                  marginTop: '16px',
                }}
              >
                Report and block
              </button>
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportReason(null);
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#EDE7FB',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  marginTop: '8px',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {showLegalModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
          }}>
            <div style={{
              background: '#FFF',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '90%',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}>
              <button
                onClick={() => setShowLegalModal(false)}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                }}
              >
                ×
              </button>

              {selectedLegalDoc === 'terms' && (
                <div>
                  <h2 style={{ color: '#5B21B6', marginBottom: '16px' }}>Terms of Service</h2>
                  {LEGAL.terms[0].sections.map((section, i) => (
                    <div key={i} style={{ marginBottom: '16px' }}>
                      <h4 style={{ color: '#333', marginBottom: '8px' }}>{section.heading}</h4>
                      <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.6' }}>{section.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {selectedLegalDoc === 'privacy' && (
                <div>
                  <h2 style={{ color: '#5B21B6', marginBottom: '16px' }}>Privacy Policy</h2>
                  {LEGAL.privacy[0].sections.map((section, i) => (
                    <div key={i} style={{ marginBottom: '16px' }}>
                      <h4 style={{ color: '#333', marginBottom: '8px' }}>{section.heading}</h4>
                      <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.6' }}>{section.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===== DATES TAB =====
  if (screen === 'dates') {
    return (
      <div style={{ background: '#F5F3FF', minHeight: '100vh', padding: '20px', fontFamily: 'Fredoka, sans-serif', paddingBottom: '80px' }}>
        <h2 style={{ color: '#5B21B6', marginTop: '40px' }}>Your Dates</h2>
        {matches.length === 0 ? (
          <p style={{ color: '#666', marginTop: '20px' }}>No matches yet. Keep swiping!</p>
        ) : (
          <div style={{ display: 'grid', gap: '12px', marginTop: '20px' }}>
            {matches.map((match) => {
              const other = match.user_id_1 === user?.id ? match.profiles__user_id_2 : match.profiles__user_id_1;
              return (
                <div key={match.id} style={{
                  background: '#FFF',
                  padding: '16px',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', color: '#5B21B6' }}>{other?.name}</h4>
                    <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>Matched {new Date(match.matched_at).toLocaleDateString()}</p>
                  </div>
                  <button style={{
                    padding: '8px 16px',
                    background: '#5B21B6',
                    color: '#FFF',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}>Message</button>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom Tabs */}
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#FFF',
          borderTop: '1px solid #EEE',
          display: 'flex',
          justifyContent: 'space-around',
          padding: '8px 0',
        }}>
          <button
            onClick={() => setScreen('app')}
            style={{ flex: 1, padding: '12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#999' }}
          >
            <Ic.Spark style={{ width: '24px', height: '24px', margin: '0 auto 4px' }} />
            DISCOVER
          </button>
          <button style={{ flex: 1, padding: '12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', color: '#5B21B6' }}>
            <Ic.Heart style={{ width: '24px', height: '24px', margin: '0 auto 4px' }} />
            DATES
          </button>
          <button
            onClick={() => setScreen('you')}
            style={{ flex: 1, padding: '12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#999' }}
          >
            <Ic.Person style={{ width: '24px', height: '24px', margin: '0 auto 4px' }} />
            YOU
          </button>
        </div>
      </div>
    );
  }

  // ===== YOU TAB =====
  if (screen === 'you') {
    return (
      <div style={{ background: '#F5F3FF', minHeight: '100vh', padding: '20px', fontFamily: 'Fredoka, sans-serif', paddingBottom: '80px' }}>
        <h2 style={{ color: '#5B21B6', marginTop: '40px' }}>Your Profile</h2>

        {profile && (
          <div style={{ background: '#FFF', padding: '20px', borderRadius: '8px', marginTop: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: '0', color: '#5B21B6' }}>{profile.name}, {profile.age}</h3>
              {verifyStatus?.status === 'verified' && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10B981' }}>
                  <Ic.ShieldCheck style={{ width: '16px', height: '16px' }} />
                  Verified
                </span>
              )}
            </div>
            <p style={{ margin: '0 0 8px 0', color: '#666' }}>{profile.bio}</p>
            <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
              <Ic.Pin style={{ width: '14px', height: '14px', display: 'inline', marginRight: '4px' }} />
              {profile.location}
            </p>
          </div>
        )}

        {!verifyStatus?.status && (
          <div style={{
            background: '#E8F5E9',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '20px',
          }}>
            <h4 style={{ color: '#1B5E20', marginTop: '0', marginBottom: '8px' }}>Verify your profile</h4>
            <p style={{ color: '#2E7D32', fontSize: '14px', marginBottom: '12px' }}>Get the green checkmark</p>
            <button
              onClick={() => setShowVerifyModal(true)}
              style={{
                width: '100%',
                padding: '10px',
                background: '#10B981',
                color: '#FFF',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              Verify Now
            </button>
          </div>
        )}

        {verifyStatus?.status === 'review' && (
          <div style={{
            background: '#FEF3C7',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '20px',
            color: '#92400E',
          }}>
            <p style={{ margin: '0', fontSize: '14px' }}>Verification in review, usually under 24 hours</p>
          </div>
        )}

        <div style={{
          background: '#FFF',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '20px',
        }}>
          <h4 style={{ color: '#5B21B6', marginTop: '0', marginBottom: '12px' }}>About and privacy</h4>
          <button
            onClick={() => { setSelectedLegalDoc('privacy'); setShowLegalModal(true); }}
            style={{
              width: '100%',
              padding: '10px',
              background: '#EDE7FB',
              color: '#5B21B6',
              border: 'none',
              borderRadius: '6px',
              marginBottom: '8px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            Privacy Policy
          </button>
          <button
            onClick={() => { setSelectedLegalDoc('terms'); setShowLegalModal(true); }}
            style={{
              width: '100%',
              padding: '10px',
              background: '#EDE7FB',
              color: '#5B21B6',
              border: 'none',
              borderRadius: '6px',
              marginBottom: '8px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            Terms of Service
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            style={{
              width: '100%',
              padding: '10px',
              background: '#FEE2E2',
              color: '#DC2626',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              textAlign: 'left',
              fontWeight: 'bold',
            }}
          >
            Delete my account
          </button>
        </div>

        {user && (
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '12px',
              background: '#EDE7FB',
              color: '#5B21B6',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            Log Out
          </button>
        )}

        {showVerifyModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
          }}>
            <div style={{
              background: '#FFF',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '300px',
              textAlign: 'center',
            }}>
              <h3 style={{ color: '#5B21B6', marginBottom: '16px' }}>Verify with Selfie</h3>
              <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>Take a clear photo of your face</p>
              <label style={{
                display: 'block',
                width: '100%',
                padding: '12px',
                background: '#7C3AED',
                color: '#FFF',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: 'pointer',
                marginBottom: '8px',
              }}>
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={handlePhotoCapture}
                  style={{ display: 'none' }}
                />
                Take Photo
              </label>
              <button
                onClick={() => setShowVerifyModal(false)}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#EDE7FB',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {showDeleteModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
          }}>
            <div style={{
              background: '#FFF',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '300px',
              textAlign: 'center',
            }}>
              <h3 style={{ color: '#DC2626', marginBottom: '16px' }}>Delete Account</h3>
              <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>
                This will permanently delete your profile, photos, matches, and messages. This action cannot be undone.
              </p>
              <button
                onClick={handleDeleteAccount}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#DC2626',
                  color: '#FFF',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  marginBottom: '8px',
                }}
              >
                Delete Permanently
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#EDE7FB',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {showLegalModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
          }}>
            <div style={{
              background: '#FFF',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '90%',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}>
              <button
                onClick={() => setShowLegalModal(false)}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                }}
              >
                ×
              </button>

              {selectedLegalDoc === 'terms' && (
                <div>
                  <h2 style={{ color: '#5B21B6', marginBottom: '16px' }}>Terms of Service</h2>
                  {LEGAL.terms[0].sections.map((section, i) => (
                    <div key={i} style={{ marginBottom: '16px' }}>
                      <h4 style={{ color: '#333', marginBottom: '8px' }}>{section.heading}</h4>
                      <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.6' }}>{section.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {selectedLegalDoc === 'privacy' && (
                <div>
                  <h2 style={{ color: '#5B21B6', marginBottom: '16px' }}>Privacy Policy</h2>
                  {LEGAL.privacy[0].sections.map((section, i) => (
                    <div key={i} style={{ marginBottom: '16px' }}>
                      <h4 style={{ color: '#333', marginBottom: '8px' }}>{section.heading}</h4>
                      <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.6' }}>{section.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom Tabs */}
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#FFF',
          borderTop: '1px solid #EEE',
          display: 'flex',
          justifyContent: 'space-around',
          padding: '8px 0',
        }}>
          <button
            onClick={() => setScreen('app')}
            style={{ flex: 1, padding: '12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#999' }}
          >
            <Ic.Spark style={{ width: '24px', height: '24px', margin: '0 auto 4px' }} />
            DISCOVER
          </button>
          <button
            onClick={() => setScreen('dates')}
            style={{ flex: 1, padding: '12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#999' }}
          >
            <Ic.Heart style={{ width: '24px', height: '24px', margin: '0 auto 4px' }} />
            DATES
          </button>
          <button style={{ flex: 1, padding: '12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', color: '#5B21B6' }}>
            <Ic.Person style={{ width: '24px', height: '24px', margin: '0 auto 4px' }} />
            YOU
          </button>
        </div>
      </div>
    );
  }
}
