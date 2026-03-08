
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Class, Registration, ClientTab, AppSettings, Venue, ChatMessage, CreditPackage, InjuryRecord, BodyArea } from '../types';
import { getVenue, formatDate, formatTime, spotsLeft, isFull, renderTemplate, getEndTimeWithReset, isDomeVenue } from '../utils';
import { MOCK_TEMPLATES } from '../data';
import { PauseLogo } from '../components/PauseLogo';
import { ClockIcon, MapPinIcon, CalendarIcon, CheckIcon, ArrowLeftIcon, LogOutIcon, QrCodeIcon, InfoIcon, AlertIcon, ArticleIcon, ShareIcon, CameraIcon, PersonIcon, BookingsIcon, XIcon, MailIcon, AwardIcon, ZapIcon, TargetIcon, Edit3Icon, CreditCardIcon, GiftIcon, SparklesIcon, CopyIcon, ChevronRightIcon, MessageIcon, SendIcon, GoogleIcon, DownloadIcon } from '../components/Icons';
import { DomeBookingSelector } from '../components/DomeBookingSelector';
import { CREDIT_PACKAGES } from '../constants';

//=============== Calendar Utility Functions ===============//
const generateGoogleCalendarUrl = (cls: Class, venue: Venue | undefined): string => {
    const startDate = new Date(cls.dateTime);
    const endDate = new Date(startDate.getTime() + cls.duration * 60000);
    
    const formatDateForGoogle = (date: Date): string => {
        return date.toISOString().replace(/-|:|\.\d{3}/g, '');
    };
    
    const title = encodeURIComponent(cls.title);
    const details = encodeURIComponent(cls.description || `Join us for ${cls.title}`);
    const location = encodeURIComponent(venue?.address || '');
    
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatDateForGoogle(startDate)}/${formatDateForGoogle(endDate)}&details=${details}&location=${location}`;
};

const generateICSFile = (cls: Class, venue: Venue | undefined): string => {
    const startDate = new Date(cls.dateTime);
    const endDate = new Date(startDate.getTime() + cls.duration * 60000);
    
    const formatDateForICS = (date: Date): string => {
        return date.toISOString().replace(/-|:|\.\d{3}/g, '').split('Z')[0] + 'Z';
    };
    
    const escapeICSText = (text: string): string => {
        return text.replace(/[\\;,\n]/g, (match) => '\\' + match);
    };
    
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Pause Fascia Movement//Booking//EN
BEGIN:VEVENT
UID:${cls.id}@pausefmd.co.za
DTSTAMP:${formatDateForICS(new Date())}
DTSTART:${formatDateForICS(startDate)}
DTEND:${formatDateForICS(endDate)}
SUMMARY:${escapeICSText(cls.title)}
DESCRIPTION:${escapeICSText(cls.description || `Join us for ${cls.title}`)}
LOCATION:${escapeICSText(venue?.address || '')}
END:VEVENT
END:VCALENDAR`;
    
    return icsContent;
};

const downloadICSFile = (cls: Class, venue: Venue | undefined): void => {
    const icsContent = generateICSFile(cls, venue);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${cls.title.replace(/\s+/g, '_')}_${formatDate(cls.dateTime).replace(/\s+/g, '_')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
};

//=============== Header ===============//
interface HeaderBarProps {
  user: User;
  onSignOut: () => void;
  showBack: boolean;
  onBack: () => void;
  onProfileClick: () => void;
}
const HeaderBar: React.FC<HeaderBarProps> = ({ user, onSignOut, showBack, onBack, onProfileClick }) => (
  <header className="px-4 sm:px-6 py-3 sm:py-4 pt-safe flex items-center justify-between sticky top-0 z-50 transition-all duration-300 bg-[#FBF7EF]/80 backdrop-blur-xl border-b border-[#26150B]/5">
    <div className="flex items-center gap-3 sm:gap-4">
      <AnimatePresence mode="wait">
        {showBack ? (
          <motion.button 
            key="back"
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
            whileTap={{ scale: 0.9 }}
            onClick={onBack}
            className="w-11 h-11 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-[#26150B] border border-[#26150B]/10 bg-[#26150B]/5 hover:bg-[#26150B]/10 transition-colors"
          >
            <ArrowLeftIcon size={18} />
          </motion.button>
        ) : (
          <motion.div key="logo" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
             <PauseLogo size="sm" /> 
          </motion.div>
        )}
      </AnimatePresence>
       
       {!showBack && (
         <div className="flex flex-col justify-center h-full">
            <p className="text-[10px] sm:text-[9px] font-bold text-[#26150B] uppercase tracking-[2px] opacity-60 leading-tight">Welcome</p>
            <h1 className="text-lg sm:text-xl text-[#26150B] font-bold tracking-tight leading-none mt-0.5">{user.name.split(" ")[0]}</h1>
         </div>
       )}
    </div>
    
    <div className="flex items-center gap-3 sm:gap-4">
      <motion.button 
        whileTap={{ scale: 0.95 }}
        onClick={onSignOut} 
        className="w-11 h-11 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-[#26150B]/40 hover:text-[#26150B] transition-colors"
        title="Log Out"
      >
        <LogOutIcon size={20} />
      </motion.button>
      
      <div 
        onClick={onProfileClick}
        className="w-11 h-11 sm:w-10 sm:h-10 rounded-full bg-[#6E7568] flex items-center justify-center shadow-lg shadow-[#6E7568]/20 text-[#FBF7EF] font-bold text-sm select-none border border-[#FBF7EF]/50 cursor-pointer"
      >
        {user.name.charAt(0)}
      </div>
    </div>
  </header>
);

//=============== Class Card (Memoized) ===============//
interface ClassCardProps {
    cls: Class;
    venues: Venue[];
    onRegister: (cls: Class) => void;
    userRegistrations: Registration[];
    onViewDetails: (cls: Class) => void;
    onShare: (cls: Class) => void;
}
const ClassCard: React.FC<ClassCardProps> = React.memo(({ cls, venues, onRegister, userRegistrations, onViewDetails, onShare }) => {
    const venue = getVenue(cls.venueId, venues);
    const full = isFull(cls);
    const spots = spotsLeft(cls);
    const pct = (cls.registered / cls.capacity) * 100;
    const isRegistered = userRegistrations.some(r => r.classId === cls.id);
    
    // Calculate end time with reset buffer for dome venues
    const isDome = isDomeVenue(venue?.name);
    const { endTime, hasBuffer, nextAvailable } = getEndTimeWithReset(
        cls.dateTime, 
        cls.duration, 
        isDome, 
        cls.allowDomeResetOverride
    );
    const startTime = formatTime(cls.dateTime);

    return (
        <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ y: -4 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative mb-6"
        >
            {/* Gradient Border */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-[#6E7568]/60 via-[#C05640]/30 to-[#6E7568]/60 rounded-[2rem] blur-sm"></div>
            
            <div className="relative rounded-[1.9rem] overflow-hidden bg-[#6E7568] shadow-2xl shadow-[#6E7568]/20">
                <div className="p-6 sm:p-8 pb-4">
                    {/* Header Row: Badge & Sport Tags */}
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex flex-wrap gap-2">
                            {cls.sportTags.slice(0, 2).map(t => (
                              <span key={t} className="px-3 py-1.5 rounded-lg text-[10px] sm:text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-[#FBF7EF]/20 to-[#FBF7EF]/5 text-[#FBF7EF] border border-[#FBF7EF]/20">
                                {t}
                              </span>
                            ))}
                        </div>
                        {/* Registered Badge */}
                        {isRegistered ? (
                          <div className="bg-[#FBF7EF] text-[#6E7568] text-[10px] sm:text-[9px] font-extrabold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 uppercase tracking-wide">
                            <CheckIcon size={10} className="stroke-[3]" /> Registered
                          </div>
                        ) : full ? (
                          <div className="bg-[#26150B]/40 backdrop-blur-md border border-[#FBF7EF]/20 text-[#FBF7EF] text-[10px] sm:text-[9px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wide">
                            Waitlist
                          </div>
                        ) : null}
                    </div>

                    <h3 className="text-xl sm:text-2xl text-[#FBF7EF] font-bold tracking-tight leading-snug mb-3 pr-4">{cls.title}</h3>
                    
                    {/* Info Rows with Hover Effects */}
                    <div className="space-y-3">
                      <motion.div whileHover={{ x: 6 }} className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FBF7EF]/20 to-[#FBF7EF]/5 flex items-center justify-center">
                            <CalendarIcon size={16} className="text-[#FBF7EF]" />
                          </div>
                          <span className="text-xs text-[#FBF7EF] font-medium tracking-wide">{formatDate(cls.dateTime)}</span>
                      </motion.div>
                      <motion.div whileHover={{ x: 6 }} className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FBF7EF]/20 to-[#FBF7EF]/5 flex items-center justify-center">
                            <ClockIcon size={16} className="text-[#FBF7EF]" />
                          </div>
                          <span className="text-xs text-[#FBF7EF] font-medium tracking-wide">
                            {startTime} - {endTime}
                            {hasBuffer && (
                              <span className="ml-2 px-2 py-0.5 bg-[#FBF7EF]/20 text-[#FBF7EF] text-[10px] sm:text-[9px] rounded-full">
                                +{nextAvailable} reset
                              </span>
                            )}
                          </span>
                      </motion.div>
                      <motion.div whileHover={{ x: 6 }} className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FBF7EF]/20 to-[#FBF7EF]/5 flex items-center justify-center">
                            <MapPinIcon size={16} className="text-[#FBF7EF]" />
                          </div>
                          <span className="text-xs text-[#FBF7EF] font-medium tracking-wide opacity-90 line-clamp-1">{venue?.name}</span>
                      </motion.div>
                    </div>
                </div>
                
                <div className="px-6 sm:px-8 pb-6 sm:pb-8 pt-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] sm:text-[9px] font-bold uppercase tracking-widest text-[#FBF7EF]/50">{full ? "Full Capacity" : "Availability"}</span>
                        <div className="flex items-center gap-4">
                            <span className="text-[11px] sm:text-[11px] font-bold text-[#FBF7EF] tracking-wider">{spots} spots left</span>
                            <button onClick={(e) => { e.stopPropagation(); onShare(cls); }} className="text-[#FBF7EF]/60 hover:text-[#FBF7EF] transition-colors" title="Share">
                                <ShareIcon size={16} />
                            </button>
                        </div>
                    </div>
                    
                    <div className="h-2 bg-[#FBF7EF]/10 w-full mb-4 rounded-full overflow-hidden border border-[#FBF7EF]/5">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                            className="h-full bg-gradient-to-r from-[#FBF7EF] via-[#fff] to-[#FBF7EF] rounded-full shadow-[0_0_10px_rgba(251,247,239,0.5)]"
                        />
                    </div>
                    
                    {/* Low Stock Alert */}
                    {spots <= 5 && !full && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center justify-center gap-2 mb-4"
                        >
                            <motion.span animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 1, repeat: Infinity }} className="w-2 h-2 rounded-full bg-[#C05640]"></motion.span>
                            <span className="text-xs font-bold text-[#C05640]">Only {spots} spots left!</span>
                            <motion.span animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 1, repeat: Infinity }} className="w-2 h-2 rounded-full bg-[#C05640]"></motion.span>
                        </motion.div>
                    )}
                    
                    <div onClick={e => e.stopPropagation()}>
                        {isRegistered ? (
                            <motion.button 
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => onViewDetails(cls)}
                                className="w-full rounded-full py-4 px-6 text-[11px] sm:text-[10px] font-bold text-[#FBF7EF] bg-gradient-to-r from-[#FBF7EF]/20 to-[#FBF7EF]/5 border border-[#FBF7EF]/20 backdrop-blur-sm hover:from-[#FBF7EF]/30 hover:to-[#FBF7EF]/10 transition-all"
                            >
                              View Details
                            </motion.button>
                        ) : (
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => onRegister(cls)}
                                className={`w-full rounded-full py-4 px-6 text-[11px] sm:text-[10px] font-extrabold transition-all shadow-lg ${full 
                                    ? 'bg-gradient-to-r from-[#26150B] to-[#3d2a1a] text-[#FBF7EF] border border-[#FBF7EF]/10' 
                                    : 'bg-gradient-to-r from-[#FBF7EF] via-[#fff] to-[#FBF7EF] text-[#26150B] shadow-[#FBF7EF]/20 hover:shadow-[#FBF7EF]/40]'
                                }`}
                            >
                                {full ? "Join Waitlist" : (
                                    <span className="flex items-center justify-center gap-2">
                                        Register
                                        <span className="opacity-40">•</span>
                                        {cls.price > 0 ? `R ${cls.price}` : "Free"}
                                    </span>
                                )}
                            </motion.button>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
});

//=============== Classes View ===============//
interface ClassesScreenProps {
  classes: Class[];
  venues: Venue[];
  onRegister: (cls: Class) => void;
  registrations: Registration[];
  onViewDetails: (cls: Class) => void;
  onShare: (cls: Class) => void;
}
const ClassesScreen: React.FC<ClassesScreenProps> = ({ classes, venues, onRegister, registrations, onViewDetails, onShare }) => {
  // Memoize filtered classes to avoid recalculation on every render
  const filteredClasses = useMemo(() => 
    classes.filter(c => c.status === 'published'),
    [classes]
  );

  return (
  <motion.div 
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="px-4 sm:p-5 pb-40 max-w-lg mx-auto"
  >
    {/* Gradient Section Divider */}
    <div className="flex items-center gap-4 mb-8 sm:mb-10">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#26150B]/20 to-transparent"></div>
      <h3 className="text-[10px] font-bold text-[#26150B] uppercase tracking-[3px]">Upcoming Sessions</h3>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#26150B]/20 to-transparent"></div>
    </div>
    
    <div className="space-y-4">
      {filteredClasses.map((cls) => (
          <ClassCard key={cls.id} cls={cls} venues={venues} onRegister={onRegister} userRegistrations={registrations} onViewDetails={onViewDetails} onShare={onShare} />
      ))}
    </div>
  </motion.div>
  );
};

//=============== Bookings View ===============//
interface BookingsScreenProps {
  classes: Class[];
  userRegistrations: Registration[];
  onCancelClick: (reg: Registration) => void;
  onShare: (cls: Class) => void;
  onViewDetails: (cls: Class) => void;
}
const BookingsScreen: React.FC<BookingsScreenProps> = ({ classes, userRegistrations, onCancelClick, onShare, onViewDetails }) => {
    // Memoize filtered registrations to avoid recalculation on every render
    const relevant = useMemo(() => 
        userRegistrations.filter(r => {
            const cls = classes.find(c => c.id === r.classId);
            return !!cls;
        }),
        [userRegistrations, classes]
    );

    return (
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="p-4 sm:p-6 pb-40 max-w-lg mx-auto"
        >
            {/* Gradient Section Divider */}
            <div className="flex items-center gap-4 mb-8 sm:mb-10">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#26150B]/20 to-transparent"></div>
              <h3 className="text-[10px] font-bold text-[#26150B] uppercase tracking-[3px]">My Bookings</h3>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#26150B]/20 to-transparent"></div>
            </div>

            <AnimatePresence>
            {relevant.length === 0 ? (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="rounded-[2.5rem] text-center py-16 sm:py-20 px-6 sm:px-8 bg-[#6E7568] shadow-xl"
                >
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#FBF7EF]/10 flex items-center justify-center mx-auto mb-5 sm:mb-6 text-[#FBF7EF]/60">
                        <CalendarIcon size={24} />
                    </div>
                    <p className="text-lg sm:text-xl text-[#FBF7EF] mb-3 font-bold">No upcoming sessions</p>
                    <p className="text-xs text-[#FBF7EF]/60 max-w-[200px] mx-auto leading-relaxed font-medium">Join a discovery workshop to start exploring your fascia.</p>
                </motion.div>
            ) : relevant.map(r => {
                const cls = classes.find(c => c.id === r.classId);
                if (!cls) return null;

                return (
                  <motion.div 
                      key={r.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="rounded-[2rem] p-5 sm:p-7 mb-6 bg-[#6E7568] shadow-xl border border-[#FBF7EF]/10"
                  >
                      <div className="flex justify-between items-start mb-5 sm:mb-6">
                          <div className="flex-1 pr-4">
                              <h3 className="text-lg sm:text-xl text-[#FBF7EF] mb-2 font-bold leading-tight drop-shadow-sm">{cls.title}</h3>
                              <p className="text-[10px] font-bold text-[#FBF7EF]/80 uppercase tracking-widest flex items-center gap-2">
                                <CalendarIcon size={12} />
                                {formatDate(cls.dateTime)}
                              </p>
                          </div>
                          <div className={`px-3 py-1 rounded-full border text-[10px] sm:text-[9px] font-bold uppercase tracking-wider shadow-sm h-fit
                              ${r.status === 'confirmed' ? 'bg-[#FBF7EF] border-[#FBF7EF] text-[#6E7568]' : 'bg-[#462B2C]/40 border-[#462B2C]/50 text-[#FBF7EF]'}
                          `}>
                             {r.status === 'payment_review' ? 'In Review' : r.status}
                          </div>
                      </div>
                      
                      {r.status === 'payment_review' && (
                          <div className="bg-[#462B2C]/30 p-4 rounded-xl mb-5 sm:mb-6 border border-[#462B2C]/50">
                              <p className="text-xs text-[#FBF7EF] mb-1 font-bold">Payment Verifying...</p>
                              <p className="text-[10px] text-[#FBF7EF]/70">Admin will confirm your spot shortly.</p>
                          </div>
                      )}

                      <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-2">
                          <button 
                              onClick={() => onViewDetails(cls)}
                              className="bg-[#FBF7EF] text-[#26150B] rounded-2xl py-3 text-[10px] font-bold uppercase tracking-wider shadow-md hover:bg-white transition-colors flex flex-col items-center justify-center gap-1"
                          >
                              <ArticleIcon size={16} /> View
                          </button>
                          <button 
                              onClick={() => onShare(cls)}
                              className="bg-[#FBF7EF]/10 text-[#FBF7EF] rounded-2xl py-3 text-[10px] font-bold uppercase tracking-wider hover:bg-[#FBF7EF]/20 transition-colors flex flex-col items-center justify-center gap-1"
                          >
                              <ShareIcon size={16} /> Share
                          </button>
                          <button 
                              onClick={() => onCancelClick(r)}
                              className="bg-transparent border border-[#FBF7EF]/20 text-[#FBF7EF]/80 rounded-2xl py-3 text-[10px] font-bold uppercase tracking-wider hover:bg-[#FBF7EF]/10 hover:text-[#FBF7EF] transition-colors flex flex-col items-center justify-center gap-1"
                          >
                              <XIcon size={16} /> Cancel
                          </button>
                      </div>
                  </motion.div>
                );
            })}
            </AnimatePresence>
        </motion.div>
    );
};

//=============== Messages Screen ===============//
interface MessagesScreenProps {
    user: User;
    chatMessages: ChatMessage[];
    onSendChatMessage?: (content: string) => void;
}

const MessagesScreen: React.FC<MessagesScreenProps> = ({ user, chatMessages, onSendChatMessage }) => {
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [chatMessages]);

    const handleSend = () => {
        if (newMessage.trim() && onSendChatMessage) {
            onSendChatMessage(newMessage.trim());
            setNewMessage('');
        }
    };

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        
        if (isToday) {
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="p-6 pb-40 max-w-lg mx-auto h-[calc(100vh-200px)] flex flex-col"
        >
            <div className="flex items-center justify-center gap-4 mb-6 opacity-70">
                <div className="h-px w-8 bg-[#26150B]/20"></div>
                <h3 className="text-[10px] font-bold text-[#26150B] uppercase tracking-[3px]">Messages</h3>
                <div className="h-px w-8 bg-[#26150B]/20"></div>
            </div>

            {/* Chat Header */}
            <div className="bg-[#6E7568] rounded-2xl p-4 flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-[#FBF7EF]/20 flex items-center justify-center">
                    <MessageIcon size={24} className="text-[#FBF7EF]" />
                </div>
                <div className="flex-1">
                    <h3 className="text-sm font-bold text-[#FBF7EF]">Support Chat</h3>
                    <p className="text-[10px] text-[#FBF7EF]/70">Chat with our team</p>
                </div>
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            </div>

            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto space-y-3 bg-white rounded-2xl p-4 border border-[#6E7568]/10 custom-scrollbar premium-card">
                {chatMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6">
                        <div className="w-16 h-16 rounded-full bg-[#6E7568]/10 flex items-center justify-center mb-4">
                            <MessageIcon size={28} className="text-[#6E7568]/50" />
                        </div>
                        <p className="text-sm font-bold text-[#26150B] mb-1">No messages yet</p>
                        <p className="text-xs text-[#6E7568]">Start a conversation with our team</p>
                    </div>
                ) : (
                    chatMessages.map((msg) => {
                        const isOwn = msg.senderId === user.id;
                        return (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`max-w-[80%] ${isOwn ? 'order-2' : 'order-1'}`}>
                                    {!isOwn && (
                                        <p className="text-[9px] font-bold text-[#6E7568] mb-1 ml-1">
                                            {msg.senderName}
                                        </p>
                                    )}
                                    <div
                                        className={`px-4 py-2.5 rounded-2xl ${
                                            isOwn
                                                ? 'bg-[#6E7568] text-[#FBF7EF] rounded-br-md'
                                                : 'bg-[#FBF7EF] text-[#26150B] border border-[#6E7568]/10 rounded-bl-md'
                                        }`}
                                    >
                                        <p className="text-xs leading-relaxed">{msg.content}</p>
                                    </div>
                                    <p className={`text-[9px] text-[#6E7568]/60 mt-1 ${isOwn ? 'text-right mr-1' : 'ml-1'}`}>
                                        {formatTime(msg.timestamp)}
                                    </p>
                                </div>
                            </motion.div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="mt-4 flex gap-2">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-3 bg-white border border-[#6E7568]/10 rounded-xl text-xs text-[#26150B] outline-none focus:border-[#6E7568]/30 transition-colors"
                />
                <button
                    onClick={handleSend}
                    disabled={!newMessage.trim()}
                    className="w-12 h-12 bg-[#6E7568] text-[#FBF7EF] rounded-xl flex items-center justify-center hover:bg-[#5a6155] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <SendIcon size={18} />
                </button>
            </div>
        </motion.div>
    );
};

//=============== Profile Screen (ENHANCED) ===============//
interface ProfileScreenProps {
    user: User;
    registrations: Registration[];
    classes: Class[];
    onUpdateUser?: (updates: Partial<User>) => void;
}
const ProfileScreen: React.FC<ProfileScreenProps> = ({ user, registrations, classes, onUpdateUser }) => {
    const [showMemberCard, setShowMemberCard] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [showReferralModal, setShowReferralModal] = useState(false);
    const [showCreditPackages, setShowCreditPackages] = useState(false);
    const [purchasingPackage, setPurchasingPackage] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        sport: user.sport || '',
        classReminderOptIn: user.classReminderOptIn ?? true
    });
    
    // Stats calculation - memoized to avoid recalculation on every render
    const attendedCount = useMemo(() => 
        registrations.filter(r => {
            const cls = classes.find(c => c.id === r.classId);
            return cls && new Date(cls.dateTime) < new Date() && r.status === 'confirmed';
        }).length,
        [registrations, classes]
    );

    const upcomingCount = useMemo(() => 
        registrations.filter(r => {
            const cls = classes.find(c => c.id === r.classId);
            return cls && new Date(cls.dateTime) > new Date() && r.status === 'confirmed';
        }).length,
        [registrations, classes]
    );

    const totalCredits = user.credits || 0;

    const pastClasses = useMemo(() => 
        registrations
            .filter(r => {
                const cls = classes.find(c => c.id === r.classId);
                return cls && new Date(cls.dateTime) < new Date() && r.status === 'confirmed';
            })
            .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime()),
        [registrations, classes]
    );

    const copyMemberId = () => {
        navigator.clipboard.writeText(user.id.toUpperCase());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Calculate member since date
    const memberSince = registrations.length > 0 
        ? new Date(Math.min(...registrations.map(r => new Date(r.registeredAt).getTime()))).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        : 'New Member';

    // Achievement badges based on attendance
    const achievements = [];
    if (attendedCount >= 1) achievements.push({ icon: '🌱', label: 'First Step', desc: 'Attended first class' });
    if (attendedCount >= 5) achievements.push({ icon: '🔥', label: 'On Fire', desc: '5 classes completed' });
    if (attendedCount >= 10) achievements.push({ icon: '⭐', label: 'Dedicated', desc: '10 classes completed' });
    if (attendedCount >= 20) achievements.push({ icon: '👑', label: 'Elite', desc: '20 classes completed' });

    return (
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="p-6 pb-40 max-w-lg mx-auto"
        >
            {/* Section Header */}
            <div className="flex items-center justify-center gap-4 mb-8 opacity-70">
                <div className="h-px w-8 bg-[#26150B]/20"></div>
                <h3 className="text-[10px] font-bold text-[#26150B] uppercase tracking-[3px]">My Profile</h3>
                <div className="h-px w-8 bg-[#26150B]/20"></div>
            </div>

            {/* Profile Hero Card */}
            <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="relative mb-6"
            >
                {/* Background gradient decoration */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#6E7568] to-[#4a524e] rounded-[2.5rem] shadow-2xl shadow-[#6E7568]/30" />
                
                {/* Decorative circles */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#FBF7EF]/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#FBF7EF]/5 rounded-full translate-y-1/2 -translate-x-1/2" />
                
                <div className="relative p-8">
                    {/* Avatar and Edit Button */}
                    <div className="flex flex-col items-center text-center mb-6">
                        <div className="relative mb-4">
                            <motion.div 
                                whileHover={{ scale: 1.05 }}
                                className="w-24 h-24 rounded-full bg-gradient-to-br from-[#FBF7EF] to-[#e8e4dc] flex items-center justify-center text-[#26150B] text-3xl font-bold shadow-xl border-4 border-[#FBF7EF]/30"
                            >
                                {user.name.charAt(0)}
                            </motion.div>
                            {/* Status indicator */}
                            <div className="absolute bottom-1 right-1 w-6 h-6 bg-green-500 rounded-full border-4 border-[#6E7568] flex items-center justify-center">
                                <CheckIcon size={10} className="text-white stroke-[3]" />
                            </div>
                        </div>
                        
                        <h2 className="text-2xl text-[#FBF7EF] font-bold mb-1">{user.name}</h2>
                        <p className="text-xs text-[#FBF7EF]/60 font-medium flex items-center gap-2">
                            <MailIcon size={12} />
                            {user.email}
                        </p>
                        {user.sport && (
                            <div className="mt-2 px-3 py-1 rounded-full bg-[#FBF7EF]/10 border border-[#FBF7EF]/20">
                                <p className="text-[10px] font-bold text-[#FBF7EF]/80 uppercase tracking-wider flex items-center gap-1">
                                    <TargetIcon size={10} />
                                    {user.sport}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-3">
                        <motion.div 
                            whileHover={{ scale: 1.02 }}
                            className="bg-[#26150B]/20 backdrop-blur-sm rounded-2xl p-4 border border-[#FBF7EF]/5 text-center"
                        >
                            <div className="w-8 h-8 rounded-full bg-[#FBF7EF]/10 flex items-center justify-center mx-auto mb-2">
                                <CheckIcon size={14} className="text-[#FBF7EF]" />
                            </div>
                            <p className="text-2xl font-bold text-[#FBF7EF] mb-1">{attendedCount}</p>
                            <p className="text-[8px] uppercase tracking-widest text-[#FBF7EF]/50 font-bold">Attended</p>
                        </motion.div>
                        <motion.div 
                            whileHover={{ scale: 1.02 }}
                            className="bg-[#26150B]/20 backdrop-blur-sm rounded-2xl p-4 border border-[#FBF7EF]/5 text-center"
                        >
                            <div className="w-8 h-8 rounded-full bg-[#FBF7EF]/10 flex items-center justify-center mx-auto mb-2">
                                <CalendarIcon size={14} className="text-[#FBF7EF]" />
                            </div>
                            <p className="text-2xl font-bold text-[#FBF7EF] mb-1">{upcomingCount}</p>
                            <p className="text-[8px] uppercase tracking-widest text-[#FBF7EF]/50 font-bold">Upcoming</p>
                        </motion.div>
                        <motion.div 
                            whileHover={{ scale: 1.02 }}
                            className="bg-[#26150B]/20 backdrop-blur-sm rounded-2xl p-4 border border-[#FBF7EF]/5 text-center"
                        >
                            <div className="w-8 h-8 rounded-full bg-[#FBF7EF]/10 flex items-center justify-center mx-auto mb-2">
                                <ZapIcon size={14} className="text-[#FBF7EF]" />
                            </div>
                            <p className="text-2xl font-bold text-[#FBF7EF] mb-1">{totalCredits}</p>
                            <p className="text-[8px] uppercase tracking-widest text-[#FBF7EF]/50 font-bold">Credits</p>
                        </motion.div>
                    </div>
                </div>
            </motion.div>

            {/* Achievements Section */}
            {achievements.length > 0 && (
                <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="mb-6"
                >
                    <h4 className="text-xs font-bold text-[#26150B]/60 uppercase tracking-widest mb-3 ml-1 flex items-center gap-2">
                        <AwardIcon size={14} />
                        Achievements
                    </h4>
                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                        {achievements.map((achievement, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.3 + idx * 0.1 }}
                                className="flex-shrink-0 bg-gradient-to-br from-[#6E7568] to-[#5a6155] rounded-2xl p-4 min-w-[100px] text-center shadow-lg"
                            >
                                <span className="text-2xl mb-1 block">{achievement.icon}</span>
                                <p className="text-[10px] font-bold text-[#FBF7EF] mb-0.5">{achievement.label}</p>
                                <p className="text-[8px] text-[#FBF7EF]/50">{achievement.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Digital Member Card */}
            <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mb-6"
            >
                <h4 className="text-xs font-bold text-[#26150B]/60 uppercase tracking-widest mb-3 ml-1 flex items-center gap-2">
                    <CreditCardIcon size={14} />
                    Member Card
                </h4>
                <motion.div 
                    whileHover={{ scale: 1.01 }}
                    onClick={() => setShowMemberCard(true)}
                    className="rounded-[1.5rem] overflow-hidden shadow-xl cursor-pointer group"
                >
                    {/* Card with gradient */}
                    <div className="relative p-6 bg-gradient-to-br from-[#6E7568] via-[#5a6155] to-[#4a524e]">
                        {/* Decorative elements */}
                        <div className="absolute top-0 right-0 w-40 h-40 bg-[#FBF7EF]/5 rounded-full -translate-y-1/2 translate-x-1/4" />
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#FBF7EF]/3 rounded-full translate-y-1/3 -translate-x-1/4" />
                        
                        {/* Card content */}
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-2">
                                    <PauseLogo size="sm" light />
                                    <div className="h-4 w-px bg-[#FBF7EF]/20" />
                                    <p className="text-[9px] uppercase tracking-[2px] font-bold text-[#FBF7EF]/50">Member Access</p>
                                </div>
                                <div className="bg-white/90 p-1.5 rounded-lg shadow-lg premium-card">
                                    <QrCodeIcon size={28} className="text-[#26150B]"/>
                                </div>
                            </div>
                            
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-[#FBF7EF]/40 mb-1">Member ID</p>
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-mono text-[#FBF7EF] tracking-wider">{user.id.toUpperCase().slice(0, 8)}...</p>
                                        <motion.button
                                            whileTap={{ scale: 0.9 }}
                                            onClick={(e) => { e.stopPropagation(); copyMemberId(); }}
                                            className="text-[#FBF7EF]/40 hover:text-[#FBF7EF] transition-colors"
                                        >
                                            {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
                                        </motion.button>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-[#FBF7EF]/40 mb-1">Member Since</p>
                                    <p className="text-sm font-bold text-[#FBF7EF]">{memberSince}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Tap to expand hint */}
                    <div className="bg-[#26150B]/5 px-6 py-2 text-center">
                        <p className="text-[9px] text-[#26150B]/40 font-medium">Tap to view full card</p>
                    </div>
                </motion.div>
            </motion.div>

            {/* Quick Actions */}
            <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.35 }}
                className="mb-6"
            >
                <h4 className="text-xs font-bold text-[#26150B]/60 uppercase tracking-widest mb-3 ml-1 flex items-center gap-2">
                    <SparklesIcon size={14} />
                    Quick Actions
                </h4>
                <div className="space-y-2">
                    <motion.button 
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowReferralModal(true)}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white border border-[#26150B]/5 shadow-sm hover:shadow-md transition-all"
                    >
                        <div className="w-10 h-10 rounded-full bg-[#6E7568]/10 flex items-center justify-center">
                            <GiftIcon size={18} className="text-[#6E7568]" />
                        </div>
                        <div className="flex-1 text-left">
                            <p className="text-sm font-bold text-[#26150B]">Refer a Friend</p>
                            <p className="text-[10px] text-[#26150B]/50">Share the experience & earn rewards</p>
                        </div>
                        <ChevronRightIcon size={16} className="text-[#26150B]/30" />
                    </motion.button>
                    <motion.button 
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setIsEditing(true)}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white border border-[#26150B]/5 shadow-sm hover:shadow-md transition-all"
                    >
                        <div className="w-10 h-10 rounded-full bg-[#6E7568]/10 flex items-center justify-center">
                            <Edit3Icon size={18} className="text-[#6E7568]" />
                        </div>
                        <div className="flex-1 text-left">
                            <p className="text-sm font-bold text-[#26150B]">Edit Profile</p>
                            <p className="text-[10px] text-[#26150B]/50">Update your personal information</p>
                        </div>
                        <ChevronRightIcon size={16} className="text-[#26150B]/30" />
                    </motion.button>
                    <motion.button 
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowCreditPackages(true)}
                        disabled={true}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#6E7568]/50 border border-[#6E7568]/20 shadow-sm transition-all opacity-60 cursor-not-allowed"
                    >
                        <div className="w-10 h-10 rounded-full bg-[#FBF7EF]/20 flex items-center justify-center">
                            <GiftIcon size={18} className="text-[#FBF7EF]" />
                        </div>
                        <div className="flex-1 text-left">
                            <p className="text-sm font-bold text-[#FBF7EF]">Buy Credits</p>
                            <p className="text-[10px] text-[#FBF7EF]/60">Temporarily unavailable - contact us</p>
                        </div>
                        <ChevronRightIcon size={16} className="text-[#FBF7EF]/40" />
                    </motion.button>
                </div>
            </motion.div>

            {/* Session History */}
            <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
            >
                <h4 className="text-xs font-bold text-[#26150B]/60 uppercase tracking-widest mb-3 ml-1 flex items-center gap-2">
                    <CalendarIcon size={14} />
                    Session History
                </h4>
                <div className="space-y-2">
                    {pastClasses.length > 0 ? (
                        pastClasses.slice(0, 5).map((r, idx) => {
                            const cls = classes.find(c => c.id === r.classId);
                            if (!cls) return null;
                            return (
                                <motion.div 
                                    key={r.id}
                                    initial={{ x: -20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: 0.45 + idx * 0.05 }}
                                    className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-[#26150B]/5 shadow-sm hover:shadow-md transition-all"
                                >
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6E7568] to-[#5a6155] flex items-center justify-center text-[#FBF7EF] shadow-md">
                                        <CheckIcon size={16} />
                                    </div>
                                    <div className="flex-1">
                                        <h5 className="text-sm font-bold text-[#26150B] leading-tight mb-1">{cls.title}</h5>
                                        <p className="text-[10px] text-[#26150B]/50 uppercase tracking-wider">{formatDate(cls.dateTime)}</p>
                                    </div>
                                    <div className="px-2 py-1 rounded-full bg-[#6E7568]/10">
                                        <p className="text-[9px] font-bold text-[#6E7568] uppercase">Completed</p>
                                    </div>
                                </motion.div>
                            )
                        })
                    ) : (
                        <div className="text-center py-12 rounded-2xl bg-[#26150B]/5 border border-[#26150B]/5">
                            <div className="w-16 h-16 rounded-full bg-[#6E7568]/10 flex items-center justify-center mx-auto mb-4">
                                <CalendarIcon size={24} className="text-[#6E7568]/40" />
                            </div>
                            <p className="text-sm text-[#26150B]/40 font-medium mb-1">No workshops yet</p>
                            <p className="text-[10px] text-[#26150B]/30">Your journey begins here!</p>
                        </div>
                    )}
                    {pastClasses.length > 5 && (
                        <motion.button 
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            className="w-full py-3 text-center text-[10px] font-bold text-[#6E7568] uppercase tracking-wider hover:text-[#26150B] transition-colors"
                        >
                            View All ({pastClasses.length} sessions)
                        </motion.button>
                    )}
                </div>
            </motion.div>

            {/* Full Member Card Modal */}
            <AnimatePresence>
                {showMemberCard && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-[#26150B]/90 backdrop-blur-md z-[200] flex items-center justify-center p-6"
                        onClick={() => setShowMemberCard(false)}
                    >
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="w-full max-w-sm"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Full Card */}
                            <div className="rounded-[2rem] overflow-hidden shadow-2xl">
                                <div className="relative p-8 bg-gradient-to-br from-[#6E7568] via-[#5a6155] to-[#4a524e]">
                                    {/* Decorative */}
                                    <div className="absolute inset-0 overflow-hidden">
                                        <div className="absolute top-0 right-0 w-48 h-48 bg-[#FBF7EF]/5 rounded-full -translate-y-1/2 translate-x-1/4" />
                                        <div className="absolute bottom-0 left-0 w-40 h-40 bg-[#FBF7EF]/3 rounded-full translate-y-1/3 -translate-x-1/4" />
                                        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-[#FBF7EF]/2 rounded-full -translate-x-1/2 -translate-y-1/2" />
                                    </div>
                                    
                                    <div className="relative z-10">
                                        {/* Header */}
                                        <div className="flex items-center justify-between mb-8">
                                            <div className="flex items-center gap-3">
                                                <PauseLogo size="md" light />
                                                <div className="h-6 w-px bg-[#FBF7EF]/20" />
                                                <p className="text-[10px] uppercase tracking-[2px] font-bold text-[#FBF7EF]/50">Movement Dome</p>
                                            </div>
                                        </div>

                                        {/* QR Code */}
                                        <div className="flex justify-center mb-8">
                                            <div className="bg-white p-4 rounded-2xl shadow-xl premium-card">
                                                <QrCodeIcon size={120} className="text-[#26150B]"/>
                                            </div>
                                        </div>

                                        {/* Member Info */}
                                        <div className="text-center mb-6">
                                            <h3 className="text-xl text-[#FBF7EF] font-bold mb-1">{user.name}</h3>
                                            <p className="text-xs text-[#FBF7EF]/60 font-medium">{user.sport || 'General Member'}</p>
                                        </div>

                                        {/* Details Grid */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-[#26150B]/20 backdrop-blur-sm rounded-xl p-3 text-center border border-[#FBF7EF]/5">
                                                <p className="text-[8px] font-bold uppercase tracking-widest text-[#FBF7EF]/40 mb-1">Member ID</p>
                                                <p className="text-xs font-mono text-[#FBF7EF] tracking-wider">{user.id.toUpperCase()}</p>
                                            </div>
                                            <div className="bg-[#26150B]/20 backdrop-blur-sm rounded-xl p-3 text-center border border-[#FBF7EF]/5">
                                                <p className="text-[8px] font-bold uppercase tracking-widest text-[#FBF7EF]/40 mb-1">Member Since</p>
                                                <p className="text-xs font-bold text-[#FBF7EF]">{memberSince}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Close Button */}
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setShowMemberCard(false)}
                                className="w-full mt-6 py-4 bg-[#FBF7EF] rounded-full text-[10px] font-bold uppercase tracking-widest text-[#26150B] shadow-lg"
                            >
                                Close
                            </motion.button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Referral Modal */}
            <AnimatePresence>
                {showReferralModal && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-[#26150B]/90 backdrop-blur-md z-[200] flex items-end justify-center pb-safe"
                        onClick={() => setShowReferralModal(false)}
                    >
                        <motion.div 
                            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 30, stiffness: 300 }}
                            className="bg-[#FBF7EF] rounded-t-[2.5rem] p-8 w-full max-w-md shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex justify-center mb-6">
                                <div className="w-12 h-1 rounded-full bg-[#26150B]/10" />
                            </div>
                            
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#6E7568] to-[#5a6155] flex items-center justify-center mx-auto mb-6 shadow-lg">
                                <GiftIcon size={28} className="text-[#FBF7EF]" />
                            </div>
                            
                            <h2 className="text-2xl text-[#26150B] mb-2 font-bold tracking-tight text-center">Refer a Friend</h2>
                            <p className="text-xs text-[#26150B]/60 text-center mb-8">Share the experience and earn rewards when they join!</p>
                            
                            {/* Referral Code */}
                            <div className="bg-[#6E7568]/5 p-6 rounded-2xl mb-6 border border-[#6E7568]/10">
                                <p className="text-[10px] font-bold text-[#6E7568] uppercase tracking-widest mb-2 text-center">Your Referral Code</p>
                                <div className="flex items-center justify-center gap-3">
                                    <p className="text-2xl font-mono font-bold text-[#26150B] tracking-wider">{user.id.slice(0, 8).toUpperCase()}</p>
                                    <motion.button
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => {
                                            navigator.clipboard.writeText(user.id.slice(0, 8).toUpperCase());
                                            alert('Referral code copied!');
                                        }}
                                        className="p-2 rounded-lg bg-[#6E7568]/10 hover:bg-[#6E7568]/20 transition-colors"
                                    >
                                        <CopyIcon size={16} className="text-[#6E7568]" />
                                    </motion.button>
                                </div>
                            </div>

                            {/* Share Options */}
                            <div className="flex gap-4 mb-6">
                                <button 
                                    onClick={() => {
                                        const shareText = `Join me at The Fascia Movement Dome! Use my referral code: ${user.id.slice(0, 8).toUpperCase()} for special benefits. Book your first class at https://tfmd-booking-app.vercel.app`;
                                        navigator.clipboard.writeText(shareText);
                                        alert('Referral message copied!');
                                    }}
                                    className="flex-1 bg-[#26150B]/5 hover:bg-[#26150B]/10 p-4 rounded-2xl flex flex-col items-center gap-2 transition-colors"
                                >
                                    <div className="w-10 h-10 rounded-full bg-[#FBF7EF] flex items-center justify-center shadow-sm text-[#26150B]">
                                        <ShareIcon size={18}/>
                                    </div>
                                    <span className="text-[10px] font-bold uppercase text-[#26150B]/60">Copy Link</span>
                                </button>
                                <a 
                                    href={`https://wa.me/?text=${encodeURIComponent(`Join me at The Fascia Movement Dome! Use my referral code: ${user.id.slice(0, 8).toUpperCase()} for special benefits. Book your first class at https://tfmd-booking-app.vercel.app`)}`}
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="flex-1 bg-[#26150B]/5 hover:bg-[#26150B]/10 p-4 rounded-2xl flex flex-col items-center gap-2 transition-colors"
                                >
                                    <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center shadow-sm text-white">
                                        <ShareIcon size={18}/>
                                    </div>
                                    <span className="text-[10px] font-bold uppercase text-[#26150B]/60">WhatsApp</span>
                                </a>
                            </div>

                            <button 
                                onClick={() => setShowReferralModal(false)} 
                                className="w-full bg-white border border-[#26150B]/10 text-[#26150B] rounded-full py-4 text-[10px] font-bold uppercase tracking-widest hover:bg-[#FBF7EF] premium-hover"
                            >
                                Close
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Credit Purchase Modal */}
            <AnimatePresence>
                {showCreditPackages && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-[#26150B]/90 backdrop-blur-md z-[200] flex items-end justify-center pb-safe"
                        onClick={() => setShowCreditPackages(false)}
                    >
                        <motion.div 
                            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 30, stiffness: 300 }}
                            className="bg-[#FBF7EF] rounded-t-[2.5rem] p-8 w-full max-w-md shadow-2xl max-h-[85vh] overflow-y-auto"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex justify-center mb-6">
                                <div className="w-12 h-1 rounded-full bg-[#26150B]/10" />
                            </div>
                            
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#6E7568] to-[#5a6155] flex items-center justify-center mx-auto mb-6 shadow-lg">
                                <CreditCardIcon size={28} className="text-[#FBF7EF]" />
                            </div>
                            
                            <h2 className="text-2xl text-[#26150B] mb-2 font-bold tracking-tight text-center">Purchase Credits</h2>
                            
                            {/* Payment Unavailable Notice */}
                            <div className="w-full bg-[#6E7568]/10 border-2 border-[#6E7568]/30 rounded-xl p-4 mb-4 text-center">
                                <p className="font-bold text-[#26150B] text-sm">Credit Purchase Temporarily Unavailable</p>
                                <p className="text-xs text-[#26150B]/60 mt-1">Please contact us to purchase credits</p>
                            </div>
                            
                            <p className="text-xs text-[#26150B]/60 text-center mb-4">Credit packages (R150 each):</p>
                            
                            {/* Credit Packages List - Disabled */}
                            <div className="space-y-4 mb-6">
                                {CREDIT_PACKAGES.filter(p => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map((pkg: CreditPackage) => (
                                    <div
                                        key={pkg.id}
                                        className="w-full bg-white/50 border-2 border-[#6E7568]/20 rounded-2xl p-4 text-left opacity-60"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h3 className="text-base font-bold text-[#26150B]">{pkg.name}</h3>
                                                <p className="text-[10px] text-[#26150B]/50">{pkg.description}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-bold text-[#6E7568]">R{pkg.price}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-[#26150B]">{pkg.credits} credits</span>
                                            {pkg.bonusCredits && pkg.bonusCredits > 0 && (
                                                <span className="px-2 py-0.5 bg-[#6E7568]/10 text-[10px font-bold text-[#6E7568] rounded-full">
                                                    +{pkg.bonusCredits} bonus
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button 
                                onClick={() => setShowCreditPackages(false)} 
                                className="w-full bg-white border border-[#26150B]/10 text-[#26150B] rounded-full py-4 text-[10px] font-bold uppercase tracking-widest hover:bg-[#FBF7EF] premium-hover"
                            >
                                Close
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Edit Profile Modal */}
            <AnimatePresence>
                {isEditing && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-[#26150B]/90 backdrop-blur-md z-[200] flex items-end justify-center pb-safe"
                        onClick={() => setIsEditing(false)}
                    >
                        <motion.div 
                            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 30, stiffness: 300 }}
                            className="bg-[#FBF7EF] rounded-t-[2.5rem] p-8 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex justify-center mb-6">
                                <div className="w-12 h-1 rounded-full bg-[#26150B]/10" />
                            </div>
                            
                            <h2 className="text-2xl text-[#26150B] mb-2 font-bold tracking-tight text-center">Edit Profile</h2>
                            <p className="text-xs text-[#26150B]/60 text-center mb-8">Update your personal information</p>
                            
                            <div className="space-y-4 mb-8">
                                <div>
                                    <label className="block text-xs font-bold text-[#26150B]/70 mb-2 uppercase tracking-wider">Full Name</label>
                                    <input 
                                        type="text"
                                        value={editForm.name}
                                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                        className="w-full bg-[#26150B]/5 border border-[#26150B]/10 rounded-xl p-4 text-sm text-[#26150B] outline-none focus:border-[#6E7568] transition-colors"
                                        placeholder="Enter your name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[#26150B]/70 mb-2 uppercase tracking-wider">Email</label>
                                    <input 
                                        type="email"
                                        value={editForm.email}
                                        onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                        className="w-full bg-[#26150B]/5 border border-[#26150B]/10 rounded-xl p-4 text-sm text-[#26150B] outline-none focus:border-[#6E7568] transition-colors"
                                        placeholder="Enter your email"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[#26150B]/70 mb-2 uppercase tracking-wider">Phone</label>
                                    <input 
                                        type="tel"
                                        value={editForm.phone}
                                        onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                                        className="w-full bg-[#26150B]/5 border border-[#26150B]/10 rounded-xl p-4 text-sm text-[#26150B] outline-none focus:border-[#6E7568] transition-colors"
                                        placeholder="Enter your phone number"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[#26150B]/70 mb-2 uppercase tracking-wider">Sport / Activity</label>
                                    <input 
                                        type="text"
                                        value={editForm.sport}
                                        onChange={e => setEditForm({ ...editForm, sport: e.target.value })}
                                        className="w-full bg-[#26150B]/5 border border-[#26150B]/10 rounded-xl p-4 text-sm text-[#26150B] outline-none focus:border-[#6E7568] transition-colors"
                                        placeholder="e.g., Yoga, Running, CrossFit"
                                    />
                                </div>
                                
                                {/* Notification Preferences */}
                                <div className="bg-[#6E7568]/5 rounded-xl p-4 space-y-3">
                                    <label className="block text-xs font-bold text-[#26150B]/70 uppercase tracking-wider">Notification Preferences</label>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-[#26150B] font-medium">Class Reminders</p>
                                            <p className="text-xs text-[#26150B]/50">Get reminded about upcoming classes</p>
                                        </div>
                                        <button 
                                            onClick={() => setEditForm({ ...editForm, classReminderOptIn: !editForm.classReminderOptIn })}
                                            className={`relative w-12 h-6 rounded-full transition-colors ${editForm.classReminderOptIn ? 'bg-[#6E7568]' : 'bg-[#26150B]/20'}`}
                                        >
                                            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${editForm.classReminderOptIn ? 'left-7' : 'left-1'}`}></span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setIsEditing(false)} 
                                    className="flex-1 bg-transparent border border-[#26150B]/10 text-[#26150B] rounded-full py-4 text-[10px] font-bold uppercase tracking-widest hover:bg-[#26150B]/5"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={() => {
                                        if (onUpdateUser) {
                                            onUpdateUser({
                                                name: editForm.name,
                                                email: editForm.email,
                                                phone: editForm.phone,
                                                sport: editForm.sport,
                                                classReminderOptIn: editForm.classReminderOptIn
                                            });
                                        }
                                        setIsEditing(false);
                                    }} 
                                    className="flex-1 bg-[#6E7568] text-[#FBF7EF] rounded-full py-4 text-[10px] font-bold uppercase tracking-widest hover:bg-[#5a6155] shadow-lg"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

//=============== Modals ===============//

const ShareModal: React.FC<{ cls: Class; user: User; venues: Venue[]; onClose: () => void }> = ({ cls, user, venues, onClose }) => {
    const venue = getVenue(cls.venueId, venues);
    
    // Select a template based on sport tags, or default to first available
    const template = MOCK_TEMPLATES.find(t => t.sportTags.some(tag => cls.sportTags.includes(tag))) || MOCK_TEMPLATES[3];
    
    const shareText = renderTemplate(template.whatsappBody, cls, venue, user);
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    
    const copyToClipboard = () => {
        navigator.clipboard.writeText(shareText);
        alert("Invite message copied!");
        onClose();
    };

    return (
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#26150B]/90 backdrop-blur-md z-[200] flex items-end justify-center pb-safe"
            onClick={onClose}
        >
            <motion.div 
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="bg-[#FBF7EF] rounded-t-[2.5rem] p-8 w-full max-w-md shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-center mb-6">
                    <div className="w-12 h-1 rounded-full bg-[#26150B]/10" />
                </div>
                <h2 className="text-xl text-[#26150B] mb-2 font-bold tracking-tight text-center">Share Workshop</h2>
                <p className="text-xs text-[#26150B]/60 text-center mb-8">Invite friends to {cls.title}</p>
                
                <div className="bg-[#26150B]/5 p-4 rounded-xl mb-6 border border-[#26150B]/5">
                    <p className="text-[10px] text-[#26150B]/40 font-bold uppercase tracking-widest mb-2">Message Preview</p>
                    <p className="text-xs text-[#26150B]/80 font-mono whitespace-pre-wrap">{shareText}</p>
                </div>
                
                <div className="flex gap-4 mb-6">
                    <button onClick={copyToClipboard} className="flex-1 bg-[#26150B]/5 hover:bg-[#26150B]/10 p-4 rounded-2xl flex flex-col items-center gap-2 transition-colors">
                        <div className="w-10 h-10 rounded-full bg-[#FBF7EF] flex items-center justify-center shadow-sm text-[#26150B]">
                            <ShareIcon size={18}/>
                        </div>
                        <span className="text-[10px] font-bold uppercase text-[#26150B]/60">Copy Text</span>
                    </button>
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex-1 bg-[#26150B]/5 hover:bg-[#26150B]/10 p-4 rounded-2xl flex flex-col items-center gap-2 transition-colors">
                         <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center shadow-sm text-white">
                            <ShareIcon size={18}/> {/* Ideally Whatsapp Icon */}
                        </div>
                        <span className="text-[10px] font-bold uppercase text-[#26150B]/60">WhatsApp</span>
                    </a>
                </div>

                <button onClick={onClose}                     className="w-full bg-white border border-[#26150B]/10 text-[#26150B] rounded-full py-4 text-[10px] font-bold uppercase tracking-widest hover:bg-[#FBF7EF] premium-hover">
                    Cancel
                </button>
            </motion.div>
        </motion.div>
    );
};

const CancellationModal: React.FC<{ reg: Registration; cls: Class; onClose: () => void; onConfirm: () => void }> = ({ cls, onClose, onConfirm }) => (
    <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-[#26150B]/90 backdrop-blur-md z-[200] flex items-center justify-center p-6"
        onClick={onClose}
    >
        <motion.div 
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
            className="bg-[#FBF7EF] rounded-[2rem] p-8 w-full max-w-sm shadow-2xl text-center"
            onClick={e => e.stopPropagation()}
        >
            <div className="w-16 h-16 rounded-full bg-[#26150B]/5 flex items-center justify-center mx-auto mb-6 text-[#26150B]">
                <AlertIcon size={32} />
            </div>
            <h2 className="text-xl text-[#26150B] mb-2 font-bold">Cancel Registration?</h2>
            <p className="text-xs text-[#26150B]/60 mb-8 leading-relaxed">
                Are you sure you want to cancel your spot for <br/>
                <span className="font-bold text-[#26150B]">{cls.title}</span>?
                <br/>This action cannot be undone.
            </p>
            <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 bg-transparent border border-[#26150B]/10 text-[#26150B] rounded-full py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-[#26150B]/5">
                    Keep Spot
                </button>
                <button onClick={onConfirm} className="flex-1 bg-[#26150B] text-[#FBF7EF] rounded-full py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-[#26150B]/90 shadow-lg">
                    Yes, Cancel
                </button>
            </div>
        </motion.div>
    </motion.div>
);

interface InsufficientCreditsModalProps {
    user: User;
    requiredCredits: number;
    onClose: () => void;
    onPurchaseComplete: () => void;
}

const InsufficientCreditsModal: React.FC<InsufficientCreditsModalProps> = ({ user, requiredCredits, onClose, onPurchaseComplete }) => {
    const [purchasingPackage, setPurchasingPackage] = useState<string | null>(null);
    
    const userCredits = user.credits || 0;
    const creditsNeeded = requiredCredits - userCredits;
    
    const handlePurchase = async (pkg: CreditPackage) => {
        setPurchasingPackage(pkg.id);
        try {
            const response = await fetch('/api/credits/purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    packageId: pkg.id,
                    userId: user.id,
                    email: user.email,
                    name: user.name
                })
            });
            const data = await response.json();
            if (data.paymentLink) {
                window.location.href = data.paymentLink;
            } else {
                alert('Failed to create payment link. Please try again.');
            }
        } catch (error) {
            console.error('Purchase error:', error);
            alert('Failed to create payment link. Please try again.');
        } finally {
            setPurchasingPackage(null);
        }
    };
    
    const suggestedPackage = CREDIT_PACKAGES
        .filter(p => p.isActive && p.credits >= creditsNeeded)
        .sort((a, b) => a.credits - b.credits)[0];

    return (
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#26150B]/90 backdrop-blur-md z-[200] flex items-end justify-center pb-safe"
            onClick={onClose}
        >
            <motion.div 
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="bg-[#FBF7EF] rounded-t-[2.5rem] p-8 w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-center mb-6">
                    <div className="w-12 h-1 rounded-full bg-[#26150B]/10" />
                </div>
                
                <div className="w-16 h-16 rounded-full bg-[#C05640]/10 flex items-center justify-center mx-auto mb-6">
                    <ZapIcon size={32} className="text-[#C05640]" />
                </div>
                
                <h2 className="text-2xl text-[#26150B] mb-2 font-bold tracking-tight text-center">Need More Credits</h2>
                <p className="text-xs text-[#26150B]/60 text-center mb-6">
                    This class requires <span className="font-bold text-[#26150B]">{requiredCredits} credit{requiredCredits > 1 ? 's' : ''}</span>, but you only have <span className="font-bold text-[#26150B]">{userCredits}</span>.
                </p>
                
                <div className="bg-[#6E7568]/5 rounded-2xl p-4 mb-6 border border-[#6E7568]/10">
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-[#26150B]/60 font-bold uppercase tracking-wider">Credits Needed</span>
                        <span className="text-lg font-extrabold text-[#26150B]">+{creditsNeeded}</span>
                    </div>
                </div>
                
                {suggestedPackage && (
                    <div className="mb-6">
                        <p className="text-[10px] font-bold text-[#6E7568] uppercase tracking-widest mb-3 text-center">Recommended Package</p>
                        <motion.button
                            whileTap={{ scale: 0.98 }}
                            disabled={purchasingPackage !== null}
                            onClick={() => handlePurchase(suggestedPackage)}
                            className="w-full bg-[#6E7568] border-2 border-[#6E7568] rounded-2xl p-4 text-left hover:bg-[#5a6155] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-base font-bold text-[#FBF7EF]">{suggestedPackage.name}</h3>
                                    <p className="text-[10px] text-[#FBF7EF]/60">{suggestedPackage.description}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold text-[#FBF7EF]">R{suggestedPackage.price}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-sm font-bold text-[#FBF7EF]">{suggestedPackage.credits} credits</span>
                                {suggestedPackage.bonusCredits && suggestedPackage.bonusCredits > 0 && (
                                    <span className="px-2 py-0.5 bg-[#FBF7EF]/20 text-[10px] font-bold text-[#FBF7EF] rounded-full">
                                        +{suggestedPackage.bonusCredits} bonus
                                    </span>
                                )}
                            </div>
                            {purchasingPackage === suggestedPackage.id && (
                                <div className="mt-3 flex items-center justify-center gap-2 text-[#FBF7EF]">
                                    <div className="w-4 h-4 border-2 border-[#FBF7EF]/30 border-t-[#FBF7EF] rounded-full animate-spin" />
                                    <span className="text-xs font-medium">Processing...</span>
                                </div>
                            )}
                        </motion.button>
                    </div>
                )}
                
                <div className="mb-6">
                    <p className="text-[10px] font-bold text-[#26150B]/40 uppercase tracking-widest mb-3 text-center">Or Choose Another Package</p>
                    <div className="space-y-3 max-h-[200px] overflow-y-auto">
                        {CREDIT_PACKAGES.filter(p => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map((pkg: CreditPackage) => (
                            <motion.button
                                key={pkg.id}
                                whileTap={{ scale: 0.98 }}
                                disabled={purchasingPackage !== null}
                                onClick={() => handlePurchase(pkg)}
                                className="w-full bg-white border-2 border-[#26150B]/10 rounded-xl p-3 text-left hover:border-[#26150B]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-sm font-bold text-[#26150B]">{pkg.name}</h3>
                                        <p className="text-[9px] text-[#26150B]/50">{pkg.description}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-[#6E7568]">R{pkg.price}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs font-bold text-[#26150B]">{pkg.credits} credits</span>
                                    {pkg.bonusCredits && pkg.bonusCredits > 0 && (
                                        <span className="px-1.5 py-0.5 bg-[#6E7568]/10 text-[8px] font-bold text-[#6E7568] rounded-full">
                                            +{pkg.bonusCredits} bonus
                                        </span>
                                    )}
                                </div>
                            </motion.button>
                        ))}
                    </div>
                </div>
                
                <div className="bg-[#6E7568]/5 rounded-xl p-4 mb-6 border border-[#6E7568]/10">
                    <p className="text-[10px] text-[#26150B]/60 text-center">
                        After purchase, your credits will be added automatically. Return to this class and complete your booking.
                    </p>
                </div>
                
                <button 
                    onClick={onClose} 
                    className="w-full bg-white border border-[#26150B]/10 text-[#26150B] rounded-full py-4 text-[10px] font-bold uppercase tracking-widest hover:bg-[#FBF7EF] premium-hover"
                >
                    Cancel
                </button>
            </motion.div>
        </motion.div>
    );
};

const RegistrationConfirmModal: React.FC<{ cls: Class; settings: AppSettings; venues: Venue[]; user: User; onClose: (proof?: string, notes?: string, optInReminder?: boolean, injuries?: InjuryRecord[]) => void; onBuyCredits?: () => void }> = ({ cls, settings, venues, user, onClose, onBuyCredits }) => {
    const venue = getVenue(cls.venueId, venues);
    const isFree = cls.price === 0;
    const creditCost = cls.creditCost || 0;
    const userCredits = user.credits || 0;
    const hasEnoughCredits = creditCost === 0 || userCredits >= creditCost;
    const [step, setStep] = useState<'details' | 'payment' | 'success'>('details');
    const [proof, setProof] = useState<string | undefined>(undefined);
    const [notes, setNotes] = useState("");
    const [optInReminder, setOptInReminder] = useState(true);
    const [injuries, setInjuries] = useState<InjuryRecord[]>(user.injuries || []);
    const [showInjuryForm, setShowInjuryForm] = useState(false);
    const [editingInjury, setEditingInjury] = useState<InjuryRecord | null>(null);
    const [injuryForm, setInjuryForm] = useState<Partial<InjuryRecord>>({
        area: 'neck',
        severity: 'minor',
        description: ''
    });

    const BODY_AREA_OPTIONS = [
        { value: 'neck', label: 'Neck' },
        { value: 'shoulders', label: 'Shoulders' },
        { value: 'spine', label: 'Spine' },
        { value: 'lower_back', label: 'Lower Back' },
        { value: 'hips', label: 'Hips' },
        { value: 'knees', label: 'Knees' },
        { value: 'ankles', label: 'Ankles' },
        { value: 'wrists', label: 'Wrists' },
        { value: 'full_body', label: 'Full Body' },
    ];

    const SEVERITY_OPTIONS = [
        { value: 'minor', label: 'Minor', color: 'bg-green-100 text-green-800' },
        { value: 'moderate', label: 'Moderate', color: 'bg-yellow-100 text-yellow-800' },
        { value: 'severe', label: 'Severe', color: 'bg-red-100 text-red-800' },
        { value: 'recovered', label: 'Recovered', color: 'bg-blue-100 text-blue-800' },
    ];

    const handleAddInjury = () => {
        if (!injuryForm.area || !injuryForm.description) return;
        
        const newInjury: InjuryRecord = {
            id: `inj-${Date.now()}`,
            area: injuryForm.area as BodyArea,
            severity: injuryForm.severity as 'minor' | 'moderate' | 'severe' | 'recovered',
            description: injuryForm.description,
            injuryType: injuryForm.injuryType as InjuryRecord['injuryType'],
            notes: injuryForm.notes,
            modifications: injuryForm.modifications,
            dateOccurred: injuryForm.dateOccurred,
        };
        
        setInjuries([...injuries, newInjury]);
        setInjuryForm({ area: 'neck', severity: 'minor', description: '' });
        setShowInjuryForm(false);
        setEditingInjury(null);
    };

    const handleUpdateInjury = () => {
        if (!editingInjury || !injuryForm.description) return;
        
        const updated = injuries.map(i => 
            i.id === editingInjury.id 
                ? { ...i, ...injuryForm } as InjuryRecord 
                : i
        );
        setInjuries(updated);
        setInjuryForm({ area: 'neck', severity: 'minor', description: '' });
        setShowInjuryForm(false);
        setEditingInjury(null);
    };

    const handleDeleteInjury = (injuryId: string) => {
        setInjuries(injuries.filter(i => i.id !== injuryId));
    };

    const openEditInjury = (injury: InjuryRecord) => {
        setEditingInjury(injury);
        setInjuryForm({
            area: injury.area,
            severity: injury.severity,
            description: injury.description,
            injuryType: injury.injuryType,
            notes: injury.notes,
            modifications: injury.modifications,
            dateOccurred: injury.dateOccurred,
        });
        setShowInjuryForm(true);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProof(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleConfirm = () => {
        if (isFree) {
            // Show success screen for free classes
            setStep('success');
        } else {
            setStep('payment');
        }
    };
    
    const handlePaymentSubmit = () => {
        if (!proof) return alert("Please upload proof of payment");
        onClose(proof, notes, optInReminder, injuries);
    };

    const handleSuccessClose = () => {
        onClose(undefined, notes, optInReminder, injuries);
    };

    return (
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#26150B]/90 backdrop-blur-md z-[200] flex items-end justify-center pb-safe"
            onClick={() => onClose()}
        >
            <motion.div 
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="bg-[#FBF7EF] rounded-t-[2.5rem] p-8 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-center mb-6">
                    <div className="w-12 h-1 rounded-full bg-[#26150B]/10" />
                </div>

                {step === 'details' && (
                    <>
                        <h2 className="text-2xl text-[#26150B] mb-2 font-bold tracking-tight text-center">Select Your Spot</h2>
                        <p className="text-xs text-[#26150B]/60 text-center mb-4">Tap an available circle to claim it</p>

                        {/* Visual Booking Selector */}
                        <DomeBookingSelector 
                            capacity={cls.capacity} 
                            registeredCount={cls.registered} 
                            onSelect={() => {}} // Visual feedback only handled internally by visual component or assume 'next available'
                        />

                        <div className="space-y-6 mb-8 mt-6">
                            <div className="flex justify-between items-center py-4 border-b border-[#26150B]/5">
                                <span className="text-xs text-[#26150B]/60 font-bold uppercase tracking-wider">Class</span>
                                <span className="text-sm font-bold text-[#26150B] text-right max-w-[60%]">{cls.title}</span>
                            </div>
                            <div className="flex justify-between items-center py-4 border-b border-[#26150B]/5">
                                <span className="text-xs text-[#26150B]/60 font-bold uppercase tracking-wider">Date</span>
                                <span className="text-sm font-bold text-[#26150B]">{formatDate(cls.dateTime)}</span>
                            </div>
                            <div className="flex justify-between items-center py-4 border-b border-[#26150B]/5">
                                <span className="text-xs text-[#26150B]/60 font-bold uppercase tracking-wider">Total</span>
                                <span className="text-xl font-extrabold text-[#26150B]">{isFree ? "Free" : `R ${cls.price}`}</span>
                            </div>
                            
                            {/* Injury Management Section */}
                            <div className="bg-[#6E7568]/5 rounded-xl p-4">
                                <div className="flex justify-between items-center mb-3">
                                    <label className="block text-xs font-bold text-[#26150B]/70 uppercase tracking-wider">Injuries / Health</label>
                                    <button 
                                        onClick={() => {
                                            setEditingInjury(null);
                                            setInjuryForm({ area: 'neck', severity: 'minor', description: '' });
                                            setShowInjuryForm(true);
                                        }}
                                        className="text-[10px] font-bold text-[#6E7568] uppercase tracking-wider flex items-center gap-1"
                                    >
                                        <span>+ Add</span>
                                    </button>
                                </div>
                                
                                {/* Existing Injuries List */}
                                {injuries.length > 0 ? (
                                    <div className="space-y-2 mb-3">
                                        {injuries.map((injury) => (
                                            <div key={injury.id} className="bg-white rounded-lg p-3 border border-[#26150B]/10">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-xs font-bold text-[#26150B] capitalize">{injury.area.replace('_', ' ')}</span>
                                                            <span className={`text-[9px] px-2 py-0.5 rounded-full ${
                                                                injury.severity === 'minor' ? 'bg-green-100 text-green-800' :
                                                                injury.severity === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                                                                injury.severity === 'severe' ? 'bg-red-100 text-red-800' :
                                                                'bg-blue-100 text-blue-800'
                                                            }`}>
                                                                {injury.severity}
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] text-[#26150B]/70">{injury.description}</p>
                                                    </div>
                                                    <div className="flex gap-1 ml-2">
                                                        <button 
                                                            onClick={() => openEditInjury(injury)}
                                                            className="text-[#26150B]/40 hover:text-[#26150B] p-1"
                                                        >
                                                            <Edit3Icon size={12} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteInjury(injury.id)}
                                                            className="text-[#26150B]/40 hover:text-red-500 p-1"
                                                        >
                                                            <XIcon size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-[#26150B]/50 mb-3">No injuries added. Tap "+ Add" to record any injuries or health conditions.</p>
                                )}
                                
                                {/* Notes Textarea */}
                                <label className="block text-xs font-bold text-[#26150B]/70 mb-2 uppercase tracking-wider">Additional Notes</label>
                                <textarea 
                                    className="w-full bg-white border border-[#26150B]/10 rounded-xl p-3 text-xs text-[#26150B] outline-none focus:border-[#26150B]/30 h-20 resize-none"
                                    placeholder="Any other notes for the teacher..."
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                />
                            </div>
                            
                            {/* Class Reminder Opt-In */}
                            <div className="bg-[#6E7568]/5 rounded-xl p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-[#26150B] font-medium">Class Reminders</p>
                                    <p className="text-xs text-[#26150B]/50">Get reminded about upcoming classes</p>
                                </div>
                                <button 
                                    onClick={() => setOptInReminder(!optInReminder)}
                                    className={`relative w-12 h-6 rounded-full transition-colors ${optInReminder ? 'bg-[#6E7568]' : 'bg-[#26150B]/20'}`}
                                >
                                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${optInReminder ? 'left-7' : 'left-1'}`}></span>
                                </button>
                            </div>
                        </div>

                        <button onClick={handleConfirm} className="w-full btn-primary rounded-full py-4 text-xs font-bold uppercase tracking-widest shadow-lg">
                            {isFree ? "Confirm Registration" : "Proceed to Payment"}
                        </button>
                    </>
                )}

                {step === 'payment' && (
                    <>
                        <h2 className="text-2xl text-[#26150B] mb-2 font-bold tracking-tight">Payment</h2>
                        <p className="text-xs text-[#26150B]/60 mb-6">Scan with Zapper or your banking app.</p>
                        
                        <div className="bg-white p-6 rounded-2xl shadow-inner border border-[#26150B]/5 mb-6 flex justify-center">
                            {settings.zapperQrBase64 ? (
                                <img src={settings.zapperQrBase64} alt="Zapper QR" className="w-48 h-48 max-w-full object-contain" loading="lazy" />
                            ) : (
                                <div className="w-48 h-48 flex items-center justify-center text-xs text-gray-400 bg-gray-100 rounded">No QR Code</div>
                            )}
                        </div>

                        <div className="mb-8">
                             <label className="block text-xs font-bold text-[#26150B]/70 mb-3 uppercase tracking-wider">Upload Proof of Payment</label>
                             <div className="relative">
                                 <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" id="proof-upload" />
                                 <label htmlFor="proof-upload" className={`w-full p-4 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors ${proof ? 'border-[#6E7568] bg-[#6E7568]/5 text-[#6E7568]' : 'border-[#26150B]/20 hover:border-[#26150B]/40 text-[#26150B]/40'}`}>
                                    {proof ? (
                                        <div className="flex items-center gap-2">
                                            <CheckIcon size={16} /> <span className="text-xs font-bold">Proof Uploaded</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <CameraIcon size={16} /> <span className="text-xs font-bold">Tap to Upload</span>
                                        </div>
                                    )}
                                 </label>
                             </div>
                        </div>

                        <button onClick={handlePaymentSubmit} disabled={!proof} className="w-full btn-primary rounded-full py-4 text-xs font-bold uppercase tracking-widest shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                            Submit Payment
                        </button>
                        <button onClick={() => setStep('details')} className="w-full mt-3 py-3 text-[10px] font-bold uppercase tracking-widest text-[#26150B]/40 hover:text-[#26150B]">
                            Back
                        </button>
                    </>
                )}

                {step === 'success' && (
                    <>
                        <motion.div 
                            initial={{ scale: 0 }} animate={{ scale: 1 }}
                            transition={{ type: "spring", damping: 15, stiffness: 300 }}
                            className="w-20 h-20 rounded-full bg-[#6E7568] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-[#6E7568]/30"
                        >
                            <CheckIcon size={40} className="text-[#FBF7EF] stroke-[3]" />
                        </motion.div>
                        
                        <h2 className="text-2xl text-[#26150B] mb-2 font-bold tracking-tight text-center">You're Booked!</h2>
                        <p className="text-xs text-[#26150B]/60 text-center mb-8">Your spot has been confirmed</p>
                        
                        <div className="bg-[#6E7568]/5 rounded-2xl p-6 mb-8 border border-[#6E7568]/10">
                            <div className="flex justify-between items-center mb-4 pb-4 border-b border-[#26150B]/5">
                                <span className="text-xs text-[#26150B]/60 font-bold uppercase tracking-wider">Class</span>
                                <span className="text-sm font-bold text-[#26150B] text-right max-w-[60%]">{cls.title}</span>
                            </div>
                            <div className="flex justify-between items-center mb-4 pb-4 border-b border-[#26150B]/5">
                                <span className="text-xs text-[#26150B]/60 font-bold uppercase tracking-wider">Date</span>
                                <span className="text-sm font-bold text-[#26150B]">{formatDate(cls.dateTime)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-[#26150B]/60 font-bold uppercase tracking-wider">Status</span>
                                <span className="px-3 py-1 rounded-full bg-[#6E7568] text-[#FBF7EF] text-[10px] font-bold uppercase tracking-wider">Confirmed</span>
                            </div>
                        </div>

                        {/* Add to Calendar Buttons */}
                        <div className="mb-6">
                            <p className="text-[10px] font-bold text-[#26150B]/60 uppercase tracking-wider mb-3 text-center">Add to Calendar</p>
                            <div className="flex gap-3">
                                <a 
                                    href={generateGoogleCalendarUrl(cls, venue)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 bg-[#6E7568] text-[#FBF7EF] rounded-full py-3 text-[10px] font-bold uppercase tracking-wider shadow-lg hover:bg-[#5a6155] transition-colors flex items-center justify-center gap-2"
                                >
                                    <GoogleIcon size={14} />
                                    Google
                                </a>
                                <button 
                                    onClick={() => downloadICSFile(cls, venue)}
                                    className="flex-1 bg-white border border-[#26150B]/10 text-[#26150B] rounded-full py-3 text-[10px] font-bold uppercase tracking-wider hover:bg-[#FBF7EF] transition-colors premium-hover flex items-center justify-center gap-2"
                                >
                                    <DownloadIcon size={14} />
                                    Apple/Outlook
                                </button>
                            </div>
                        </div>

                        <button onClick={handleSuccessClose} className="w-full btn-primary rounded-full py-4 text-xs font-bold uppercase tracking-widest shadow-lg">
                            View My Bookings
                        </button>
                    </>
                )}

                {/* Injury Form Modal */}
                <AnimatePresence>
                    {showInjuryForm && (
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-[#26150B]/90 backdrop-blur-md z-[300] flex items-end justify-center pb-safe"
                            onClick={() => setShowInjuryForm(false)}
                        >
                            <motion.div 
                                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                                className="bg-[#FBF7EF] rounded-t-[2.5rem] p-6 w-full max-w-md max-h-[80vh] overflow-y-auto shadow-2xl"
                                onClick={e => e.stopPropagation()}
                            >
                                <div className="flex justify-center mb-4">
                                    <div className="w-10 h-1 rounded-full bg-[#26150B]/10" />
                                </div>

                                <h3 className="text-lg text-[#26150B] mb-4 font-bold text-center">
                                    {editingInjury ? 'Edit Injury' : 'Add Injury'}
                                </h3>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-[#26150B]/70 mb-2 uppercase tracking-wider">Body Area</label>
                                        <select 
                                            value={injuryForm.area}
                                            onChange={e => setInjuryForm({ ...injuryForm, area: e.target.value as BodyArea })}
                                            className="w-full bg-white border border-[#26150B]/10 rounded-xl p-3 text-sm text-[#26150B] outline-none focus:border-[#26150B]/30"
                                        >
                                            {BODY_AREA_OPTIONS.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-[#26150B]/70 mb-2 uppercase tracking-wider">Severity</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {SEVERITY_OPTIONS.map(opt => (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => setInjuryForm({ ...injuryForm, severity: opt.value as InjuryRecord['severity'] })}
                                                    className={`p-2 rounded-lg text-xs font-bold border transition-colors ${
                                                        injuryForm.severity === opt.value 
                                                            ? 'border-[#6E7568] bg-[#6E7568] text-white' 
                                                            : 'border-[#26150B]/10 text-[#26150B]/60 hover:border-[#26150B]/30'
                                                    }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-[#26150B]/70 mb-2 uppercase tracking-wider">Description</label>
                                        <textarea 
                                            value={injuryForm.description}
                                            onChange={e => setInjuryForm({ ...injuryForm, description: e.target.value })}
                                            className="w-full bg-white border border-[#26150B]/10 rounded-xl p-3 text-xs text-[#26150B] outline-none focus:border-[#26150B]/30 h-20 resize-none"
                                            placeholder="Describe the injury or condition..."
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-[#26150B]/70 mb-2 uppercase tracking-wider">Movement Modifications</label>
                                        <textarea 
                                            value={injuryForm.modifications}
                                            onChange={e => setInjuryForm({ ...injuryForm, modifications: e.target.value })}
                                            className="w-full bg-white border border-[#26150B]/10 rounded-xl p-3 text-xs text-[#26150B] outline-none focus:border-[#26150B]/30 h-16 resize-none"
                                            placeholder="Any modifications needed for this area?"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <button 
                                        onClick={() => {
                                            setShowInjuryForm(false);
                                            setEditingInjury(null);
                                        }}
                                        className="flex-1 bg-transparent border border-[#26150B]/10 text-[#26150B] rounded-full py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-[#26150B]/5"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={editingInjury ? handleUpdateInjury : handleAddInjury}
                                        disabled={!injuryForm.description}
                                        className="flex-1 bg-[#6E7568] text-[#FBF7EF] rounded-full py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-[#5a6155] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {editingInjury ? 'Update' : 'Add Injury'}
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    );
};

// Detail Modal
const ClassDetailModal: React.FC<{ cls: Class, venues: Venue[], onClose: () => void }> = ({ cls, venues, onClose }) => {
    const venue = getVenue(cls.venueId, venues);
    const isDome = isDomeVenue(venue?.name);
    const { endTime, hasBuffer, nextAvailable } = getEndTimeWithReset(
        cls.dateTime, 
        cls.duration, 
        isDome, 
        cls.allowDomeResetOverride
    );
    const startTime = formatTime(cls.dateTime);
    
    return (
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#26150B]/90 backdrop-blur-md z-[200] flex items-end justify-center pb-safe"
            onClick={onClose}
        >
            <motion.div 
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="bg-[#FBF7EF] rounded-t-[2.5rem] p-8 pt-10 pb-10 w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-center mb-6">
                    <div className="w-12 h-1 rounded-full bg-[#26150B]/20" />
                </div>
                <h2 className="text-2xl text-[#26150B] mb-2 font-bold tracking-tight">{cls.title}</h2>
                <div className="flex flex-wrap gap-2 mb-6">
                    {cls.sportTags.map(tag => (
                        <span key={tag} className="px-2 py-1 rounded-md bg-[#6E7568]/10 text-[#6E7568] text-[10px] font-bold uppercase tracking-wider">{tag}</span>
                    ))}
                </div>
                
                <div className="space-y-6 mb-8">
                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#6E7568]/10 flex items-center justify-center text-[#6E7568]">
                            <ClockIcon size={20} />
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-[#6E7568] uppercase tracking-wider mb-1">Time</h4>
                            <p className="text-sm text-[#26150B] font-bold">{startTime} - {endTime}</p>
                            {hasBuffer && (
                                <p className="text-xs text-[#6E7568]/70 mt-1">
                                    Next class available at: {nextAvailable}
                                    <span className="ml-1 px-1.5 py-0.5 bg-[#6E7568]/10 text-[#6E7568] text-[9px] rounded-full">
                                        +30 min reset
                                    </span>
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#6E7568]/10 flex items-center justify-center text-[#6E7568]">
                            <InfoIcon size={20} />
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-[#6E7568] uppercase tracking-wider mb-1">Description</h4>
                            <p className="text-sm text-[#26150B]/80 leading-relaxed">{cls.description}</p>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#6E7568]/10 flex items-center justify-center text-[#6E7568]">
                            <MapPinIcon size={20} />
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-[#6E7568] uppercase tracking-wider mb-1">Location</h4>
                            <p className="text-sm text-[#26150B] font-bold">{venue?.name}</p>
                            <p className="text-xs text-[#26150B]/60 mb-2">{venue?.address}</p>
                            <a href={venue?.mapsUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-[#6E7568] underline decoration-[#6E7568]/30">Open in Maps</a>
                        </div>
                    </div>
                </div>

                <button onClick={onClose} className="w-full bg-[#6E7568] text-[#FBF7EF] rounded-full py-4 px-6 text-[10px] font-bold uppercase tracking-[0.2em] shadow-lg hover:bg-[#5a6155] transition-colors">
                    Close
                </button>
            </motion.div>
        </motion.div>
    );
};

//=============== Main Client App ===============//
interface ClientAppProps {
  user: User;
  onSignOut: () => void;
  classes: Class[];
  registrations: Registration[];
  venues: Venue[];
  settings: AppSettings;
  onRegister: (cls: Class, proof?: string, notes?: string, injuries?: InjuryRecord[]) => void;
  onCancel: (regId: string) => void;
  onUpdateUser?: (updates: Partial<User>) => void;
  chatMessages?: ChatMessage[];
  onSendChatMessage?: (content: string) => void;
  unreadChatCount?: number;
}

export const ClientApp: React.FC<ClientAppProps> = ({ user, onSignOut, classes, registrations, venues, settings, onRegister, onCancel, onUpdateUser, chatMessages = [], onSendChatMessage, unreadChatCount = 0 }) => {
  const [tab, setTab] = useState<ClientTab>('classes');
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [showDetail, setShowDetail] = useState<boolean>(false);
  const [showCancel, setShowCancel] = useState<boolean>(false);
  const [showShare, setShowShare] = useState<boolean>(false);
  const [showCreditPurchase, setShowCreditPurchase] = useState<boolean>(false);
  
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [cancelReg, setCancelReg] = useState<Registration | null>(null);
  const [pendingClassForBooking, setPendingClassForBooking] = useState<Class | null>(null);

  const userCredits = user.credits || 0;

  const handleRegisterClick = useCallback((cls: Class) => {
    const creditCost = cls.creditCost || 0;
    
    if (creditCost > 0 && userCredits < creditCost) {
      setPendingClassForBooking(cls);
      setShowCreditPurchase(true);
      return;
    }
    
    setSelectedClass(cls);
    setShowConfirm(true);
  }, [userCredits]);

  const handlePurchaseComplete = useCallback(() => {
    if (pendingClassForBooking) {
      setShowCreditPurchase(false);
      setSelectedClass(pendingClassForBooking);
      setShowConfirm(true);
      setPendingClassForBooking(null);
    }
  }, [pendingClassForBooking]);

  const handleViewDetails = useCallback((cls: Class) => {
      setSelectedClass(cls);
      setShowDetail(true);
  }, []);

  const handleCancelClick = useCallback((reg: Registration) => {
      const cls = classes.find(c => c.id === reg.classId);
      if (cls) {
          setCancelReg(reg);
          setSelectedClass(cls);
          setShowCancel(true);
      }
  }, [classes]);

  const handleShareClick = useCallback((cls: Class) => {
      setSelectedClass(cls);
      setShowShare(true);
  }, []);

  const handleConfirmClose = useCallback((proof?: string, notes?: string, optInReminder?: boolean, injuries?: InjuryRecord[]) => {
    if (selectedClass) {
      if (optInReminder !== undefined) {
        onUpdateUser?.({ classReminderOptIn: optInReminder });
      }
      onRegister(selectedClass, proof, notes, injuries);
    }
    setShowConfirm(false);
    setTab('bookings'); 
  }, [selectedClass, onRegister, onUpdateUser]);

  const processCancellation = useCallback(() => {
      if (cancelReg) {
          onCancel(cancelReg.id);
          setShowCancel(false);
          setCancelReg(null);
      }
  }, [cancelReg, onCancel]);

  return (
    <div className="min-h-screen relative fascia-bg-light overflow-x-hidden">
      <div className="relative z-10 flex">
        {/* Desktop Sidebar Navigation - Hidden on mobile, visible on lg+ */}
        <nav className="hidden lg:flex lg:fixed lg:left-0 lg:top-0 lg:h-screen lg:w-64 lg:flex-col lg:bg-[#6E7568] lg:shadow-2xl lg:z-[100]">
          <div className="p-6 pb-4">
            <PauseLogo size="md" light />
          </div>
          <div className="flex-1 px-4 py-2">
            {[
              { id: 'classes', label: 'Sessions', icon: CalendarIcon },
              { id: 'bookings', label: 'Bookings', icon: BookingsIcon },
              { id: 'messages', label: 'Messages', icon: MessageIcon, badge: unreadChatCount },
              { id: 'profile', label: 'Profile', icon: PersonIcon }
            ].map((item) => {
              const isActive = tab === item.id;
              const IconComponent = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id as ClientTab)}
                  className={`w-full flex items-center gap-4 px-5 py-4 mb-2 rounded-2xl text-sm font-bold uppercase tracking-wider transition-all duration-300 relative ${
                    isActive
                      ? 'bg-[#FBF7EF] text-[#26150B] shadow-lg'
                      : 'text-[#FBF7EF] hover:bg-[#FBF7EF]/10'
                  }`}
                >
                  <IconComponent size={20} className={isActive ? 'text-[#26150B]' : 'text-[#FBF7EF]'} />
                  {item.label}
                  {item.badge && item.badge > 0 && (
                    <span className="ml-auto w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="p-4 border-t border-[#FBF7EF]/10">
            <button
              onClick={onSignOut}
              className="w-full flex items-center gap-3 px-5 py-3 rounded-xl text-[#FBF7EF]/60 hover:text-[#FBF7EF] hover:bg-[#FBF7EF]/10 transition-colors text-sm font-medium"
            >
              <LogOutIcon size={18} />
              Sign Out
            </button>
          </div>
        </nav>

        {/* Main Content Area - With left padding on desktop for sidebar */}
        <div className="flex-1 lg:ml-64">
          <HeaderBar user={user} onSignOut={onSignOut} showBack={tab !== 'classes'} onBack={() => setTab('classes')} onProfileClick={() => setTab('profile')} />
          <main className="flex-1 pb-mobile-nav">
            <AnimatePresence mode="wait">
              {tab === 'classes' && (
                <ClassesScreen 
                  key="classes" 
                  classes={classes} 
                  venues={venues}
                  onRegister={handleRegisterClick} 
                  registrations={registrations} 
                  onViewDetails={handleViewDetails}
                  onShare={handleShareClick}
                />
              )}
              {tab === 'bookings' && (
                <BookingsScreen 
                  key="bookings" 
                  classes={classes} 
                  userRegistrations={registrations} 
                  onCancelClick={handleCancelClick} 
                  onShare={handleShareClick}
                  onViewDetails={handleViewDetails}
                />
              )}
              {tab === 'messages' && (
                <MessagesScreen 
                  key="messages"
                  user={user}
                  chatMessages={chatMessages}
                  onSendChatMessage={onSendChatMessage}
                />
              )}
              {tab === 'profile' && <ProfileScreen key="profile" user={user} registrations={registrations} classes={classes} onUpdateUser={onUpdateUser} />}
            </AnimatePresence>
          </main>
          
          {/* Mobile Bottom Nav - Visible only on mobile, hidden on lg+ */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] pb-safe pt-3 px-4 md:px-8 bg-gradient-to-t from-[#FBF7EF] via-[#FBF7EF]/95 to-transparent pointer-events-none">
            <div className="max-w-7xl mx-auto mb-2 pointer-events-auto">
              {/* Inner shadow container for polished look */}
              <div className="bg-[#6E7568] backdrop-blur-xl p-3 md:p-4 rounded-3xl flex justify-between shadow-[inset_0_2px_4px_rgba(0,0,0,0.15),0_8px_32px_rgba(0,0,0,0.2)] border border-[#26150B]/10 ring-1 ring-white/10 gap-2 md:gap-4">
                {[
                  { id: 'classes', label: 'Sessions', icon: CalendarIcon }, 
                  { id: 'bookings', label: 'Bookings', icon: BookingsIcon }, 
                  { id: 'messages', label: 'Messages', icon: MessageIcon, badge: unreadChatCount },
                  { id: 'profile', label: 'Profile', icon: PersonIcon }
                ].map((item) => {
                    const isActive = tab === item.id;
                    const IconComponent = item.icon;
                    return (
                        <button key={item.id} onClick={() => setTab(item.id as ClientTab)} className={`flex-1 py-4 md:py-5 px-3 md:px-6 rounded-2xl text-[10px] md:text-[12px] lg:text-[14px] font-bold uppercase tracking-[0.15em] transition-all duration-500 relative overflow-hidden cursor-pointer group text-center touch-manipulation flex items-center justify-center gap-1 md:gap-2`}>
                          <span className={`relative z-10 transition-colors duration-300 flex items-center gap-1.5 ${isActive ? 'text-[#26150B]' : 'text-[#FBF7EF] group-hover:text-white'}`}>
                            <span>{item.label}</span>
                            {item.badge && item.badge > 0 && (
                              <span className="ml-1 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                                {item.badge > 9 ? '9+' : item.badge}
                              </span>
                            )}
                          </span>
                          {isActive && <motion.div layoutId="pill-bg" className="absolute inset-0 bg-[#FBF7EF] shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] rounded-2xl" transition={{ type: "spring", stiffness: 300, damping: 25 }} />}
                        </button>
                    )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
        <AnimatePresence>
        {showConfirm && selectedClass && (
            <RegistrationConfirmModal cls={selectedClass} settings={settings} venues={venues} user={user} onClose={handleConfirmClose} />
        )}
        {showDetail && selectedClass && (
            <ClassDetailModal cls={selectedClass} venues={venues} onClose={() => setShowDetail(false)} />
        )}
        {showCancel && selectedClass && cancelReg && (
            <CancellationModal 
                reg={cancelReg} 
                cls={selectedClass} 
                onClose={() => setShowCancel(false)} 
                onConfirm={processCancellation} 
            />
        )}
        {showShare && selectedClass && (
            <ShareModal cls={selectedClass} user={user} venues={venues} onClose={() => setShowShare(false)} />
        )}
        
        {showCreditPurchase && (
            <InsufficientCreditsModal 
                user={user}
                requiredCredits={pendingClassForBooking?.creditCost || 1}
                onClose={() => {
                    setShowCreditPurchase(false);
                    setPendingClassForBooking(null);
                }}
                onPurchaseComplete={handlePurchaseComplete}
            />
        )}
      </AnimatePresence>
    </div>
  );
};
