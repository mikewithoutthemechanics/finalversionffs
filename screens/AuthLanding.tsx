
import React, { useState } from 'react';
import { PersonIcon, ArrowLeftIcon, MailIcon, ShieldIcon, StarIcon, CheckCircleIcon } from '../components/Icons';
import { motion } from 'framer-motion';
import { signInWithMagicLink, isSupabaseConfigured } from '../lib/supabase';

interface AuthLandingProps {
  onClientLogin: () => void;
  onTeacherLogin: () => void;
  onAdminLogin: () => void;
  onBack?: () => void;
}

// Floating particles like landing page
const FloatingParticle = ({ delay, left, top, color }: { delay: number; left: string; top: string; color: string }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: [0, 0.6, 0], y: [0, -60, -120], x: [0, Math.random() * 20 - 10, 0] }}
    transition={{ duration: 5, repeat: Infinity, delay, ease: "easeOut" }}
    style={{ position: 'absolute', left, top, width: 4, height: 4, borderRadius: '50%', backgroundColor: color }}
    className="pointer-events-none"
  />
);

const FloatingOrb = ({ delay, className }: { delay: number; className: string }) => (
  <motion.div
    animate={{ y: [0, -20, 0], x: [0, 10, 0], scale: [1, 1.05, 1] }}
    transition={{ duration: 10, repeat: Infinity, delay, ease: "easeInOut" }}
    className={className}
  />
);

export const AuthLanding: React.FC<AuthLandingProps> = ({ onClientLogin, onTeacherLogin, onAdminLogin, onBack }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [magicLinkEmail, setMagicLinkEmail] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!magicLinkEmail) return;
    
    setIsLoading(true);
    setError(null);
    
    if (isSupabaseConfigured()) {
      const result = await signInWithMagicLink(magicLinkEmail);
      if (result.success) {
        setMagicLinkSent(true);
      } else {
        setError(result.error);
      }
      setIsLoading(false);
    } else { 
      onClientLogin(); 
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualName && manualEmail) {
      setIsLoading(true);
      onClientLogin();
    }
  };

  return (
    <div className="min-h-screen bg-[#6E7568] flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* FLOATING PARTICLES */}
      <FloatingParticle delay={0} left="10%" top="90%" color="#FBF7EF" />
      <FloatingParticle delay={0.7} left="20%" top="85%" color="#C05640" />
      <FloatingParticle delay={1.4} left="30%" top="95%" color="#FBF7EF" />
      <FloatingParticle delay={2.1} left="50%" top="88%" color="#C05640" />
      <FloatingParticle delay={2.8} left="70%" top="92%" color="#FBF7EF" />
      <FloatingParticle delay={3.5} left="85%" top="86%" color="#C05640" />

      {/* FLOATING ORBS */}
      <FloatingOrb delay={0} className="fixed top-[5%] right-[-10%] w-[300px] h-[300px] bg-gradient-to-br from-[#FBF7EF]/20 to-transparent rounded-full blur-[80px] pointer-events-none" />
      <FloatingOrb delay={3} className="fixed bottom-[10%] left-[-15%] w-[400px] h-[400px] bg-gradient-to-tr from-[#C05640]/15 to-transparent rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-lg flex flex-col items-center justify-center relative z-10">
        
        {/* Logo Section - Big & Enhanced */}
        <div className="mb-10 sm:mb-12 text-center relative z-30">
          {onBack && (
            <button
              onClick={onBack}
              className="absolute left-0 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-[#FBF7EF]/10 flex items-center justify-center text-[#FBF7EF] hover:bg-[#FBF7EF]/20 transition-colors cursor-pointer z-20"
            >
              <ArrowLeftIcon size={20} />
            </button>
          )}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative inline-block"
          >
            {/* Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#FBF7EF]/40 via-[#C05640]/20 to-[#6E7568]/30 blur-3xl scale-125 rounded-full"></div>
            {/* Secondary glow */}
            <div className="absolute -inset-8 bg-[#FBF7EF]/10 rounded-full blur-3xl"></div>
            <img src="/logo.webp" alt="The Fascia Movement" className="relative z-10 w-48 h-auto max-w-full" />
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
          className="w-full max-w-[320px] sm:max-w-[360px] flex flex-col gap-6 sm:gap-8 items-center"
        >
          {!showManual ? (
              <>
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full bg-red-500/20 border border-red-500/30 rounded-xl p-3 text-center"
                  >
                    <p className="text-red-200 text-xs">{error}</p>
                  </motion.div>
                )}
                
                {/* BIG PROMINENT REGISTER BUTTON */}
                <motion.button 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowManual(true)}
                  className="w-full relative overflow-hidden rounded-[1.5rem] py-5 px-6 shadow-2xl cursor-pointer group"
                  style={{ minHeight: '64px' }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-[#FBF7EF] via-[#fff] to-[#FBF7EF]"></div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                  <div className="absolute inset-0 rounded-[1.5rem] shadow-[inset_0_-3px_6px_rgba(0,0,0,0.1),0_4px_12px_rgba(0,0,0,0.15)]"></div>
                  <div className="relative z-10 flex items-center justify-center gap-3">
                    <span className="text-[#26150B] font-bold text-base tracking-[0.1em] uppercase drop-shadow-md">
                      Get Your Free Pass
                    </span>
                  </div>
                </motion.button>

                {!magicLinkSent ? (
                  <>
                    <div className="w-full flex items-center gap-3">
                      <div className="h-px flex-1 bg-[#FBF7EF]/20"></div>
                      <span className="text-[#FBF7EF]/50 text-[9px] uppercase tracking-widest">or sign in with email</span>
                      <div className="h-px flex-1 bg-[#FBF7EF]/20"></div>
                    </div>

                    {/* MAGIC LINK FORM */}
                    <form onSubmit={handleMagicLinkSubmit} className="w-full max-w-[320px] space-y-4">
                      <div className="relative">
                        <input
                          type="email"
                          value={magicLinkEmail}
                          onChange={(e) => setMagicLinkEmail(e.target.value)}
                          placeholder="Enter your email"
                          className="w-full bg-[#FBF7EF]/10 border border-[#FBF7EF]/30 rounded-2xl py-4 px-5 text-[#FBF7EF] placeholder-[#FBF7EF]/50 focus:outline-none focus:border-[#FBF7EF]/60 focus:bg-[#FBF7EF]/15 transition-all text-sm"
                          required
                        />
                        <MailIcon size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#FBF7EF]/50" />
                      </div>
                      <motion.button 
                        type="submit"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={isLoading || !magicLinkEmail}
                        className="w-full bg-gradient-to-r from-[#C05640] to-[#a84a32] text-[#FBF7EF] rounded-full py-4 px-6 font-bold text-xs uppercase tracking-[0.2em] shadow-lg hover:shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isLoading ? (
                          <div className="w-5 h-5 border-2 border-[#FBF7EF]/30 border-t-[#FBF7EF] rounded-full animate-spin mx-auto" />
                        ) : (
                          "Send Magic Link"
                        )}
                      </motion.button>
                    </form>
                  </>
                ) : (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full text-center space-y-6 py-4">
                    <div className="w-16 h-16 bg-[#C05640] rounded-full flex items-center justify-center mx-auto">
                      <CheckCircleIcon size={32} className="text-[#FBF7EF]" />
                    </div>
                    <div>
                      <h3 className="text-[#FBF7EF] text-base font-bold mb-1">Check Your Email!</h3>
                      <p className="text-[#FBF7EF]/70 text-xs">We sent a magic link to</p>
                      <p className="text-[#FBF7EF] font-medium text-sm mt-1">{magicLinkEmail}</p>
                    </div>
                    <p className="text-[#FBF7EF]/50 text-[10px]">Click the link in your email to sign in</p>
                    <button 
                      onClick={() => { setMagicLinkSent(false); setMagicLinkEmail(""); }} 
                      className="text-[#FBF7EF]/60 text-xs hover:text-[#FBF7EF] transition-colors underline"
                    >
                      Use a different email
                    </button>
                  </motion.div>
                )}

                {/* Portal Buttons */}
                <div className="w-full space-y-3 mt-2">
                  <button 
                      onClick={onTeacherLogin}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-full border border-[#FBF7EF]/10 bg-[#26150B]/30 text-[#FBF7EF] text-[10px] font-bold uppercase tracking-[0.15em] hover:bg-[#26150B]/50 hover:border-[#FBF7EF]/30 transition-all"
                  >
                      <StarIcon size={14} />
                      <span>Teacher Portal</span>
                  </button>

                  <button 
                      onClick={onAdminLogin}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-full border border-[#FBF7EF]/10 bg-[#26150B]/30 text-[#FBF7EF] text-[10px] font-bold uppercase tracking-[0.15em] hover:bg-[#26150B]/50 hover:border-[#FBF7EF]/30 transition-all"
                  >
                      <ShieldIcon size={14} />
                      <span>Admin Portal</span>
                  </button>
                </div>
              </>
          ) : (
              <motion.form 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onSubmit={handleManualSubmit} 
                className="w-full space-y-5 bg-[#FBF7EF]/10 backdrop-blur-xl p-6 sm:p-8 rounded-[2rem] border border-[#FBF7EF]/20 shadow-2xl relative overflow-hidden"
              >
                  <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>

                  <div className="flex items-center justify-between mb-2 relative z-10">
                      <button 
                        type="button"
                        onClick={() => setShowManual(false)}
                        className="w-8 h-8 rounded-full bg-[#FBF7EF]/10 flex items-center justify-center text-[#FBF7EF] hover:bg-[#FBF7EF]/20 transition-colors"
                      >
                          <ArrowLeftIcon size={16} />
                      </button>
                      <h3 className="text-[#FBF7EF] text-xs font-bold uppercase tracking-widest">Claim Your Pass</h3>
                      <div className="w-8" />
                  </div>

                  <div className="space-y-4 relative z-10">
                      <div className="group">
                          <label className="block text-[9px] font-bold uppercase tracking-widest text-[#FBF7EF]/60 mb-1.5 ml-3">Full Name</label>
                          <div className="relative">
                              <input 
                                type="text" 
                                value={manualName}
                                onChange={e => setManualName(e.target.value)}
                                className="w-full bg-[#26150B]/30 border border-[#FBF7EF]/10 rounded-xl py-3.5 pl-10 pr-4 text-sm text-[#FBF7EF] placeholder-[#FBF7EF]/20 outline-none focus:border-[#FBF7EF]/40 focus:bg-[#26150B]/50 transition-all shadow-inner"
                                placeholder="Jane Doe"
                                required
                              />
                              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#FBF7EF]/40">
                                  <PersonIcon size={16} />
                              </div>
                          </div>
                      </div>
                      
                      <div className="group">
                          <label className="block text-[9px] font-bold uppercase tracking-widest text-[#FBF7EF]/60 mb-1.5 ml-3">Email Address</label>
                          <div className="relative">
                              <input 
                                type="email" 
                                value={manualEmail}
                                onChange={e => setManualEmail(e.target.value)}
                                className="w-full bg-[#26150B]/30 border border-[#FBF7EF]/10 rounded-xl py-3.5 pl-10 pr-4 text-sm text-[#FBF7EF] placeholder-[#FBF7EF]/20 outline-none focus:border-[#FBF7EF]/40 focus:bg-[#26150B]/50 transition-all shadow-inner"
                                placeholder="jane@example.com"
                                required
                              />
                              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#FBF7EF]/40">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                      <polyline points="22,6 12,13 2,6"></polyline>
                                  </svg>
                              </div>
                          </div>
                      </div>
                  </div>

                  <motion.button 
                    type="submit"
                    disabled={isLoading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full mt-2 bg-[#FBF7EF] text-[#26150B] rounded-full py-4 text-xs font-bold uppercase tracking-[0.15em] hover:bg-[#EDE8DC] transition-all shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-2px_4px_rgba(0,0,0,0.1),inset_0_2px_4px_rgba(255,255,255,0.5)] disabled:opacity-50 disabled:cursor-not-allowed relative z-10"
                  >
                      {isLoading ? "Creating..." : "Unlock My Free Pass"}
                  </motion.button>
              </motion.form>
          )}
          
          <p className="text-center text-[#FBF7EF]/30 text-[9px] leading-relaxed max-w-[240px] mx-auto font-medium pt-2">
            No credit card required. Start your journey today.
          </p>
        </motion.div>
      </div>
    </div>
  );
};
