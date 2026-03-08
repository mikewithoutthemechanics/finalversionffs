import { useState, useEffect, Suspense, lazy, Component, ReactNode, useRef } from 'react';
import { User, AppState, Class, Registration, Venue, Template, AppSettings, WaiverData, AdminRole, ChatMessage, Teacher, InjuryRecord, Disclaimer, GoogleCalendarTokens } from './types';

// Auto-logout after 5 minutes of inactivity
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Server-side user sync to bypass RLS
const syncUserToServer = async (user: User): Promise<void> => {
  try {
    const response = await fetch('/api/user/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user })
    });
    if (!response.ok) {
      console.error('[syncUserToServer] failed:', response.statusText);
    }
  } catch (err) {
    console.error('[syncUserToServer] error:', err);
  }
};

// Lazy load large screens for code splitting
const AdminApp = lazy(() => import('./screens/AdminApp').then(module => ({ default: module.AdminApp })));
const TeacherApp = lazy(() => import('./screens/TeacherApp').then(module => ({ default: module.TeacherApp })));
const ClientApp = lazy(() => import('./screens/ClientApp').then(module => ({ default: module.ClientApp })));
const OnboardingScreen = lazy(() => import('./screens/OnboardingScreen').then(module => ({ default: module.OnboardingScreen })));
const InviteLandingPage = lazy(() => import('./screens/InviteLandingPage').then(module => ({ default: module.InviteLandingPage })));

// Lazy load heavy components
const ShaderShowcaseLazy = lazy(() => import('./screens/ShaderShowcase').then(module => ({ default: module.ShaderShowcase })));

const ClientLoginScreenLazy = lazy(() => import('./screens/ClientLoginScreen').then(module => ({ default: module.ClientLoginScreen })));
const TeacherLoginScreenLazy = lazy(() => import('./screens/TeacherLoginScreen').then(module => ({ default: module.TeacherLoginScreen })));
const AdminLoginScreenLazy = lazy(() => import('./screens/AdminLoginScreen').then(module => ({ default: module.AdminLoginScreen })));
const AuthLandingLazy = lazy(() => import('./screens/AuthLanding').then(module => ({ default: module.AuthLanding })));

// Loading fallback for lazy-loaded components
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-[#FBF7EF]">
    <div className="flex flex-col items-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#6E7568] mb-4"></div>
      <p className="text-[#6E7568] text-sm font-medium">Loading...</p>
    </div>
  </div>
);

// Loading spinner component for inline use
const InlineLoading = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6E7568]"></div>
  </div>
);

// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center min-h-screen bg-[#FBF7EF]">
          <div className="flex flex-col items-center p-8">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-[#6E7568] mb-2">Something went wrong</h2>
            <p className="text-sm text-[#6E7568] mb-4">Please refresh the page to try again.</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-[#6E7568] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#5a6358] transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Keep these as regular imports (lightweight)
import { db } from './services/db-supabase';
import { ToastProvider } from './components/Toast';
import { getCurrentUser, onAuthStateChange, signOut, isSupabaseConfigured } from './lib/supabase';

const DEFAULT_SETTINGS: AppSettings = {
  appName: 'Pause Fascia Movement',
  contactEmail: 'admin@pausefmd.co.za',
  additionalContactEmails: [],
  zapperQrBase64: '',
  landingPage: {
    headerText: 'where fascia becomes FLUID',
    subheaderText: 'Step into the Dome',
    expectations: []
  },
  email: {
    provider: 'mock',
    apiKey: '',
    senderName: 'Pause Admin',
    senderEmail: 'hello@pausefmd.co.za',
    waitlistTemplate: ''
  },
  googleCalendarSyncEnabled: false
};

export default function App() {
  const [appState, setAppState] = useState<AppState>("signin");
  const [authScreen, setAuthScreen] = useState<'landing' | 'client' | 'teacher' | 'admin'>('landing');
  const [user, setUser] = useState<User | null>(null);
  
  // --- Global Data State (Hydrated from DB) ---
  const [classes, setClasses] = useState<Class[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [disclaimers, setDisclaimers] = useState<Disclaimer[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [users, setUsers] = useState<User[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  const [showLandingPreview, setShowLandingPreview] = useState<boolean>(false);
  const [showShaderPreview, setShowShaderPreview] = useState<boolean>(false);
  const [referrerName, setReferrerName] = useState<string | null>(null);
  
  // Chat state - loaded from Supabase
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  
  // Load chat messages from Supabase on mount
  useEffect(() => {
    if (user) {
      // Chat messages loaded via ChatWidget component
    }
  }, [user]);
  
  // Save new chat messages to Supabase
  useEffect(() => {
    // This effect handles syncing - no localStorage needed
  }, [chatMessages]);

  // Chat handlers
  const handleSendChatMessage = async (content: string, recipientId?: string) => {
    if (!user) return;
    
    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: user.id,
      senderName: user.name,
      senderRole: user.isAdmin ? 'admin' : 'client',
      recipientId: recipientId || 'admin',
      content,
      timestamp: new Date().toISOString(),
      read: false
    };
    
    // Update local state (persisted via ChatWidget)
    setChatMessages(prev => [...prev, newMessage]);
  };
  
  const getUnreadChatCount = () => {
    if (!user) return 0;
    return chatMessages.filter(m => m.recipientId === user.id && !m.read).length;
  };

  // Auto-logout after 1 minute of inactivity
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);

  const resetInactivityTimer = () => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    if (user) {
      inactivityTimer.current = setTimeout(() => {
        handleSignOut();
      }, INACTIVITY_TIMEOUT);
    }
  };

  useEffect(() => {
    if (user) {
      // Reset timer on user activity
      const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
      events.forEach(event => {
        document.addEventListener(event, resetInactivityTimer);
      });
      
      // Start the timer
      resetInactivityTimer();
      
      return () => {
        events.forEach(event => {
          document.removeEventListener(event, resetInactivityTimer);
        });
        if (inactivityTimer.current) {
          clearTimeout(inactivityTimer.current);
        }
      };
    }
  }, [user]);

  // --- Load Data from Supabase on Mount ---
  useEffect(() => {
    const loadData = async () => {
      try {
        // PERF: Use paginated loaders for large tables (users, classes) to avoid
        // pulling unbounded row counts into memory on every app load.
        // Other tables (venues, templates, disclaimers, teachers, settings) are
        // small/bounded and are still fetched in full — no pagination needed.
        const [
          classesResult,
          registrationsData,
          venuesData,
          templatesData,
          disclaimersData,
          usersResult,
          teachersData,
          settingsData
        ] = await Promise.all([
          db.getClassesPaginated(1, 100),   // first 100 classes — covers any real schedule
          db.getRegistrations(),
          db.getVenues(),
          db.getTemplates(),
          db.getDisclaimers(),
          db.getUsersPaginated(1, 200),      // first 200 users — sufficient for admin views
          db.getTeachers(),
          db.getSettings()
        ]);
        
        setClasses(classesResult.classes);
        setRegistrations(registrationsData);
        setVenues(venuesData);
        setTemplates(templatesData);
        setDisclaimers(disclaimersData);
        setUsers(usersResult.users);
        setTeachers(teachersData);
        if (settingsData) setSettings(settingsData);
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  // --- Check for Landing Preview Mode ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('preview') === 'landing') {
      setShowLandingPreview(true);
    }
    if (params.get('preview') === 'shader') {
      setShowShaderPreview(true);
    }
    // Check for referrer parameter (e.g., from WhatsApp share)
    const ref = params.get('referrer');
    if (ref) {
      setReferrerName(decodeURIComponent(ref));
    }
  }, []);

  // --- Handle OAuth/Magic Link Callback ---
  const isAuthCallback = window.location.pathname === '/auth/callback';
  
  useEffect(() => {
    if (isAuthCallback) {
      // Wait for auth state to be established, then handle sign-in
      const checkAuthCallback = setInterval(async () => {
        if (isSupabaseConfigured()) {
          const supabaseUser = await getCurrentUser();
          if (supabaseUser) {
            // Get existing user from DB or create new one
            const existingUsers = await db.getUsers();
            let dbUser = existingUsers.find(u => u.email === supabaseUser.email);
            
            if (!dbUser) {
              // Create new user from OAuth/Magic Link data
              dbUser = {
                id: supabaseUser.id,
                name: supabaseUser.name,
                email: supabaseUser.email,
                isAdmin: false,
                waiverAccepted: false
              };
              await syncUserToServer(dbUser);
            }
            
            setUser(dbUser);
            
            // Check admin status first
            if (dbUser.isAdmin) {
              setAppState("admin");
            } else {
              // Check waiver status and redirect accordingly
              const hasSignedWaiver = dbUser.waiverData?.signed || dbUser.waiverAccepted;
              setAppState(hasSignedWaiver ? "client" : "onboarding");
            }
            
            // Clear the callback URL
            window.history.replaceState({}, document.title, '/');
            clearInterval(checkAuthCallback);
          }
        }
      }, 500);
      
      // Timeout after 10 seconds
      setTimeout(() => clearInterval(checkAuthCallback), 10000);
      
      return () => clearInterval(checkAuthCallback);
    }
  }, [isAuthCallback]);

  // --- Check for OAuth Session on Mount ---
  useEffect(() => {
    const checkSession = async () => {
      if (isSupabaseConfigured()) {
        const supabaseUser = await getCurrentUser();
        if (supabaseUser) {
          // Check if user exists in local DB, if not create them
          const existingUsers = await db.getUsers();
          let dbUser = existingUsers.find(u => u.email === supabaseUser.email);
          
          if (!dbUser) {
            // Create new user from Google OAuth data
            dbUser = {
              id: supabaseUser.id,
              name: supabaseUser.name,
              email: supabaseUser.email,
              isAdmin: false,
              waiverAccepted: false
            };
            // Use server endpoint to bypass RLS
            await syncUserToServer(dbUser);
          }
          
          setUser(dbUser);
          
          // Check admin status first
          if (dbUser.isAdmin) {
            setAppState("admin");
          } else {
            // Check waiver status
            const hasSignedWaiver = dbUser.waiverData?.signed || dbUser.waiverAccepted;
            setAppState(hasSignedWaiver ? "client" : "onboarding");
          }
        }
      }
    };
    
    checkSession();
    
    // Listen for auth state changes
    const { data: { subscription } } = onAuthStateChange(async (authUser) => {
      if (authUser) {
        const existingUsers = await db.getUsers();
        let dbUser = existingUsers.find(u => u.email === authUser.email);
        
        if (!dbUser) {
          dbUser = {
            id: authUser.id,
            name: authUser.name,
            email: authUser.email,
            isAdmin: false,
            waiverAccepted: false
          };
          await syncUserToServer(dbUser);
        }
        
        setUser(dbUser);
        if (dbUser.isAdmin) {
          setAppState("admin");
        } else {
          const hasSignedWaiver = dbUser.waiverData?.signed || dbUser.waiverAccepted;
          setAppState(hasSignedWaiver ? "client" : "onboarding");
        }
      }
    });
    
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // --- Auth Handlers ---
  const handleSignIn = async () => {
    try {
      // Get authenticated user from Supabase
      const supabaseUser = await getCurrentUser();
      
      if (!supabaseUser) {
        return;
      }
      
      // Get existing user from DB to preserve waiver status, etc.
      const existingUsers = await db.getUsers();
      let currentUser = existingUsers.find(u => u.email === supabaseUser.email);

      if (!currentUser) {
        // New user - sync to DB
        currentUser = {
          id: supabaseUser.id,
          name: supabaseUser.name,
          email: supabaseUser.email,
          isAdmin: false,
          waiverAccepted: false
        };
        await syncUserToServer(currentUser);
      }
      
      setUser(currentUser);
      
      // Check if admin first
      if (currentUser.isAdmin) {
        setAppState("admin");
        return;
      }
      
      // Check detailed waiver data OR legacy boolean
      const hasSignedWaiver = currentUser.waiverData?.signed || currentUser.waiverAccepted;

      // Redirect to onboarding if waiver not signed
      if (!hasSignedWaiver) {
          setAppState("onboarding");
      } else {
          setAppState("client");
      }
    } catch (err) {
      console.error('Failed to sign in:', err);
    }
  };

  const handleManualSignUp = async (name: string, email: string) => {
    try {
      const existingUsers = await db.getUsers();
      let currentUser = existingUsers.find(u => u.email === email);
      
      if (!currentUser) {
          currentUser = {
              id: `u${Date.now()}`,
              name,
              email,
              isAdmin: false,
              waiverAccepted: false
          };
          await syncUserToServer(currentUser);
      }
      
      setUser(currentUser);
      setAppState("onboarding");
    } catch (err) {
      console.error('Failed to sign up:', err);
    }
  };

  // SECURITY: Removed hardcoded admin/teacher sign-in.
  // Admin and teacher access must be granted through proper authentication flow.
  // Users with admin/teacher roles in the database can access these views after login.

  const handleSignOut = async () => {
    // Sign out from Supabase if configured
    if (isSupabaseConfigured()) {
      await signOut();
    }
    setUser(null);
    setAppState("signin");
    setAuthScreen('landing');
  };

  const handleOnboardingComplete = async (waiverData: WaiverData, injuries: InjuryRecord[]) => {
      if (user) {
          try {
              const updatedUser: User = {
                  ...user,
                  waiverAccepted: true, // Legacy compatibility
                  waiverData: waiverData, // New detailed persistence
                  injuries: injuries // Store injury records
              };
              
              // Save to DB
              await syncUserToServer(updatedUser);
              
              // Update Local State
              setUser(updatedUser);
              setAppState("client");
          } catch (err) {
              console.error('Failed to complete onboarding:', err);
          }
      }
  };

  // --- Data Handlers (Connected to DB) ---
  const handleRegister = async (cls: Class, paymentProof?: string, notes?: string, injuries?: InjuryRecord[]) => {
    if (!user) return;
    
    try {
      // Determine status based on price
      const isFree = cls.price === 0;
      
      const newReg: Registration = {
        id: `r${Date.now()}`,
        classId: cls.id,
        userId: user.id,
        userName: user.name,
        userEmail: user.email, // Save email for notifications
        userSport: user.sport || "General",
        bodyAreas: [],
        referredBy: null,
        // Logic: If paid class, go to payment_review. If free, confirmed.
        status: isFree ? 'confirmed' : 'payment_review',
        paymentStatus: isFree ? 'paid' : 'pending',
        paymentMethod: isFree ? 'free' : 'zapper',
        paymentProof: paymentProof,
        registeredAt: new Date().toISOString(),
        notes: notes,
        injuries: injuries
      };
      
      await db.addRegistration(newReg);
      
      // Refresh local state
      const [updatedRegistrations, updatedClasses] = await Promise.all([
        db.getRegistrations(),
        db.getClasses()
      ]);
      setRegistrations(updatedRegistrations);
      setClasses(updatedClasses);
    } catch (err) {
      console.error('Failed to register:', err);
    }
  };

  const handleCancelRegistration = async (regId: string) => {
    try {
      const reg = registrations.find(r => r.id === regId);
      if (reg) {
          const cls = classes.find(c => c.id === reg.classId);
          if (cls) {
              const classDate = new Date(cls.dateTime);
              const now = new Date();
              const hoursDiff = (classDate.getTime() - now.getTime()) / (1000 * 60 * 60);
              
              if (hoursDiff < 24) {
                  const confirmCancel = window.confirm("Cancellation Policy Warning:\n\nYou are cancelling within 24 hours of the class. This falls within our cancellation window and may not be eligible for a refund.\n\nDo you still want to proceed?");
                  if (!confirmCancel) return;
              }
          }
      }

      await db.cancelRegistration(regId);
      
      // Refresh both registrations and classes from the database
      // This ensures the registered count is properly synced (QUAL-004 fix)
      const [updatedRegistrations, updatedClasses] = await Promise.all([
        db.getRegistrations(),
        db.getClasses()
      ]);
      setRegistrations(updatedRegistrations);
      setClasses(updatedClasses);
    } catch (err) {
      console.error('Failed to cancel registration:', err);
    }
  };

  // Admin Data Handlers
  const handleAddClass = async (newClass: Class) => {
    try {
      await db.addClass(newClass);
      const updated = await db.getClasses();
      setClasses(updated);
    } catch (err) {
      console.error('Failed to add class:', err);
    }
  };

  const handleEditClass = async (updatedClass: Class) => {
    try {
      await db.updateClass(updatedClass);
      const updated = await db.getClasses();
      setClasses(updated);
    } catch (err) {
      console.error('Failed to edit class:', err);
    }
  };

  const handleDeleteClass = async (classId: string) => {
    try {
      await db.deleteClass(classId);
      // Optimistic update: remove from local state directly instead of refetching
      setClasses(prev => prev.filter(c => c.id !== classId));
    } catch (err) {
      console.error('Failed to delete class:', err);
    }
  };
  
  const handleAddVenue = async (newVenue: Venue) => {
    try {
      await db.addVenue(newVenue);
      const updated = await db.getVenues();
      setVenues(updated);
    } catch (err) {
      console.error('Failed to add venue:', err);
    }
  };

  const handleEditVenue = async (updatedVenue: Venue) => {
    try {
      await db.updateVenue(updatedVenue);
      const updated = await db.getVenues();
      setVenues(updated);
    } catch (err) {
      console.error('Failed to edit venue:', err);
    }
  };

  const handleDeleteVenue = async (venueId: string) => {
    try {
      await db.deleteVenue(venueId);
      // Optimistic update: remove from local state directly instead of refetching
      setVenues(prev => prev.filter(v => v.id !== venueId));
    } catch (err) {
      console.error('Failed to delete venue:', err);
    }
  };
  
  const handleAddTemplate = async (newTemplate: Template) => {
    try {
      await db.addTemplate(newTemplate);
      const updated = await db.getTemplates();
      setTemplates(updated);
    } catch (err) {
      console.error('Failed to add template:', err);
    }
  };

  const handleUpdateTemplate = async (updatedTemplate: Template) => {
    try {
      await db.updateTemplate(updatedTemplate);
      const updated = await db.getTemplates();
      setTemplates(updated);
    } catch (err) {
      console.error('Failed to update template:', err);
    }
  };

  const handleAddDisclaimer = async (newDisclaimer: Disclaimer) => {
    try {
      await db.addDisclaimer(newDisclaimer);
      const updated = await db.getDisclaimers();
      setDisclaimers(updated);
    } catch (err) {
      console.error('Failed to add disclaimer:', err);
    }
  };

  const handleUpdateDisclaimer = async (updatedDisclaimer: Disclaimer) => {
    try {
      await db.updateDisclaimer(updatedDisclaimer);
      const updated = await db.getDisclaimers();
      setDisclaimers(updated);
    } catch (err) {
      console.error('Failed to update disclaimer:', err);
    }
  };

  const handleDeleteDisclaimer = async (disclaimerId: string) => {
    try {
      await db.deleteDisclaimer(disclaimerId);
      // Optimistic update: remove from local state directly instead of refetching
      setDisclaimers(prev => prev.filter(d => d.id !== disclaimerId));
    } catch (err) {
      console.error('Failed to delete disclaimer:', err);
    }
  };

  const handleUpdateSettings = async (newSettings: AppSettings) => {
    try {
      await db.updateSettings(newSettings);
      setSettings(newSettings);
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  };

  const handleSaveCalendarTokens = async (tokens: GoogleCalendarTokens) => {
    try {
      const currentSettings = await db.getSettings();
      const updatedSettings = { ...currentSettings, googleCalendarTokens: tokens };
      await db.updateSettings(updatedSettings);
      setSettings(updatedSettings);
    } catch (err) {
      console.error('Failed to save calendar tokens:', err);
    }
  };

  const handleVerifyPayment = async (regId: string, verified: boolean) => {
    try {
      const regs = await db.getRegistrations();
      const reg = regs.find(r => r.id === regId);
      if (reg) {
          const updatedReg: Registration = {
              ...reg,
              status: verified ? 'confirmed' : 'cancelled',
              paymentStatus: verified ? 'verified' : 'unpaid'
          };
          await db.updateRegistration(updatedReg);
          const updated = await db.getRegistrations();
          setRegistrations(updated);
      }
    } catch (err) {
      console.error('Failed to verify payment:', err);
    }
  };

  const handleUpdateUser = async (updates: Partial<User>) => {
    if (user) {
      try {
        const updatedUser: User = {
          ...user,
          ...updates
        };
        await syncUserToServer(updatedUser);
        setUser(updatedUser);
        const updatedUsers = await db.getUsers();
        setUsers(updatedUsers);
      } catch (err) {
        console.error('Failed to update user:', err);
      }
    }
  };

  // Admin management handlers
  const handleAddAdmin = async (email: string, name: string, role: AdminRole) => {
    try {
      // Use the new API endpoint to invite admin via email
      const response = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          name, 
          role, 
          inviterId: user.id 
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to invite admin');
      }
      
      // Refresh users list
      const updated = await db.getUsers();
      setUsers(updated);
      
      return result;
    } catch (err) {
      console.error('Failed to add admin:', err);
      throw err;
    }
  };

  const handleRemoveAdmin = async (userId: string) => {
    try {
      const existingUsers = await db.getUsers();
      const adminUser = existingUsers.find(u => u.id === userId);
      
      if (adminUser) {
        // Downgrade to regular user instead of deleting
        adminUser.isAdmin = false;
        adminUser.adminRole = undefined;
        await syncUserToServer(adminUser);
        const updated = await db.getUsers();
        setUsers(updated);
      }
    } catch (err) {
      console.error('Failed to remove admin:', err);
    }
  };

  // Teacher handlers
  const handleAddTeacher = async (teacher: Teacher) => {
    try {
      await db.addTeacher(teacher);
      const updated = await db.getTeachers();
      setTeachers(updated);
    } catch (err) {
      console.error('Failed to add teacher:', err);
    }
  };

  const handleEditTeacher = async (teacher: Teacher) => {
    try {
      await db.updateTeacher(teacher);
      const updated = await db.getTeachers();
      setTeachers(updated);
    } catch (err) {
      console.error('Failed to edit teacher:', err);
    }
  };

  const handleDeleteTeacher = async (teacherId: string) => {
    try {
      await db.deleteTeacher(teacherId);
      // Optimistic update: remove from local state directly instead of refetching
      setTeachers(prev => prev.filter(i => i.id !== teacherId));
    } catch (err) {
      console.error('Failed to delete teacher:', err);
    }
  };

  // --- Loading Spinner ---
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FBF7EF]">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#6E7568] mb-4"></div>
          <p className="text-[#6E7568] text-sm font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // --- Previews ---
  if (showLandingPreview) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<LoadingFallback />}>
          <div>
            <div className="bg-[#6E7568] p-3 flex justify-between items-center sticky top-0 z-50 shadow-md">
              <span className="text-[10px] font-bold text-[#FBF7EF] tracking-[1px] uppercase">Preview Mode</span>
              <button onClick={() => setShowLandingPreview(false)} className="bg-transparent border border-[#FBF7EF]/30 text-[#FBF7EF] rounded-md py-1 px-3 text-xs cursor-pointer font-bold uppercase tracking-wider">
                Close
              </button>
            </div>
            <InviteLandingPage
              classes={classes}
              venues={venues}
              referrerName={referrerName || undefined}
              forceRefreshSettings={true}
              onRegister={() => {
                setShowLandingPreview(false);
                setAppState("signin");
              }}
            />
          </div>
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (showShaderPreview) {
    return (
      <Suspense fallback={<InlineLoading />}>
        <div className="relative">
          <div className="absolute top-4 right-4 z-50">
            <button 
              onClick={() => setShowShaderPreview(false)} 
              className="bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-full py-2 px-4 text-xs font-bold uppercase tracking-wider hover:bg-white/20 transition-colors cursor-pointer"
            >
              Close Preview
            </button>
          </div>
          <ShaderShowcaseLazy />
        </div>
      </Suspense>
    );
  }

  // --- Auth Callback Loading State ---
  if (isAuthCallback) {
    return (
      <div className="min-h-screen bg-[#6E7568] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-6">
          <div className="w-16 h-16 border-4 border-[#FBF7EF]/30 border-t-[#FBF7EF] rounded-full animate-spin" />
          <p className="text-[#FBF7EF] text-sm font-medium tracking-wider uppercase">Completing sign in...</p>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="font-['Montserrat'] bg-[#FBF7EF] min-h-screen">
        {appState === "signin" && (
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback />}>
              <>
                {authScreen === 'landing' && (
                  <AuthLandingLazy 
                    onClientLogin={() => { 
                      setAuthScreen('client'); 
                    }}
                    onTeacherLogin={() => { 
                      setAuthScreen('teacher'); 
                    }}
                    onAdminLogin={() => { 
                      setAuthScreen('admin'); 
                    }}
                  />
                )}
                {authScreen === 'client' && (
                  <ClientLoginScreenLazy 
                    onBack={() => setAuthScreen('landing')}
                    onSignIn={handleSignIn}
                    onManualSignUp={handleManualSignUp}
                  />
                )}
                {authScreen === 'teacher' && (
                  <TeacherLoginScreenLazy 
                    onBack={() => setAuthScreen('landing')}
                  />
                )}
                {authScreen === 'admin' && (
                  <AdminLoginScreenLazy 
                    onBack={() => setAuthScreen('landing')}
                  />
                )}
              </>
            </Suspense>
          </ErrorBoundary>
        )}

        {appState === "onboarding" && user && (
          <ErrorBoundary>
            <Suspense fallback={<InlineLoading />}>
              <OnboardingScreen userName={user.name} disclaimers={disclaimers} onComplete={handleOnboardingComplete} />
            </Suspense>
          </ErrorBoundary>
        )}

        {appState === "client" && user && (
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback />}>
              <ClientApp 
                user={user} 
                onSignOut={handleSignOut}
                classes={classes}
                registrations={registrations}
                venues={venues}
                settings={settings}
                onRegister={handleRegister}
                onCancel={handleCancelRegistration}
                onUpdateUser={handleUpdateUser}
                chatMessages={chatMessages}
                onSendChatMessage={handleSendChatMessage}
                unreadChatCount={getUnreadChatCount()}
              />
            </Suspense>
          </ErrorBoundary>
        )}

        {appState === "admin" && user && (
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback />}>
              <AdminApp 
                user={user} 
                onSignOut={handleSignOut}
                classes={classes}
                registrations={registrations}
                venues={venues}
                templates={templates}
                disclaimers={disclaimers}
                settings={settings}
                users={users}
                teachers={teachers}
                onAddClass={handleAddClass}
                onEditClass={handleEditClass}
                onDeleteClass={handleDeleteClass}
                onAddVenue={handleAddVenue}
                onEditVenue={handleEditVenue}
                onDeleteVenue={handleDeleteVenue}
                onAddTemplate={handleAddTemplate}
                onUpdateTemplate={handleUpdateTemplate}
                onAddDisclaimer={handleAddDisclaimer}
                onUpdateDisclaimer={handleUpdateDisclaimer}
                onDeleteDisclaimer={handleDeleteDisclaimer}
                onUpdateSettings={handleUpdateSettings}
                onVerifyPayment={handleVerifyPayment}
                onPreviewLanding={() => setShowLandingPreview(true)}
                onSaveCalendarTokens={handleSaveCalendarTokens}
                onUpdateUser={handleUpdateUser}
                onAddAdmin={handleAddAdmin}
                onRemoveAdmin={handleRemoveAdmin}
                onAddTeacher={handleAddTeacher}
                onEditTeacher={handleEditTeacher}
                onDeleteTeacher={handleDeleteTeacher}
                chatMessages={chatMessages}
                onSendChatMessage={handleSendChatMessage}
              />
            </Suspense>
          </ErrorBoundary>
        )}

        {appState === "teacher" && user && (
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback />}>
              <TeacherApp 
                user={user} 
                onSignOut={handleSignOut}
                classes={classes}
                registrations={registrations}
                venues={venues}
                settings={settings}
                teachers={teachers}
                onUpdateUser={handleUpdateUser}
                chatMessages={chatMessages}
                onSendChatMessage={handleSendChatMessage}
              />
            </Suspense>
          </ErrorBoundary>
        )}
      </div>
    </ToastProvider>
  );
}
