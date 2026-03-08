
import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { User, AdminSection, Class, Venue, Template, Registration, AppSettings, WaiverData, ClientAnalytics, RecurringClassConfig, AdminRole, ROLE_PERMISSIONS, ChatMessage, Teacher, Feedback, FeedbackStats, Disclaimer, DisclaimerSection } from '../types';
import { ChatWidget, AdminChatView } from '../components/ChatWidget';
import * as Icons from '../components/Icons';
import { formatDate, formatTime, getEndTime, isDomeVenue, getEndTimeWithReset } from '../utils';
import { AnimatePresence, motion } from 'framer-motion';
import { db } from '../services/db-supabase';
import { DEFAULT_CLASS_CAPACITY } from '../constants';
import { useToast } from '../components/Toast';

//=============== Admin Header Bar ===============//
interface AdminHeaderBarProps {
    user: User;
    onSignOut: () => void;
    showBack: boolean;
    onBack: () => void;
    onMenuClick: () => void;
}

const AdminHeaderBar: React.FC<AdminHeaderBarProps> = ({ user, onSignOut, showBack, onBack, onMenuClick }) => (
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
                        <Icons.ArrowLeftIcon size={18} />
                    </motion.button>
                ) : (
                    <motion.button 
                        key="menu"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={onMenuClick}
                        className="lg:hidden w-11 h-11 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-[#26150B] border border-[#26150B]/10 bg-[#26150B]/5 hover:bg-[#26150B]/10 transition-colors"
                    >
                        <Icons.MenuIcon size={18} />
                    </motion.button>
                )}
            </AnimatePresence>
            
            {showBack ? null : (
                <div className="flex flex-col justify-center h-full">
                    <p className="text-[10px] sm:text-[9px] font-bold text-[#26150B] uppercase tracking-[2px] opacity-60 leading-tight">Admin Panel</p>
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
                <Icons.LogOutIcon size={20} />
            </motion.button>
            
            <div className="w-11 h-11 sm:w-10 sm:h-10 rounded-full bg-[#6E7568] flex items-center justify-center shadow-lg shadow-[#6E7568]/20 text-[#FBF7EF] font-bold text-sm select-none border border-[#FBF7EF]/50">
                {user.name.charAt(0)}
            </div>
        </div>
    </header>
);

//=============== Utility Functions ===============//
const exportToCSV = (data: any[], filename: string, headers: string[]) => {
    if (data.length === 0) return;
    
    const csvContent = [
        headers.join(','),
        ...data.map(row => 
            headers.map(h => {
                const value = row[h];
                // Escape quotes and wrap in quotes if contains comma
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value ?? '';
            }).join(',')
        )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
};

//=============== Analytics Calculations ===============//
const calculateClientAnalytics = (registrations: Registration[], classes: Class[], users: User[]): ClientAnalytics[] => {
    const clientMap = new Map<string, ClientAnalytics>();
    
    // Group registrations by user
    registrations.forEach(r => {
        const existing = clientMap.get(r.userId) || {
            userId: r.userId,
            userName: r.userName,
            userEmail: r.userEmail || '',
            totalBookings: 0,
            attendedBookings: 0,
            cancelledBookings: 0,
            noShows: 0,
            lastAttendance: null,
            firstBooking: null,
            retentionScore: 0,
            churnRisk: 'low' as const,
            favoriteClassType: null,
            averageBookingsPerMonth: 0
        };
        
        existing.totalBookings++;
        
        if (r.status === 'confirmed') {
            existing.attendedBookings++;
            if (!existing.lastAttendance || new Date(r.registeredAt) > new Date(existing.lastAttendance)) {
                existing.lastAttendance = r.registeredAt;
            }
        } else if (r.status === 'cancelled') {
            existing.cancelledBookings++;
        }
        
        if (!existing.firstBooking || new Date(r.registeredAt) < new Date(existing.firstBooking)) {
            existing.firstBooking = r.registeredAt;
        }
        
        clientMap.set(r.userId, existing);
    });
    
    // Calculate retention scores and churn risk
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    
    return Array.from(clientMap.values()).map(client => {
        // Calculate average bookings per month
        const firstBookingDate = client.firstBooking ? new Date(client.firstBooking) : now;
        const monthsSinceFirst = Math.max(1, (now.getTime() - firstBookingDate.getTime()) / (30 * 24 * 60 * 60 * 1000));
        client.averageBookingsPerMonth = client.totalBookings / monthsSinceFirst;
        
        // Calculate retention score (0-100)
        const attendanceRate = client.totalBookings > 0 ? (client.attendedBookings / client.totalBookings) * 100 : 0;
        const recencyBonus = client.lastAttendance && new Date(client.lastAttendance) > thirtyDaysAgo ? 20 : 0;
        const frequencyBonus = client.averageBookingsPerMonth >= 2 ? 15 : client.averageBookingsPerMonth >= 1 ? 10 : 0;
        client.retentionScore = Math.min(100, Math.round(attendanceRate * 0.65 + recencyBonus + frequencyBonus));
        
        // Determine churn risk
        const lastAttendanceDate = client.lastAttendance ? new Date(client.lastAttendance) : sixtyDaysAgo;
        if (lastAttendanceDate < sixtyDaysAgo) {
            client.churnRisk = 'high';
        } else if (lastAttendanceDate < thirtyDaysAgo || client.retentionScore < 50) {
            client.churnRisk = 'medium';
        } else {
            client.churnRisk = 'low';
        }
        
        return client;
    });
};

// Lazy load MarketingApp for code splitting
const MarketingLazy = React.lazy(() => import('./MarketingApp').then(module => ({ default: module.MarketingApp })));

//=============== Admin Sidebar ===============//
interface AdminSidebarProps {
    user: User;
    onSignOut: () => void;
    activeSection: AdminSection;
    onSectionChange: (section: AdminSection) => void;
    isOpen: boolean;
    onClose: () => void;
}
const AdminSidebar: React.FC<AdminSidebarProps> = ({ user, onSignOut, activeSection, onSectionChange, isOpen, onClose }) => {
    const navItems = [
        { key: "dashboard", label: "Dashboard", icon: <Icons.GridIcon /> },
        { key: "analytics", label: "Analytics", icon: <Icons.TrendUpIcon /> },
        { key: "classes", label: "Classes", icon: <Icons.CalendarIcon /> },
        { key: "attendees", label: "Attendees", icon: <Icons.UsersIcon /> },
        { key: "crm", label: "Marketing", icon: <Icons.UsersIcon /> },
        { key: "messages", label: "Messages", icon: <Icons.MessageIcon /> },
        { key: "teachers", label: "Teachers", icon: <Icons.UsersIcon /> },
        { key: "venues", label: "Venues", icon: <Icons.LocationIcon /> },
        { key: "feedback", label: "Feedback", icon: <Icons.StarIcon /> },
        { key: "settings", label: "Settings", icon: <Icons.SettingsIcon /> },
    ];

    return (
        <>
            {/* Mobile Overlay */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-[#26150B]/80 backdrop-blur-sm z-[90] lg:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar Drawer - SAGE BACKGROUND */}
            <aside className={`
                fixed top-0 left-0 h-full w-64 bg-[#6E7568] border-r border-[#FBF7EF]/10 z-[100] transition-transform duration-300 ease-in-out overflow-y-auto
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                lg:translate-x-0 lg:fixed lg:h-screen lg:overflow-y-auto
                flex flex-col p-6 shadow-2xl
            `}>
                <div className="pb-8 border-b border-[#FBF7EF]/10 flex justify-between items-center">
                    <span className="text-[#FBF7EF] text-sm font-bold tracking-wide">The Fascia Movement</span>
                    <button onClick={onClose} className="lg:hidden text-[#FBF7EF] hover:bg-[#FBF7EF]/10 rounded-full p-1"><Icons.XIcon /></button>
                </div>
                
                <div className="mt-6 mb-2 text-[10px] font-bold text-[#FBF7EF]/40 tracking-[2px] uppercase">Menu</div>
                
                <nav className="flex-1 space-y-2 overflow-y-auto">
                    {navItems.map(item => (
                        <button key={item.key} onClick={() => { onSectionChange(item.key as AdminSection); onClose(); }}
                                className={`flex items-center gap-4 w-full p-3 rounded-xl text-left transition-all duration-200 text-xs font-semibold tracking-wide cursor-pointer 
                                ${activeSection === item.key 
                                    ? 'bg-[#FBF7EF] text-[#26150B] shadow-lg shadow-[#26150B]/10' 
                                    : 'text-[#FBF7EF]/70 hover:bg-[#FBF7EF]/10 hover:text-[#FBF7EF]'}`}>
                            {React.cloneElement(item.icon, { size: 18, className: 'text-inherit' })}
                            <span>{item.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="pt-6 border-t border-[#FBF7EF]/10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-[#26150B] flex items-center justify-center text-[#FBF7EF] text-xs font-bold border border-[#FBF7EF]/20">
                            {user.name.charAt(0)}
                        </div>
                        <div>
                            <p className="text-xs font-bold text-[#FBF7EF]">{user.name}</p>
                            <p className="text-[10px] text-[#FBF7EF]/60">Administrator</p>
                        </div>
                    </div>
                    <button onClick={onSignOut} className="w-full flex items-center justify-center gap-2 btn-glass rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer py-3">
                        <Icons.LogOutIcon size={16} /> Log Out
                    </button>
                </div>
            </aside>
        </>
    );
};

// Compact Stat Card (Light Mode) - Enhanced with gradient border
const StatCard = ({ label, value, icon, color, onClick }: { label: string, value: string | number, icon: React.ReactElement<{ size?: number }>, color: string, onClick?: () => void }) => (
    <div 
        onClick={onClick}
        className="relative rounded-2xl p-5 flex items-center justify-between group hover:-translate-y-1 transition-all duration-300 cursor-pointer"
    >
        {/* Gradient Border */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#6E7568]/30 via-[#C05640]/15 to-[#6E7568]/30 p-[1px]">
            <div className="absolute inset-0 rounded-2xl bg-white"></div>
        </div>
        
        <div className="relative z-10 flex items-center justify-between w-full">
            <div>
                <p className="text-[9px] text-[#6E7568] font-bold uppercase tracking-wider mb-1 opacity-80">{label}</p>
                <p className="text-2xl font-extrabold text-[#26150B] leading-none tracking-tight">{value}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#6E7568]/10 to-[#6E7568]/5 flex items-center justify-center text-[#6E7568] shadow-md group-hover:scale-110 transition-transform">
                {React.cloneElement(icon, { size: 20 })}
            </div>
        </div>
    </div>
);

//=============== Admin Dashboard Screen ===============//
interface AdminDashboardProps {
    classes: Class[];
    registrations: Registration[];
    venues: Venue[];
    onNavigate: (section: AdminSection) => void;
    onCopyInvite: () => void;
    activeSection: AdminSection;
}
const AdminDashboard: React.FC<AdminDashboardProps> = ({ classes, registrations, venues, onNavigate, onCopyInvite, activeSection }) => {
    const totalRegistered = registrations.length;
    const upcomingClasses = classes
        .filter(c => c.status === "published" && new Date(c.dateTime) > new Date())
        .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
    
    const nextClass = upcomingClasses[0];
    const pendingPayments = registrations.filter(r => r.status === 'payment_review').length;

    return (
        <div className="animate-fade-in space-y-8">
            {/* Header with selector on left, logo on right */}
            <div className="flex justify-between items-end border-b border-[#26150B]/5 pb-4">
                {/* Section Selector on Left */}
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => onNavigate('dashboard')}
                        className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${activeSection === 'dashboard' ? 'bg-[#6E7568] text-[#FBF7EF]' : 'bg-[#FBF7EF] text-[#26150B]/60 hover:bg-[#26150B]/5'}`}
                    >
                        Dashboard
                    </button>
                    <button 
                        onClick={() => onNavigate('classes')}
                        className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${activeSection === 'classes' ? 'bg-[#6E7568] text-[#FBF7EF]' : 'bg-[#FBF7EF] text-[#26150B]/60 hover:bg-[#26150B]/5'}`}
                    >
                        Classes
                    </button>
                    <button 
                        onClick={() => onNavigate('attendees')}
                        className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${activeSection === 'attendees' ? 'bg-[#6E7568] text-[#FBF7EF]' : 'bg-[#FBF7EF] text-[#26150B]/60 hover:bg-[#26150B]/5'}`}
                    >
                        Attendees
                    </button>
                </div>
                {/* Logo on Right */}
                <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                        <p className="text-xs font-bold text-[#26150B] bg-[#FBF7EF] px-3 py-1 rounded-full border border-[#26150B]/5">{new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                    </div>
                    <span className="text-[#6E7568] text-sm font-bold tracking-wide">The Fascia Movement</span>
                </div>
            </div>
            
            {/* HERO: Next Class Focus */}
            {nextClass ? (
                <div className="bg-gradient-to-br from-[#6E7568] to-[#5a6155] rounded-[2rem] p-8 text-[#FBF7EF] shadow-[0_20px_40px_-12px_rgba(110,117,104,0.4)] relative overflow-hidden border border-[#FBF7EF]/10 group">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none"></div>
                    <div className="absolute top-0 right-0 p-8 opacity-10 transform group-hover:scale-110 transition-transform duration-700">
                        <Icons.CalendarIcon size={140} />
                    </div>
                    
                    <div className="relative z-10 flex flex-col md:flex-row justify-between gap-8">
                        <div>
                            <div className="inline-flex items-center gap-2 bg-[#FBF7EF]/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-4 border border-[#FBF7EF]/20 shadow-sm">
                                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.5)]"></span> Next Session
                            </div>
                            <h2 className="text-3xl md:text-4xl font-extrabold mb-2 tracking-tight drop-shadow-sm">{nextClass.title}</h2>
                            <p className="text-sm opacity-90 font-medium flex items-center gap-2 bg-[#26150B]/10 w-fit px-3 py-1.5 rounded-lg backdrop-blur-sm">
                                <Icons.ClockIcon size={14} /> {formatDate(nextClass.dateTime)} • {formatTime(nextClass.dateTime)}
                            </p>
                        </div>
                        
                        <div className="flex items-center gap-6 bg-[#FBF7EF]/10 p-6 rounded-2xl backdrop-blur-md border border-[#FBF7EF]/20 shadow-inner">
                            <div className="text-center">
                                <p className="text-3xl font-bold leading-none">{nextClass.registered}</p>
                                <p className="text-[9px] uppercase tracking-widest opacity-60 font-bold mt-1">Going</p>
                            </div>
                            <div className="h-10 w-px bg-[#FBF7EF]/20"></div>
                            <div className="text-center">
                                <p className="text-3xl font-bold leading-none">{nextClass.capacity - nextClass.registered}</p>
                                <p className="text-[9px] uppercase tracking-widest opacity-60 font-bold mt-1">Open</p>
                            </div>
                            <div className="h-10 w-px bg-[#FBF7EF]/20"></div>
                            <div className="text-center">
                                <div className="w-12 h-12 rounded-full bg-[#FBF7EF] text-[#6E7568] flex items-center justify-center font-bold text-xs shadow-lg ring-4 ring-[#FBF7EF]/20">
                                    {Math.round((nextClass.registered / nextClass.capacity) * 100)}%
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative z-10 mt-8 flex gap-3">
                        <button onClick={() => onNavigate('attendees')} className="bg-[#FBF7EF] text-[#26150B] px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-white transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center gap-2">
                            <Icons.UsersIcon size={14} /> Manage Attendees
                        </button>
                        <button onClick={onCopyInvite} className="bg-[#FBF7EF]/10 backdrop-blur-sm text-[#FBF7EF] px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-[#FBF7EF]/20 transition-all border border-[#FBF7EF]/30 flex items-center gap-2 shadow-sm hover:shadow-md">
                            <Icons.ShareIcon size={14} /> Copy Invite
                        </button>
                    </div>
                </div>
            ) : (
                <div className="bg-[#FBF7EF]/50 border-2 border-dashed border-[#6E7568]/20 rounded-[2rem] p-12 text-center hover:bg-[#FBF7EF] transition-colors group">
                    <div className="w-16 h-16 bg-[#6E7568]/10 rounded-full flex items-center justify-center mx-auto mb-4 text-[#6E7568] group-hover:scale-110 transition-transform">
                        <Icons.CalendarIcon size={24} />
                    </div>
                    <p className="text-[#6E7568] font-bold mb-3 text-lg">No upcoming classes</p>
                    <button onClick={() => onNavigate('classes')} className="px-6 py-3 bg-[#6E7568] text-[#FBF7EF] rounded-full text-xs font-bold uppercase tracking-wider shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5">Schedule a class</button>
                </div>
            )}

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Members" value={totalRegistered} icon={<Icons.UsersIcon />} color="#462B2C" onClick={() => onNavigate('attendees')} />
                <StatCard label="Live Classes" value={upcomingClasses.length} icon={<Icons.CalendarIcon />} color="#6E7568" onClick={() => onNavigate('classes')} />
                <StatCard label="Action Required" value={pendingPayments} icon={<Icons.AlertIcon />} color="#26150B" onClick={() => onNavigate('attendees')} />
                <StatCard label="Est. Revenue" value={`R ${registrations.reduce((acc, r) => {
                    const c = classes.find(c => c.id === r.classId);
                    return acc + (c?.price || 0);
                }, 0)}`} icon={<Icons.TrendUpIcon />} color="#462B2C" />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Upcoming Schedule List */}
                <div className="lg:col-span-2 bg-white rounded-[2rem] p-6 border border-[#6E7568]/10 shadow-sm premium-card">
                    <div className="flex justify-between items-center mb-6 border-b border-[#FBF7EF] pb-4">
                        <h3 className="text-xs font-bold text-[#26150B] uppercase tracking-wider flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#6E7568]"></span> Upcoming Schedule
                        </h3>
                        <button onClick={() => onNavigate('classes')} className="text-[10px] font-bold text-[#6E7568] hover:text-[#26150B] bg-[#FBF7EF] px-3 py-1 rounded-full transition-colors">View All</button>
                    </div>
                    <div className="space-y-3">
                        {upcomingClasses.length > 0 ? upcomingClasses.slice(0, 5).map(c => (
                            <div key={c.id} className="flex justify-between items-center p-4 hover:bg-[#FBF7EF]/50 rounded-2xl transition-all group cursor-pointer border border-transparent hover:border-[#6E7568]/10 hover:shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="bg-[#FBF7EF] w-12 h-12 rounded-xl flex flex-col items-center justify-center text-[#6E7568] border border-[#6E7568]/10 shadow-sm group-hover:scale-105 transition-transform">
                                        <span className="text-[9px] font-bold uppercase tracking-wide">{new Date(c.dateTime).toLocaleString('en-US', { month: 'short' })}</span>
                                        <span className="text-lg font-extrabold leading-none">{new Date(c.dateTime).getDate()}</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-[#26150B] group-hover:text-[#6E7568] transition-colors">{c.title}</p>
                                        <p className="text-[10px] text-[#6E7568] font-medium mt-0.5 flex items-center gap-1">
                                            <Icons.ClockIcon size={10} /> {(() => { const v = venues.find(x => x.id === c.venueId); const id = isDomeVenue(v?.name); const { endTime: et, hasBuffer: hb } = getEndTimeWithReset(c.dateTime, c.duration, id, c.allowDomeResetOverride); return `${formatTime(c.dateTime)} - ${et}${hb ? ' (+reset)' : ''}`; })()}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="flex items-center gap-1.5 justify-end mb-1.5">
                                        <Icons.UsersIcon size={12} className="text-[#6E7568]" />
                                        <p className="text-xs font-bold text-[#26150B]">{c.registered}/{c.capacity}</p>
                                    </div>
                                    <div className="w-24 h-2 bg-[#FBF7EF] rounded-full border border-[#6E7568]/10 overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full ${c.registered >= c.capacity ? 'bg-red-400' : 'bg-[#6E7568]'}`} 
                                            style={{ width: `${Math.min((c.registered/c.capacity)*100, 100)}%`}}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-12 text-[#6E7568]/40 text-xs italic bg-[#FBF7EF]/30 rounded-xl border border-dashed border-[#6E7568]/10">No upcoming classes scheduled.</div>
                        )}
                    </div>
                </div>

                {/* Quick Actions & Occupancy Mini-Chart */}
                <div className="space-y-6">
                    <div className="relative rounded-[2rem] p-6">
                        {/* Gradient Border */}
                        <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-r from-[#6E7568]/20 via-[#C05640]/10 to-[#6E7568]/20 p-[1px]">
                            <div className="absolute inset-0 rounded-[2rem] bg-white"></div>
                        </div>
                        
                        <div className="relative z-10">
                            <h3 className="text-xs font-bold text-[#26150B] mb-6 uppercase tracking-wider border-b border-[#FBF7EF] pb-4 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#6E7568]"></span> Quick Actions
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <motion.button 
                                    whileHover={{ scale: 1.02, y: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => onNavigate('classes')} 
                                    className="p-4 rounded-2xl bg-gradient-to-br from-[#6E7568] to-[#5a6155] text-[#FBF7EF] flex flex-col items-center gap-2 text-center group shadow-lg hover:shadow-xl border border-[#FBF7EF]/10"
                                >
                                    <div className="bg-white/20 p-2 rounded-full shadow-md group-hover:scale-110 transition-transform">
                                        <Icons.PlusIcon size={18} />
                                    </div>
                                    <span className="text-[9px] font-bold uppercase tracking-wide">New Class</span>
                                </motion.button>
                                <motion.button 
                                    whileHover={{ scale: 1.02, y: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => onNavigate('attendees')} 
                                    className="p-4 rounded-2xl bg-gradient-to-br from-[#6E7568] to-[#5a6155] text-[#FBF7EF] flex flex-col items-center gap-2 text-center group shadow-lg hover:shadow-xl border border-[#FBF7EF]/10"
                                >
                                    <div className="bg-white/20 p-2 rounded-full shadow-md group-hover:scale-110 transition-transform">
                                        <Icons.CheckIcon size={18} />
                                    </div>
                                    <span className="text-[9px] font-bold uppercase tracking-wide">Check-ins</span>
                                </motion.button>
                            </div>
                        </div>
                    </div>

                    <div className="relative rounded-[2rem] p-6">
                        {/* Gradient Border */}
                        <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-r from-[#6E7568]/20 via-[#C05640]/10 to-[#6E7568]/20 p-[1px]">
                            <div className="absolute inset-0 rounded-[2rem] bg-white"></div>
                        </div>
                        
                        <div className="relative z-10">
                            <h3 className="text-xs font-bold text-[#26150B] mb-6 uppercase tracking-wider border-b border-[#FBF7EF] pb-4 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#6E7568]"></span> Weekly Load
                            </h3>
                        </div>
                        <div className="flex items-end justify-between h-32 gap-2 px-2 relative z-10">
                            {upcomingClasses.slice(0, 7).map((c, i) => {
                                const height = Math.max(10, (c.registered / c.capacity) * 100);
                                return (
                                    <div key={c.id} className="flex flex-col items-center gap-2 flex-1 group h-full justify-end">
                                        <div className="w-full bg-[#FBF7EF] rounded-t-lg relative h-full flex items-end overflow-hidden shadow-inner">
                                            <div 
                                                className="w-full bg-[#6E7568] group-hover:bg-[#C05640] transition-all duration-500 rounded-t-lg shadow-[0_0_10px_rgba(0,0,0,0.1)]" 
                                                style={{ height: `${height}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-[9px] font-bold text-[#6E7568] uppercase tracking-wider">{new Date(c.dateTime).toLocaleDateString('en-US', { weekday: 'narrow' })}</span>
                                    </div>
                                )
                            })}
                            {upcomingClasses.length === 0 && <div className="text-xs text-[#6E7568]/40 w-full text-center self-center italic">No data available</div>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

//=============== Admin Analytics Screen ===============//
interface AdminAnalyticsProps {
    classes: Class[];
    registrations: Registration[];
    users: User[];
    onShowToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}
const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ classes, registrations, users, onShowToast }) => {
    const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
    
    const analytics = useMemo(() => {
        const now = new Date();
        let filteredRegistrations = registrations;
        
        if (selectedPeriod !== 'all') {
            const daysAgo = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90;
            const cutoff = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
            filteredRegistrations = registrations.filter(r => new Date(r.registeredAt) >= cutoff);
        }
        
        const clientAnalytics = calculateClientAnalytics(filteredRegistrations, classes, users);
        
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        
        return {
            totalClients: clientAnalytics.length,
            activeClients: clientAnalytics.filter(c => c.lastAttendance && new Date(c.lastAttendance) > thirtyDaysAgo).length,
            atRiskClients: clientAnalytics.filter(c => c.churnRisk === 'high').length,
            churnedClients: clientAnalytics.filter(c => c.lastAttendance && new Date(c.lastAttendance) < sixtyDaysAgo).length,
            averageRetentionRate: clientAnalytics.length > 0 
                ? Math.round(clientAnalytics.reduce((acc, c) => acc + c.retentionScore, 0) / clientAnalytics.length)
                : 0,
            topClients: clientAnalytics.sort((a, b) => b.retentionScore - a.retentionScore).slice(0, 5),
            recentChurns: clientAnalytics.filter(c => c.churnRisk === 'high').slice(0, 5),
            allClients: clientAnalytics
        };
    }, [registrations, classes, users, selectedPeriod]);
    
    const handleExportClients = () => {
        const data = analytics.allClients.map(c => ({
            'Name': c.userName,
            'Email': c.userEmail,
            'Total Bookings': c.totalBookings,
            'Attended': c.attendedBookings,
            'Cancelled': c.cancelledBookings,
            'Retention Score': c.retentionScore,
            'Churn Risk': c.churnRisk.toUpperCase(),
            'Last Attendance': c.lastAttendance ? formatDate(c.lastAttendance) : 'Never',
            'Avg Bookings/Month': c.averageBookingsPerMonth.toFixed(1)
        }));
        exportToCSV(data, 'client_analytics', Object.keys(data[0] || {}));
        onShowToast('Client analytics exported successfully!', 'success');
    };
    
    const handleExportRegistrations = () => {
        const data = registrations.map(r => {
            const cls = classes.find(c => c.id === r.classId);
            return {
                'Name': r.userName,
                'Email': r.userEmail || '',
                'Class': cls?.title || '',
                'Date': cls ? formatDate(cls.dateTime) : '',
                'Status': r.status,
                'Payment Status': r.paymentStatus,
                'Registered At': formatDate(r.registeredAt),
                'Notes': r.notes || ''
            };
        });
        exportToCSV(data, 'registrations', Object.keys(data[0] || {}));
        onShowToast('Registrations exported successfully!', 'success');
    };
    
    const handleExportClasses = () => {
        const data = classes.map(c => {
            const venue = venues.find(v => v.id === c.venueId);
            return {
                'Title': c.title,
                'Date': formatDate(c.dateTime),
                'Time': formatTime(c.dateTime),
                'Duration': c.duration,
                'Capacity': c.capacity,
                'Registered': c.registered,
                'Status': c.status,
                'Price': c.price,
                'Venue': venue?.name || ''
            };
        });
        exportToCSV(data, 'classes', Object.keys(data[0] || {}));
        onShowToast('Classes exported successfully!', 'success');
    };

    return (
        <div className="animate-fade-in space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#26150B]/5 pb-4">
                <div>
                    <h1 className="text-xl md:text-3xl font-extrabold text-[#26150B] tracking-tight">Analytics</h1>
                    <p className="text-sm text-[#6E7568] mt-1 font-medium">Client Retention & Insights</p>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    <div className="bg-white rounded-full p-1.5 border border-[#6E7568]/10 flex shadow-sm">
                        {(['7d', '30d', '90d', 'all'] as const).map(period => (
                            <button 
                                key={period} 
                                onClick={() => setSelectedPeriod(period)} 
                                className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${selectedPeriod === period ? 'bg-[#6E7568] text-[#FBF7EF] shadow-md' : 'text-[#6E7568] hover:bg-[#FBF7EF]'}`}
                            >
                                {period === 'all' ? 'All Time' : `Last ${period.replace('d', ' Days')}`}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatCard label="Total Clients" value={analytics.totalClients} icon={<Icons.UsersIcon />} color="#6E7568" />
                <StatCard label="Active (30d)" value={analytics.activeClients} icon={<Icons.CheckIcon />} color="#22c55e" />
                <StatCard label="At Risk" value={analytics.atRiskClients} icon={<Icons.AlertIcon />} color="#f59e0b" />
                <StatCard label="Churned (60d+)" value={analytics.churnedClients} icon={<Icons.XIcon />} color="#ef4444" />
                <StatCard label="Avg Retention" value={`${analytics.averageRetentionRate}%`} icon={<Icons.TrendUpIcon />} color="#6E7568" />
            </div>
            
            {/* Export Actions */}
            <div className="bg-white rounded-[2rem] p-6 border border-[#6E7568]/10 shadow-sm">
                <h3 className="text-xs font-bold text-[#26150B] mb-4 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#6E7568]"></span> Export Data
                </h3>
                <div className="flex flex-wrap gap-3">
                    <button onClick={handleExportClients} className="btn-primary rounded-xl py-3 px-5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:-translate-y-0.5 transition-all">
                        <Icons.DownloadIcon size={14} /> Export Clients
                    </button>
                    <button onClick={handleExportRegistrations} className="btn-primary rounded-xl py-3 px-5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:-translate-y-0.5 transition-all">
                        <Icons.DownloadIcon size={14} /> Export Registrations
                    </button>
                    <button onClick={handleExportClasses} className="btn-primary rounded-xl py-3 px-5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:-translate-y-0.5 transition-all">
                        <Icons.DownloadIcon size={14} /> Export Classes
                    </button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Clients */}
                <div className="bg-white rounded-[2rem] p-6 border border-[#6E7568]/10 shadow-sm">
                    <h3 className="text-xs font-bold text-[#26150B] mb-6 uppercase tracking-wider border-b border-[#FBF7EF] pb-4 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Top Retained Clients
                    </h3>
                    <div className="space-y-3">
                        {analytics.topClients.map((client, i) => (
                            <div key={client.userId} className="flex items-center justify-between p-3 bg-[#FBF7EF]/50 rounded-xl hover:bg-[#FBF7EF] transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-[#6E7568] text-[#FBF7EF] flex items-center justify-center text-xs font-bold">
                                        #{i + 1}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-[#26150B]">{client.userName}</p>
                                        <p className="text-[10px] text-[#6E7568]">{client.attendedBookings} sessions attended</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="w-16 h-2 bg-[#FBF7EF] rounded-full overflow-hidden border border-[#6E7568]/10">
                                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${client.retentionScore}%` }}></div>
                                    </div>
                                    <p className="text-[9px] font-bold text-[#6E7568] mt-1">{client.retentionScore}%</p>
                                </div>
                            </div>
                        ))}
                        {analytics.topClients.length === 0 && (
                            <div className="text-center py-8 text-[#6E7568]/40 text-xs italic">No client data available</div>
                        )}
                    </div>
                </div>
                
                {/* At Risk Clients */}
                <div className="bg-white rounded-[2rem] p-6 border border-[#6E7568]/10 shadow-sm">
                    <h3 className="text-xs font-bold text-[#26150B] mb-6 uppercase tracking-wider border-b border-[#FBF7EF] pb-4 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> At Risk / Churned Clients
                    </h3>
                    <div className="space-y-3">
                        {analytics.recentChurns.map(client => (
                            <div key={client.userId} className="flex items-center justify-between p-3 bg-red-50/50 rounded-xl border border-red-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-red-100 text-red-500 flex items-center justify-center">
                                        <Icons.AlertIcon size={14} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-[#26150B]">{client.userName}</p>
                                        <p className="text-[10px] text-[#6E7568]">
                                            Last: {client.lastAttendance ? formatDate(client.lastAttendance) : 'Never'}
                                        </p>
                                    </div>
                                </div>
                                <span className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase ${
                                    client.churnRisk === 'high' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'
                                }`}>
                                    {client.churnRisk} risk
                                </span>
                            </div>
                        ))}
                        {analytics.recentChurns.length === 0 && (
                            <div className="text-center py-8 text-[#6E7568]/40 text-xs italic">No at-risk clients - great job!</div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Retention Chart Placeholder */}
            <div className="bg-white rounded-[2rem] p-6 border border-[#6E7568]/10 shadow-sm">
                <h3 className="text-xs font-bold text-[#26150B] mb-6 uppercase tracking-wider border-b border-[#FBF7EF] pb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#6E7568]"></span> Retention Distribution
                </h3>
                <div className="flex items-end justify-between h-40 gap-2 px-4">
                    {['0-20', '21-40', '41-60', '61-80', '81-100'].map((range, i) => {
                        const count = analytics.allClients.filter(c => {
                            const score = c.retentionScore;
                            if (i === 0) return score <= 20;
                            if (i === 4) return score > 80;
                            return score > (i * 20) && score <= ((i + 1) * 20);
                        }).length;
                        const maxCount = Math.max(...['0-20', '21-40', '41-60', '61-80', '81-100'].map((_, j) => {
                            return analytics.allClients.filter(c => {
                                const score = c.retentionScore;
                                if (j === 0) return score <= 20;
                                if (j === 4) return score > 80;
                                return score > (j * 20) && score <= ((j + 1) * 20);
                            }).length;
                        }), 1);
                        const height = Math.max(10, (count / maxCount) * 100);
                        
                        return (
                            <div key={range} className="flex flex-col items-center gap-2 flex-1 h-full justify-end">
                                <span className="text-xs font-bold text-[#6E7568]">{count}</span>
                                <div className="w-full bg-[#FBF7EF] rounded-t-lg relative h-full flex items-end overflow-hidden shadow-inner flex-1">
                                    <div 
                                        className={`w-full rounded-t-lg transition-all duration-500 ${
                                            i < 2 ? 'bg-red-400' : i < 3 ? 'bg-yellow-400' : 'bg-green-400'
                                        }`}
                                        style={{ height: `${height}%` }}
                                    ></div>
                                </div>
                                <span className="text-[9px] font-bold text-[#6E7568] uppercase tracking-wider">{range}%</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

//=============== Admin Classes Screen ===============//
interface AdminClassesProps {
    classes: Class[];
    venues: Venue[];
    teachers: Teacher[];
    onAddClass: (c: Class) => void;
    onEditClass: (c: Class) => void;
    onDeleteClass: (id: string) => void;
    onShowToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    currentUser?: User; // Current admin user for permission checks
}
const AdminClasses: React.FC<AdminClassesProps> = ({ classes, venues, teachers, onAddClass, onEditClass, onDeleteClass, onShowToast, currentUser }) => {
    const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
    const [formData, setFormData] = useState<{
        title?: string;
        dateTime?: string;
        duration?: number;
        capacity?: number;
        venueId?: string;
        teacherId?: string;
        sportTags?: string[];
        status?: "published" | "draft" | "cancelled";
        price?: string;
        allowDomeResetOverride?: boolean;
    }>({
        title: "", dateTime: "", duration: 90, capacity: DEFAULT_CLASS_CAPACITY, venueId: venues[0]?.id || "", teacherId: teachers[0]?.id || "", sportTags: [], status: "draft", price: "", allowDomeResetOverride: false
    });
    
    // Recurring class state
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurringConfig, setRecurringConfig] = useState<RecurringClassConfig>({
        frequency: 'weekly',
        endDate: '',
        daysOfWeek: [],
        excludeDates: []
    });

    const TIME_OPTIONS = [
        "06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
        "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
        "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00"
    ];

    const openCreateModal = () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        const defaultDateTime = tomorrow.toISOString().slice(0, 16);

        setFormData({
            title: "", dateTime: defaultDateTime, duration: 90, capacity: DEFAULT_CLASS_CAPACITY, venueId: venues[0]?.id || "", teacherId: teachers[0]?.id || "", sportTags: [], status: "draft", price: "", allowDomeResetOverride: false 
        });
        setModalMode('create');
    };

    const openEditModal = (cls: Class) => {
        const formattedDate = cls.dateTime.slice(0, 16); 
        setFormData({ ...cls, dateTime: formattedDate, price: cls.price.toString() });
        setModalMode('edit');
    };

    const handleSave = () => {
        // Form validation
        if (!formData.title?.trim()) {
            onShowToast("Please enter a class title", "error");
            return;
        }
        if (!formData.dateTime) {
            onShowToast("Please select a date and time", "error");
            return;
        }
        
        // Validate date is in the future
        const classDate = new Date(formData.dateTime);
        if (classDate <= new Date()) {
            onShowToast("Class date must be in the future", "error");
            return;
        }
        
        // Validate price is non-negative
        const price = Number(formData.price) || 0;
        if (price < 0) {
            onShowToast("Price cannot be negative", "error");
            return;
        }
        
        // Calculate class end time
        const classEndTime = new Date(classDate.getTime() + (formData.duration || 90) * 60000);
        
        // Check for 30-minute dome reset buffer requirement
        // Only check for dome venue (check if venue name contains "dome" or is the primary venue)
        const selectedVenue = venues.find(v => v.id === formData.venueId);
        const isDomeVenue = selectedVenue?.name.toLowerCase().includes('dome') || selectedVenue?.name.toLowerCase().includes('the dome');
        
        // Check if user is super_admin for the override
        const isSuperAdmin = currentUser?.adminRole === 'super_admin';
        
        if (isDomeVenue) {
            // Find classes on the same day at the same venue
            const sameDayClasses = classes.filter(c => {
                const cDate = new Date(c.dateTime);
                const cVenueId = c.venueId;
                return cVenueId === formData.venueId && 
                       cDate.toDateString() === classDate.toDateString() &&
                       c.status !== 'cancelled';
            }).sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
            
            // Check if there's a class that ends too close to this class's start
            for (const existingClass of sameDayClasses) {
                const existingEnd = new Date(existingClass.dateTime).getTime() + existingClass.duration * 60000;
                const gapMs = classDate.getTime() - existingEnd;
                const gapMinutes = gapMs / 60000;
                
                // If gap is positive (existing class ends before new class starts) but less than 30 minutes
                if (gapMinutes > 0 && gapMinutes < 30) {
                    // Allow override only for super_admin
                    if (isSuperAdmin && formData.allowDomeResetOverride) {
                        onShowToast("⚡ Dome reset buffer overridden by super_admin", "warning");
                    } else {
                        onShowToast(`Cannot schedule class. There must be at least 30 minutes between classes for dome reset. Current gap: ${Math.round(gapMinutes)} minutes.`, "error");
                        return;
                    }
                }
                
                // Also check if new class ends too close to an existing class that starts after it
                const existingStart = new Date(existingClass.dateTime).getTime();
                const reverseGapMs = existingStart - classEndTime.getTime();
                const reverseGapMinutes = reverseGapMs / 60000;
                
                if (reverseGapMinutes > 0 && reverseGapMinutes < 30) {
                    if (isSuperAdmin && formData.allowDomeResetOverride) {
                        onShowToast("⚡ Dome reset buffer overridden by super_admin", "warning");
                    } else {
                        onShowToast(`Cannot schedule class. The next class starts only ${Math.round(reverseGapMinutes)} minutes after this one. Need 30 min for dome reset.`, "error");
                        return;
                    }
                }
            }
        }
        
        const finalData = { ...formData, capacity: formData.capacity || DEFAULT_CLASS_CAPACITY, price };

        if (modalMode === 'create') {
            if (isRecurring && recurringConfig.endDate) {
                // Create recurring classes
                const startDate = new Date(formData.dateTime);
                const endDate = new Date(recurringConfig.endDate);
                const classesToCreate: Class[] = [];
                
                let currentDate = new Date(startDate);
                let classCount = 0;
                const maxClasses = 52; // Limit to 1 year of weekly classes
                
                while (currentDate <= endDate && classCount < maxClasses) {
                    const dayOfWeek = currentDate.getDay();
                    
                    // Check if this day is selected (or if no days selected, use start date's day)
                    if (recurringConfig.daysOfWeek.length === 0 || recurringConfig.daysOfWeek.includes(dayOfWeek)) {
                        const cls: Class = {
                            id: `c${Date.now()}-${classCount}`,
                            slug: `class-${Date.now()}-${classCount}`,
                            title: finalData.title || "",
                            dateTime: currentDate.toISOString(),
                            duration: finalData.duration || 90,
                            venueId: finalData.venueId || venues[0]?.id || "",
                            sportTags: finalData.sportTags || [],
                            bodyAreaTags: ["Full Body"],
                            capacity: finalData.capacity || DEFAULT_CLASS_CAPACITY,
                            registered: 0,
                            status: "published",
                            description: "A class to improve movement and reduce stiffness.",
                            price: price,
                            creditCost: 0,
                            allowDomeResetOverride: false // Recurring classes don't use override by default
                        };
                        classesToCreate.push(cls);
                        classCount++;
                    }
                    
                    // Move to next date based on frequency
                    if (recurringConfig.frequency === 'daily') {
                        currentDate.setDate(currentDate.getDate() + 1);
                    } else if (recurringConfig.frequency === 'weekly') {
                        currentDate.setDate(currentDate.getDate() + 7);
                    } else if (recurringConfig.frequency === 'biweekly') {
                        currentDate.setDate(currentDate.getDate() + 14);
                    } else if (recurringConfig.frequency === 'monthly') {
                        currentDate.setMonth(currentDate.getMonth() + 1);
                    }
                }
                
                // Add all classes
                classesToCreate.forEach(cls => onAddClass(cls));
                onShowToast(`Created ${classesToCreate.length} recurring classes!`, "success");
            } else {
                // Create single class
                const cls: Class = {
                    ...finalData as Class,
                    id: `c${Date.now()}`,
                    slug: `class-${Date.now()}`,
                    registered: 0,
                    bodyAreaTags: ["Full Body"],
                    description: "A class to improve movement and reduce stiffness.",
                    status: "published",
                    creditCost: 0,
                    allowDomeResetOverride: formData.allowDomeResetOverride || false
                };
                onAddClass(cls);
                onShowToast("Class created successfully!", "success");
            }
        } else if (modalMode === 'edit') {
            onEditClass(finalData as Class);
            onShowToast("Class updated successfully!", "success");
        }
        setModalMode(null);
        setIsRecurring(false);
        setRecurringConfig({ frequency: 'weekly', endDate: '', daysOfWeek: [], excludeDates: [] });
    };

    const handleDelete = (id: string) => {
        if (window.confirm("Are you sure you want to delete this class? This action cannot be undone.")) {
            onDeleteClass(id);
        }
    };

    const handleShare = (cls: Class) => {
        const link = `https://app.pausefmd.co.za/invite/${cls.slug}`;
        const text = `Join me at ${cls.title}\n${formatDate(cls.dateTime)}\n${link}`;
        navigator.clipboard.writeText(text);
        onShowToast("Invite link copied to clipboard!", "success");
    };

    // Simple Calendar Logic
    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const [currentDate, setCurrentDate] = useState(new Date());
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
    
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const blanks = Array.from({ length: firstDay }, (_, i) => i);

    const getClassesForDay = (day: number) => {
        return classes.filter(c => {
            const d = new Date(c.dateTime);
            return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
        });
    };

    return (
        <div className="animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-[#26150B]/5 pb-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-[#26150B] tracking-tight">Classes</h1>
                    <p className="text-sm text-[#6E7568] mt-1 font-medium">Manage Schedule</p>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    <div className="bg-white rounded-full p-1.5 border border-[#6E7568]/10 flex shadow-sm">
                        <button onClick={() => setViewMode('list')} className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${viewMode === 'list' ? 'bg-[#6E7568] text-[#FBF7EF] shadow-md' : 'text-[#6E7568] hover:bg-[#FBF7EF]'}`}>List</button>
                        <button onClick={() => setViewMode('calendar')} className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${viewMode === 'calendar' ? 'bg-[#6E7568] text-[#FBF7EF] shadow-md' : 'text-[#6E7568] hover:bg-[#FBF7EF]'}`}>Calendar</button>
                    </div>
                    <button onClick={openCreateModal} className="btn-primary rounded-full py-3 px-6 flex items-center gap-2 text-xs font-bold uppercase tracking-wider cursor-pointer shadow-lg flex-1 sm:flex-none justify-center hover:bg-[#5a6155] hover:-translate-y-0.5 transition-all">
                        <Icons.PlusIcon size={16}/> New Class
                    </button>
                </div>
            </div>
            
            {viewMode === 'list' ? (
                <div className="grid gap-4">
                    {classes.map(cls => (
                        <div key={cls.id} className="bg-white rounded-[1.5rem] p-6 border border-[#6E7568]/10 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col sm:flex-row justify-between gap-6 group hover:-translate-y-0.5 premium-card-hover">
                            <div className="flex items-start gap-4">
                                <div className="bg-[#FBF7EF] w-16 h-16 rounded-2xl flex flex-col items-center justify-center text-[#6E7568] border border-[#6E7568]/10 shadow-inner group-hover:scale-105 transition-transform">
                                    <span className="text-[10px] font-bold uppercase tracking-wide">{new Date(cls.dateTime).toLocaleString('en-US', { month: 'short' })}</span>
                                    <span className="text-2xl font-extrabold leading-none">{new Date(cls.dateTime).getDate()}</span>
                                </div>
                                <div>
                                    <h3 className="text-[#26150B] font-bold text-lg mb-1 group-hover:text-[#6E7568] transition-colors">{cls.title}</h3>
                                    <div className="flex flex-wrap gap-3 text-xs text-[#6E7568] font-medium">
                                        <span className="flex items-center gap-1.5 bg-[#FBF7EF] px-2 py-1 rounded-md"><Icons.ClockIcon size={12}/> {(() => { const venue = venues.find(v => v.id === cls.venueId); const isDome = isDomeVenue(venue?.name); const { endTime, hasBuffer } = getEndTimeWithReset(cls.dateTime, cls.duration, isDome, cls.allowDomeResetOverride); return `${formatTime(cls.dateTime)} - ${endTime}${hasBuffer ? ' (+reset)' : ''}`; })()}</span>
                                        <span className="flex items-center gap-1.5 bg-[#FBF7EF] px-2 py-1 rounded-md"><Icons.UsersIcon size={12}/> {cls.registered}/{cls.capacity}</span>
                                        <span className="flex items-center gap-1.5 bg-[#FBF7EF] px-2 py-1 rounded-md text-[#26150B] font-bold">{cls.price > 0 ? `R ${cls.price}` : "Free"}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 self-start sm:self-center bg-[#FBF7EF]/50 p-2 rounded-xl border border-[#FBF7EF]">
                                <button onClick={() => handleShare(cls)} className="p-2.5 hover:bg-white hover:shadow-md rounded-lg text-[#6E7568] transition-all" title="Copy Invite Link"><Icons.ShareIcon size={18}/></button>
                                <span className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${cls.status === 'published' ? 'bg-[#6E7568]/10 text-[#6E7568] border-[#6E7568]/20' : 'bg-[#26150B]/5 text-[#26150B]/50 border-[#26150B]/10'}`}>
                                    {cls.status}
                                </span>
                                <button onClick={() => openEditModal(cls)} className="p-2.5 hover:bg-white hover:shadow-md rounded-lg text-[#6E7568] transition-all"><Icons.EditIcon size={18}/></button>
                                <button onClick={() => handleDelete(cls.id)} className="p-2.5 hover:bg-red-50 hover:text-red-500 hover:shadow-md rounded-lg text-[#6E7568]/50 transition-all"><Icons.TrashIcon size={18}/></button>
                            </div>
                        </div>
                    ))}
                    {classes.length === 0 && <div className="text-center py-16 text-[#6E7568]/40 text-sm italic bg-[#FBF7EF]/30 rounded-[2rem] border-2 border-dashed border-[#6E7568]/10">No classes created yet.</div>}
                </div>
            ) : (
                <div className="bg-white rounded-[2rem] p-8 border border-[#6E7568]/10 shadow-lg">
                    <div className="flex justify-between items-center mb-8">
                        <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-3 hover:bg-[#FBF7EF] rounded-full text-[#6E7568] transition-colors"><Icons.ArrowLeftIcon size={18}/></button>
                        <h2 className="text-xl font-bold text-[#26150B] uppercase tracking-widest">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
                        <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-3 hover:bg-[#FBF7EF] rounded-full text-[#6E7568] rotate-180 transition-colors"><Icons.ArrowLeftIcon size={18}/></button>
                    </div>
                    <div className="grid grid-cols-7 gap-4 mb-4 text-center">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                            <div key={d} className="text-[10px] font-bold text-[#6E7568]/50 uppercase tracking-widest">{d}</div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-4">
                        {blanks.map(b => <div key={`blank-${b}`} className="aspect-square"></div>)}
                        {days.map(day => {
                            const dayClasses = getClassesForDay(day);
                            const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
                            return (
                                <div key={day} className={`aspect-square rounded-2xl border ${isToday ? 'border-[#6E7568] bg-[#FBF7EF] shadow-inner' : 'border-[#6E7568]/10 hover:border-[#6E7568]/30'} p-2 relative group transition-all duration-300`}>
                                    <span className={`text-[10px] font-bold ${isToday ? 'text-[#6E7568]' : 'text-[#6E7568]/50'} absolute top-2 left-3`}>{day}</span>
                                    <div className="mt-6 space-y-1.5 overflow-y-auto max-h-[calc(100%-1.5rem)] custom-scrollbar pr-1">
                                        {dayClasses.map(c => (
                                            <div key={c.id} onClick={() => openEditModal(c)} className="bg-[#6E7568] text-[#FBF7EF] text-[9px] p-1.5 rounded-lg cursor-pointer truncate hover:bg-[#5a6155] shadow-sm font-medium transition-colors">
                                                {formatTime(c.dateTime)} {c.title}
                                            </div>
                                        ))}
                                    </div>
                                    {/* Add Class Shortcut */}
                                    <button 
                                        onClick={() => {
                                            setFormData({
                                                title: "", dateTime: new Date(year, month, day, 9, 0).toISOString().slice(0, 16), duration: 90, capacity: DEFAULT_CLASS_CAPACITY, venueId: venues[0]?.id || "", sportTags: [], status: "draft", price: "" 
                                            });
                                            setModalMode('create');
                                        }}
                                        className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 text-[#6E7568] hover:bg-[#6E7568] hover:text-[#FBF7EF] rounded-full p-1.5 transition-all shadow-sm"
                                    >
                                        <Icons.PlusIcon size={12} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {modalMode && (
                 <div className="fixed inset-0 bg-[#26150B]/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-300">
                    <div className="bg-[#FBF7EF] border border-[#6E7568]/20 rounded-[2.5rem] p-8 sm:p-10 w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-extrabold text-[#26150B] tracking-tight">{modalMode === 'create' ? 'Create Class' : 'Edit Class'}</h2>
                            <button onClick={() => setModalMode(null)} className="text-[#26150B]/40 hover:text-[#26150B] hover:bg-[#26150B]/5 rounded-full p-2 transition-all"><Icons.XIcon /></button>
                        </div>
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider pl-1">Title</label>
                                <input 
                                    className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 focus:border-[#6E7568]/50 outline-none transition-all shadow-sm focus:shadow-md font-medium" 
                                    value={formData.title} 
                                    onChange={e=>setFormData({...formData, title: e.target.value})} 
                                    placeholder="e.g. Happy Feet" 
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider pl-1">Date & Time</label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <input 
                                                type="date" 
                                                className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 outline-none appearance-none shadow-sm font-medium" 
                                                value={formData.dateTime ? formData.dateTime.split('T')[0] : ''} 
                                                onChange={e => {
                                                    const date = e.target.value;
                                                    const time = formData.dateTime ? formData.dateTime.split('T')[1] : "09:00";
                                                    setFormData({...formData, dateTime: `${date}T${time}`});
                                                }} 
                                            />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#6E7568]">
                                                <Icons.CalendarIcon size={16} />
                                            </div>
                                        </div>
                                        <div className="relative w-2/5">
                                            <select
                                                className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 outline-none appearance-none shadow-sm font-medium"
                                                value={formData.dateTime ? formData.dateTime.split('T')[1]?.slice(0, 5) : "09:00"}
                                                onChange={e => {
                                                    const time = e.target.value;
                                                    const date = formData.dateTime ? formData.dateTime.split('T')[0] : new Date().toISOString().split('T')[0];
                                                    setFormData({...formData, dateTime: `${date}T${time}`});
                                                }}
                                            >
                                                {TIME_OPTIONS.map(t => (
                                                    <option key={t} value={t}>{t}</option>
                                                ))}
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#6E7568]">
                                                <Icons.ClockIcon size={16} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider pl-1">Price (R)</label>
                                    <input 
                                        type="text" 
                                        inputMode="numeric"
                                        className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 outline-none shadow-sm font-medium" 
                                        value={formData.price} 
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val === '' || /^\d+$/.test(val)) setFormData({...formData, price: val});
                                        }}
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider pl-1">Venue</label>
                                    <select 
                                        className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 outline-none shadow-sm font-medium" 
                                        value={formData.venueId} 
                                        onChange={e => setFormData({...formData, venueId: e.target.value})}
                                    >
                                        {venues.map(v => <option key={v.id} value={v.id} className="bg-white">{v.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider pl-1">Teacher</label>
                                    <select 
                                        className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 outline-none shadow-sm font-medium" 
                                        value={formData.teacherId || ''} 
                                        onChange={e => setFormData({...formData, teacherId: e.target.value})}
                                    >
                                        {teachers.filter(i => i.active).map(i => <option key={i.id} value={i.id} className="bg-white">{i.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider pl-1">Capacity (Fixed)</label>
                                <input 
                                    type="number" 
                                    className="w-full p-4 rounded-2xl bg-[#6E7568]/5 text-[#6E7568] border border-[#6E7568]/5 outline-none cursor-not-allowed font-medium" 
                                    value="15" 
                                    disabled 
                                />
                            </div>
                            {/* Dome Reset Override Option */}
                            {formData.venueId && (() => {
                                const selectedVenue = venues.find(v => v.id === formData.venueId);
                                const isDomeVenue = selectedVenue?.name.toLowerCase().includes('dome') || selectedVenue?.name.toLowerCase().includes('the dome');
                                const isSuperAdmin = currentUser?.adminRole === 'super_admin';
                                return isDomeVenue ? (
                                    <div className={`border rounded-2xl p-4 ${isSuperAdmin ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                id="domeResetOverride"
                                                checked={formData.allowDomeResetOverride || false}
                                                onChange={e => setFormData({...formData, allowDomeResetOverride: e.target.checked})}
                                                disabled={!isSuperAdmin}
                                                className={`w-5 h-5 rounded border-${isSuperAdmin ? 'amber-300' : 'gray-300'} text-amber-600 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed`}
                                            />
                                            <label htmlFor="domeResetOverride" className={`text-sm font-bold ${isSuperAdmin ? 'text-amber-800' : 'text-gray-600'}`}>
                                                {isSuperAdmin ? '⚡ Override 30-min Reset Buffer' : '🔒 30-min Reset Buffer (Superadmin Only)'}
                                            </label>
                                        </div>
                                        <p className={`text-xs mt-2 ml-8 ${isSuperAdmin ? 'text-amber-700' : 'text-gray-500'}`}>
                                            {isSuperAdmin 
                                                ? "Check this to allow back-to-back classes without the 30-minute dome reset gap."
                                                : "Only super admins can override the 30-minute dome reset buffer requirement."}
                                        </p>
                                    </div>
                                ) : null;
                            })()}
                            <button onClick={handleSave} className="w-full btn-primary py-4 rounded-2xl font-bold text-sm tracking-widest uppercase mt-6 shadow-xl hover:scale-[1.02] transition-all bg-gradient-to-r from-[#6E7568] to-[#5a6155] text-[#FBF7EF] hover:shadow-2xl">
                                {modalMode === 'create' ? (isRecurring ? 'Create Recurring Classes' : 'Publish Class') : 'Save Changes'}
                            </button>
                            
                            {/* Recurring Class Options - Only for create mode */}
                            {modalMode === 'create' && (
                                <div className="mt-6 pt-6 border-t border-[#6E7568]/10">
                                    <div className="flex items-center gap-3 mb-4">
                                        <button 
                                            onClick={() => setIsRecurring(!isRecurring)}
                                            className={`relative w-12 h-6 rounded-full transition-colors ${isRecurring ? 'bg-[#6E7568]' : 'bg-[#6E7568]/20'}`}
                                        >
                                            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${isRecurring ? 'left-7' : 'left-1'}`}></span>
                                        </button>
                                        <label className="text-xs font-bold text-[#6E7568] uppercase tracking-wider flex items-center gap-2">
                                            <Icons.RepeatIcon size={14} /> Make this a recurring class
                                        </label>
                                    </div>
                                    
                                    {isRecurring && (
                                        <motion.div 
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="space-y-4 bg-[#FBF7EF] p-4 rounded-2xl border border-[#6E7568]/10"
                                        >
                                            <div>
                                                <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider pl-1">Frequency</label>
                                                <select 
                                                    className="w-full p-3 rounded-xl bg-white text-[#26150B] border border-[#6E7568]/10 outline-none shadow-sm font-medium"
                                                    value={recurringConfig.frequency}
                                                    onChange={e => setRecurringConfig({...recurringConfig, frequency: e.target.value as any})}
                                                >
                                                    <option value="daily">Daily</option>
                                                    <option value="weekly">Weekly</option>
                                                    <option value="biweekly">Bi-weekly</option>
                                                    <option value="monthly">Monthly</option>
                                                </select>
                                            </div>
                                            
                                            <div>
                                                <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider pl-1">End Date</label>
                                                <input 
                                                    type="date"
                                                    className="w-full p-3 rounded-xl bg-white text-[#26150B] border border-[#6E7568]/10 outline-none shadow-sm font-medium"
                                                    value={recurringConfig.endDate}
                                                    onChange={e => setRecurringConfig({...recurringConfig, endDate: e.target.value})}
                                                    min={formData.dateTime ? formData.dateTime.split('T')[0] : ''}
                                                />
                                            </div>
                                            
                                            <div>
                                                <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider pl-1">Days of Week (optional)</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                                                        <button
                                                            key={day}
                                                            onClick={() => {
                                                                const days = recurringConfig.daysOfWeek.includes(i)
                                                                    ? recurringConfig.daysOfWeek.filter(d => d !== i)
                                                                    : [...recurringConfig.daysOfWeek, i];
                                                                setRecurringConfig({...recurringConfig, daysOfWeek: days});
                                                            }}
                                                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                                                                recurringConfig.daysOfWeek.includes(i)
                                                                    ? 'bg-[#6E7568] text-[#FBF7EF]'
                                                                    : 'bg-white text-[#6E7568] border border-[#6E7568]/20 hover:border-[#6E7568]/50'
                                                            }`}
                                                        >
                                                            {day}
                                                        </button>
                                                    ))}
                                                </div>
                                                <p className="text-[9px] text-[#6E7568]/60 mt-2">Leave empty to use the start date's day</p>
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

//=============== Admin Attendees Screen ===============//
interface AdminAttendeesProps {
    classes: Class[];
    registrations: Registration[];
    onVerifyPayment: (id: string, verified: boolean) => void;
}
const AdminAttendees: React.FC<AdminAttendeesProps> = ({ classes, registrations, onVerifyPayment }) => {
    const [filterClass, setFilterClass] = useState("all");
    const [viewWaiver, setViewWaiver] = useState<WaiverData | null>(null);
    const filtered = filterClass === "all" ? registrations : registrations.filter(r => r.classId === filterClass);

    const handleViewWaiver = (userId: string) => {
        // Fetch fresh user data from DB to get waiver details
        const user = db.getUser(userId);
        if (user && user.waiverData) {
            setViewWaiver(user.waiverData);
        } else if (user && user.waiverAccepted) {
            // Legacy fall back
            setViewWaiver({
                signed: true,
                signedAt: new Date().toISOString(), // Approximate or store actual date in older models
                signerName: user.name,
                agreements: { medical: true, heat: true, liability: true }
            });
        } else {
            alert("No waiver found for this user.");
        }
    };

    return (
        <div className="animate-fade-in relative">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-[#26150B]/5 pb-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-[#26150B] tracking-tight">Attendees</h1>
                    <p className="text-sm text-[#6E7568] mt-1 font-medium">Verification & Lists</p>
                </div>
                <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="w-full sm:w-auto bg-white border border-[#6E7568]/10 text-[#26150B] font-medium rounded-full p-3 px-6 text-xs outline-none focus:border-[#6E7568]/50 shadow-sm hover:shadow-md transition-all appearance-none cursor-pointer">
                    <option value="all" className="bg-white">All Classes</option>
                    {classes.map(c => <option key={c.id} value={c.id} className="bg-white">{c.title}</option>)}
                </select>
            </div>

            <div className="space-y-4">
                {filtered.map(r => {
                    const cls = classes.find(c => c.id === r.classId);
                    return (
                        <div key={r.id} className="bg-white p-5 rounded-[1.5rem] border border-[#6E7568]/10 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 hover:shadow-lg transition-all duration-300 group hover:-translate-y-0.5">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-full bg-[#FBF7EF] flex items-center justify-center text-[#6E7568] font-bold text-sm shadow-inner border border-[#6E7568]/5">
                                        {r.userName.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="text-[#26150B] font-bold text-sm flex items-center gap-2">
                                            {r.userName}
                                            <button onClick={() => handleViewWaiver(r.userId)} title="View Signed Waiver" className="text-[10px] cursor-pointer hover:bg-[#6E7568]/10 rounded-full p-1 transition-colors text-[#6E7568]">
                                                <Icons.ArticleIcon size={12} />
                                            </button>
                                        </h4>
                                        <p className="text-[10px] text-[#6E7568] font-medium flex items-center gap-1">
                                            <Icons.CalendarIcon size={10} /> {cls?.title}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="mt-3 flex gap-2 flex-wrap">
                                    <span className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase border tracking-wide ${
                                        r.status === 'confirmed' ? 'border-[#6E7568]/20 text-[#6E7568] bg-[#6E7568]/10' :
                                        r.status === 'payment_review' ? 'border-[#763417]/20 text-[#763417] bg-[#763417]/10' :
                                        'border-red-500/20 text-red-500 bg-red-500/5'
                                    }`}>{r.status.replace('_', ' ')}</span>
                                    {r.paymentProof && (
                                        <a href={r.paymentProof} download={`proof-${r.id}.png`} className="px-3 py-1 rounded-full text-[9px] font-bold uppercase border border-[#6E7568]/10 text-[#6E7568] bg-[#FBF7EF] hover:bg-[#6E7568] hover:text-[#FBF7EF] transition-colors flex items-center gap-1 shadow-sm">
                                            <Icons.ArticleIcon size={10} /> View Proof
                                        </a>
                                    )}
                                </div>
                                {r.notes && (
                                    <div className="mt-3 bg-[#FBF7EF]/50 p-3 rounded-xl border border-[#6E7568]/5">
                                        <p className="text-[9px] font-bold text-[#6E7568] uppercase tracking-wider mb-1 flex items-center gap-1"><Icons.InfoIcon size={10}/> Notes / Injuries</p>
                                        <p className="text-[10px] text-[#26150B] italic leading-relaxed">{r.notes}</p>
                                    </div>
                                )}
                            </div>
                            
                            {r.status === 'payment_review' && (
                                <div className="flex gap-3 w-full sm:w-auto">
                                    <button onClick={() => onVerifyPayment(r.id, true)} className="flex-1 sm:flex-none bg-[#6E7568]/10 text-[#6E7568] hover:bg-[#6E7568] hover:text-[#FBF7EF] border border-[#6E7568]/20 text-[10px] font-bold uppercase px-6 py-3 rounded-xl transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2">
                                        <Icons.CheckIcon size={14} /> Verify
                                    </button>
                                    <button onClick={() => onVerifyPayment(r.id, false)} className="flex-1 sm:flex-none bg-red-500/5 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/10 text-[10px] font-bold uppercase px-6 py-3 rounded-xl transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2">
                                        <Icons.XIcon size={14} /> Reject
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
                {filtered.length === 0 && <div className="text-center py-16 text-[#6E7568]/40 text-sm italic bg-[#FBF7EF]/30 rounded-[2rem] border-2 border-dashed border-[#6E7568]/10">No attendees found.</div>}
            </div>

            {/* WAIVER MODAL */}
            {viewWaiver && (
                <div className="fixed inset-0 bg-[#26150B]/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-300">
                    <div className="bg-[#FBF7EF] rounded-[2rem] p-8 max-w-sm w-full border border-[#6E7568]/20 shadow-2xl relative">
                        <button onClick={() => setViewWaiver(null)} className="absolute top-5 right-5 text-[#26150B]/40 hover:text-[#26150B] transition-colors"><Icons.XIcon /></button>
                        
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 rounded-full bg-[#6E7568]/10 flex items-center justify-center mx-auto mb-4 text-[#6E7568] shadow-inner border border-[#6E7568]/5">
                                <Icons.ArticleIcon size={32} />
                            </div>
                            <h2 className="text-xl font-extrabold text-[#26150B] tracking-tight">Digital Waiver</h2>
                        </div>

                        <div className="space-y-5 bg-white p-6 rounded-2xl border border-[#26150B]/5 mb-6 shadow-sm">
                            <div>
                                <p className="text-[9px] font-bold text-[#6E7568] uppercase tracking-wider mb-1">Signed By</p>
                                <p className="text-base font-['Courier_New'] font-bold text-[#26150B] border-b border-[#26150B]/10 pb-1">{viewWaiver.signerName}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-bold text-[#6E7568] uppercase tracking-wider mb-1">Date Signed</p>
                                <p className="text-sm text-[#26150B] font-medium">{new Date(viewWaiver.signedAt).toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-bold text-[#6E7568] uppercase tracking-wider mb-2">Agreements</p>
                                <div className="flex gap-2 flex-wrap">
                                    {Object.entries(viewWaiver.agreements).map(([key, accepted]) => (
                                        accepted && <span key={key} className="px-3 py-1 bg-[#6E7568]/10 text-[#6E7568] rounded-lg text-[9px] uppercase font-bold border border-[#6E7568]/10 flex items-center gap-1"><Icons.CheckIcon size={10} /> {key}</span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="text-center">
                            <p className="text-[10px] text-[#26150B]/40 italic font-medium">Digitally signed via Pause App</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

//=============== Admin Templates with AI Invite Engine ===============//
interface AdminTemplatesProps {
    templates: Template[];
    onUpdateTemplate: (t: Template) => void;
    onAddTemplate: (t: Template) => void;
    onShowToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}
const AdminTemplates: React.FC<AdminTemplatesProps> = ({ templates, onUpdateTemplate, onAddTemplate, onShowToast }) => {
    const [aiParams, setAiParams] = useState({
        targetAudience: "",
        focusArea: "",
        scienceFocus: "Hydration & Glide (Hyaluronic Acid)",
        tone: "Educational & Inviting"
    });
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedContent, setGeneratedContent] = useState<Partial<Template> | null>(null);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
    const [editFormData, setEditFormData] = useState<Partial<Template>>({});

    const generateCampaign = async () => {
        if (!aiParams.targetAudience || !aiParams.focusArea) return;
        setIsGenerating(true);
        try {
            const response = await fetch('/api/ai/generate-template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(aiParams)
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to generate template');
            }
            
            const result = await response.json();
            setGeneratedContent(result);

        } catch (e) {
            console.error(e);
            alert(e instanceof Error ? e.message : "AI Generation failed. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    const saveGenerated = () => {
        if (generatedContent) {
            onAddTemplate(generatedContent as Template);
            onShowToast("Template saved successfully!", "success");
            setGeneratedContent(null);
            setAiParams({ 
                targetAudience: "", 
                focusArea: "", 
                scienceFocus: "Hydration & Glide (Hyaluronic Acid)", 
                tone: "Educational & Inviting" 
            });
        }
    };

    const openEditModal = (template: Template) => {
        setEditingTemplate(template);
        setEditFormData({ ...template });
    };

    const handleEditSave = () => {
        if (editingTemplate && editFormData) {
            const updatedTemplate: Template = {
                ...editingTemplate,
                name: editFormData.name || editingTemplate.name,
                whatsappBody: editFormData.whatsappBody || editingTemplate.whatsappBody,
                emailSubject: editFormData.emailSubject || editingTemplate.emailSubject,
                emailBody: editFormData.emailBody || editingTemplate.emailBody,
                sportTags: editFormData.sportTags || editingTemplate.sportTags,
                active: editFormData.active ?? editingTemplate.active
            };
            onUpdateTemplate(updatedTemplate);
            onShowToast("Template updated successfully!", "success");
            setEditingTemplate(null);
            setEditFormData({});
        }
    };

    return (
        <div className="animate-fade-in">
             <div className="mb-8">
                <h1 className="text-2xl md:text-3xl font-extrabold text-[#26150B]">Templates & AI Engine</h1>
                <p className="text-sm text-[#6E7568] mt-1">Communication Presets</p>
            </div>

            {/* AI Campaign Generator */}
            <div className="bg-[#6E7568] rounded-2xl p-6 border border-[#6E7568] mb-8 relative overflow-hidden text-[#FBF7EF]">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none text-[#FBF7EF]">
                    <Icons.TemplateIcon size={120} />
                </div>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    ✨ AI Invite Engine
                </h3>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-[10px] font-bold text-[#FBF7EF]/70 uppercase tracking-wider mb-2">Target Audience</label>
                        <input 
                            className="w-full bg-[#26150B]/30 border border-[#FBF7EF]/20 rounded-xl p-3 text-xs text-[#FBF7EF] outline-none focus:border-[#FBF7EF]/50 placeholder-white/30"
                            placeholder="e.g. Corporate Dads, New Moms"
                            value={aiParams.targetAudience}
                            onChange={e => setAiParams({...aiParams, targetAudience: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-[#FBF7EF]/70 uppercase tracking-wider mb-2">Pain Point / Focus</label>
                        <input 
                            className="w-full bg-[#26150B]/30 border border-[#FBF7EF]/20 rounded-xl p-3 text-xs text-[#FBF7EF] outline-none focus:border-[#FBF7EF]/50 placeholder-white/30"
                            placeholder="e.g. Lower Back Stiffness"
                            value={aiParams.focusArea}
                            onChange={e => setAiParams({...aiParams, focusArea: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-[#FBF7EF]/70 uppercase tracking-wider mb-2">Scientific Concept</label>
                        <select 
                            className="w-full bg-[#26150B]/30 border border-[#FBF7EF]/20 rounded-xl p-3 text-xs text-[#FBF7EF] outline-none focus:border-[#FBF7EF]/50"
                            value={aiParams.scienceFocus}
                            onChange={e => setAiParams({...aiParams, scienceFocus: e.target.value})}
                        >
                            <option className="bg-[#6E7568]">Hydration & Glide (Hyaluronic Acid)</option>
                            <option className="bg-[#6E7568]">Elastic Recoil (The Catapult Effect)</option>
                            <option className="bg-[#6E7568]">Sensory Richness (Proprioception)</option>
                            <option className="bg-[#6E7568]">Tensegrity (Whole Body Connection)</option>
                            <option className="bg-[#6E7568]">Fluid Dynamics (Sponge Effect)</option>
                            <option className="bg-[#6E7568]">Vagus Nerve (Relaxation Response)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-[#FBF7EF]/70 uppercase tracking-wider mb-2">Tone</label>
                        <select 
                            className="w-full bg-[#26150B]/30 border border-[#FBF7EF]/20 rounded-xl p-3 text-xs text-[#FBF7EF] outline-none focus:border-[#FBF7EF]/50"
                            value={aiParams.tone}
                            onChange={e => setAiParams({...aiParams, tone: e.target.value})}
                        >
                            <option className="bg-[#6E7568]">Educational & Inviting</option>
                            <option className="bg-[#6E7568]">Urgent & High Energy</option>
                            <option className="bg-[#6E7568]">Scientific & Professional</option>
                            <option className="bg-[#6E7568]">Calm & Restorative</option>
                            <option className="bg-[#6E7568]">Empathetic & Supportive</option>
                        </select>
                    </div>
                </div>
                <button 
                    onClick={generateCampaign}
                    disabled={isGenerating || !aiParams.targetAudience}
                    className="btn-primary w-full py-3 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg hover:scale-[1.01] transition-transform disabled:opacity-50 bg-[#FBF7EF] text-[#26150B]"
                >
                    {isGenerating ? (
                        <span className="flex items-center gap-2">
                             <span className="w-4 h-4 border-2 border-[#26150B] border-t-transparent rounded-full animate-spin"></span>
                             Generating...
                        </span>
                    ) : "Generate Campaign with AI"}
                </button>

                {/* Generated Preview */}
                {generatedContent && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 bg-[#FBF7EF] rounded-xl p-6 border border-[#26150B]/10 text-[#26150B]">
                        <div className="flex justify-between items-start mb-4">
                            <h4 className="text-sm font-bold text-[#26150B]">Preview: {generatedContent.name}</h4>
                            <button onClick={() => setGeneratedContent(null)} className="text-[#26150B]/50 hover:text-[#26150B]"><Icons.XIcon size={16}/></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <p className="text-[9px] font-bold text-[#6E7568] uppercase mb-1">WhatsApp</p>
                                <p className="text-xs text-[#26150B] font-mono bg-white border border-[#26150B]/5 p-2 rounded">{generatedContent.whatsappBody}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-bold text-[#6E7568] uppercase mb-1">Email Subject</p>
                                <p className="text-xs text-[#26150B] font-mono bg-white border border-[#26150B]/5 p-2 rounded">{generatedContent.emailSubject}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-bold text-[#6E7568] uppercase mb-1">Email Body (Educational)</p>
                                <div className="text-xs text-[#26150B] font-mono bg-white border border-[#26150B]/5 p-2 rounded whitespace-pre-wrap max-h-40 overflow-y-auto custom-scrollbar">
                                    {generatedContent.emailBody}
                                </div>
                            </div>
                        </div>
                        <button onClick={saveGenerated} className="mt-4 bg-[#6E7568] text-white w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-[#5a6155]">Save Template</button>
                    </motion.div>
                )}
            </div>

            <div className="grid gap-4">
                {templates.map(t => (
                    <div key={t.id} className="bg-white rounded-2xl p-6 border border-[#6E7568]/10 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                             <div>
                                <h3 className="text-[#26150B] font-bold text-lg">{t.name}</h3>
                                <div className="flex gap-2 mt-2">
                                    {t.sportTags.map(tag => (
                                        <span key={tag} className="text-[9px] uppercase tracking-wider bg-[#6E7568]/10 text-[#6E7568] px-2 py-1 rounded-md">{tag}</span>
                                    ))}
                                </div>
                             </div>
                             <button 
                                onClick={() => openEditModal(t)}
                                className="text-xs bg-[#FBF7EF] hover:bg-[#FBF7EF]/80 text-[#6E7568] px-3 py-1.5 rounded-lg transition-colors border border-[#6E7568]/10 cursor-pointer"
                             >
                                Edit
                             </button>
                        </div>
                        <div className="bg-[#FBF7EF] p-4 rounded-xl border border-[#6E7568]/5">
                            <p className="text-[10px] text-[#6E7568] uppercase tracking-widest mb-2 font-bold">WhatsApp Message</p>
                            <p className="text-xs text-[#26150B]/80 whitespace-pre-wrap leading-relaxed font-mono opacity-80">{t.whatsappBody}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Edit Template Modal */}
            {editingTemplate && (
                <div className="fixed inset-0 bg-[#26150B]/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-300">
                    <div className="bg-[#FBF7EF] border border-[#6E7568]/20 rounded-[2.5rem] p-8 sm:p-10 w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-extrabold text-[#26150B] tracking-tight">Edit Template</h2>
                            <button onClick={() => setEditingTemplate(null)} className="text-[#26150B]/40 hover:text-[#26150B] hover:bg-[#26150B]/5 rounded-full p-2 transition-all"><Icons.XIcon /></button>
                        </div>
                        
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider pl-1">Template Name</label>
                                <input 
                                    className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 focus:border-[#6E7568]/50 outline-none transition-all shadow-sm focus:shadow-md font-medium" 
                                    value={editFormData.name || ''} 
                                    onChange={e => setEditFormData({ ...editFormData, name: e.target.value })} 
                                    placeholder="Template name"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider pl-1">Sport Tags (comma separated)</label>
                                <input 
                                    className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 focus:border-[#6E7568]/50 outline-none transition-all shadow-sm focus:shadow-md font-medium" 
                                    value={(editFormData.sportTags || []).join(', ')} 
                                    onChange={e => setEditFormData({ ...editFormData, sportTags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} 
                                    placeholder="Running, Hiking, General"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider pl-1">
                                    WhatsApp Message
                                    <span className="text-[9px] font-normal text-[#6E7568]/60 ml-2">
                                        (Use {"{{class_date}}"}, {"{{venue_name}}"}, {"{{invite_link}}"}, {"{{referrer_first_name}}"} as placeholders)
                                    </span>
                                </label>
                                <textarea 
                                    className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 focus:border-[#6E7568]/50 outline-none transition-all shadow-sm focus:shadow-md font-mono text-xs leading-relaxed resize-none h-40" 
                                    value={editFormData.whatsappBody || ''} 
                                    onChange={e => setEditFormData({ ...editFormData, whatsappBody: e.target.value })} 
                                    placeholder="Hey! I'm going to this workshop..."
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider pl-1">Email Subject</label>
                                <input 
                                    className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 focus:border-[#6E7568]/50 outline-none transition-all shadow-sm focus:shadow-md font-medium" 
                                    value={editFormData.emailSubject || ''} 
                                    onChange={e => setEditFormData({ ...editFormData, emailSubject: e.target.value })} 
                                    placeholder="Email subject line"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider pl-1">Email Body</label>
                                <textarea 
                                    className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 focus:border-[#6E7568]/50 outline-none transition-all shadow-sm focus:shadow-md font-mono text-xs leading-relaxed resize-none h-32" 
                                    value={editFormData.emailBody || ''} 
                                    onChange={e => setEditFormData({ ...editFormData, emailBody: e.target.value })} 
                                    placeholder="Email body content..."
                                />
                            </div>

                            <div className="flex items-center gap-3">
                                <label className="text-xs font-bold text-[#6E7568] uppercase tracking-wider">Active:</label>
                                <button 
                                    onClick={() => setEditFormData({ ...editFormData, active: !editFormData.active })}
                                    className={`relative w-12 h-6 rounded-full transition-colors ${editFormData.active ? 'bg-[#6E7568]' : 'bg-[#6E7568]/20'}`}
                                >
                                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${editFormData.active ? 'left-7' : 'left-1'}`}></span>
                                </button>
                            </div>

                            <button onClick={handleEditSave} className="w-full btn-primary py-4 rounded-2xl font-bold text-sm tracking-widest uppercase mt-6 shadow-xl hover:scale-[1.02] transition-all bg-gradient-to-r from-[#6E7568] to-[#5a6155] text-[#FBF7EF] hover:shadow-2xl">
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

interface AdminVenuesProps {
    venues: Venue[];
    onAddVenue: (v: Venue) => void;
    onEditVenue: (v: Venue) => void;
    onDeleteVenue: (id: string) => void;
}

//=============== Admin Teachers Screen ===============//
interface AdminTeachersProps {
    teachers: Teacher[];
    onAddTeacher: (i: Teacher) => void;
    onEditTeacher: (i: Teacher) => void;
    onDeleteTeacher: (id: string) => void;
    onShowToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

//=============== Admin Feedback Screen ===============//
interface AdminFeedbackProps {
    classes: Class[];
}

//=============== Admin Disclaimers Screen ===============//
interface AdminDisclaimersProps {
    disclaimers: Disclaimer[];
    onAddDisclaimer: (d: Disclaimer) => void;
    onUpdateDisclaimer: (d: Disclaimer) => void;
    onDeleteDisclaimer: (id: string) => void;
    onShowToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    venues: Venue[];
}

const AdminDisclaimers: React.FC<AdminDisclaimersProps> = ({ disclaimers, onAddDisclaimer, onUpdateDisclaimer, onDeleteDisclaimer, onShowToast, venues }) => {
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<Disclaimer>>({
        name: '',
        context: 'general',
        title: '',
        introText: '',
        sections: [],
        signatureRequired: true,
        active: true
    });
    const [sectionInput, setSectionInput] = useState<Partial<DisclaimerSection>>({
        title: '',
        content: '',
        required: true
    });

    const contextOptions = [
        { value: 'general', label: 'General' },
        { value: 'waiver', label: 'Waiver (Onboarding)' },
        { value: 'registration', label: 'Registration' },
        { value: 'class', label: 'Class-Specific' },
        { value: 'venue', label: 'Venue-Specific' }
    ];

    const handleOpenCreate = () => {
        setEditingId(null);
        setFormData({
            name: '',
            context: 'general',
            title: 'Disclaimer',
            introText: '',
            sections: [],
            signatureRequired: true,
            active: true
        });
        setShowModal(true);
    };

    const handleOpenEdit = (disclaimer: Disclaimer) => {
        setEditingId(disclaimer.id);
        setFormData({ ...disclaimer });
        setShowModal(true);
    };

    const handleAddSection = () => {
        if (!sectionInput.title || !sectionInput.content) {
            onShowToast('Please fill in section title and content', 'error');
            return;
        }
        const newSection: DisclaimerSection = {
            id: `section-${Date.now()}`,
            title: sectionInput.title,
            content: sectionInput.content,
            order: (formData.sections?.length || 0) + 1,
            required: sectionInput.required ?? true
        };
        setFormData({
            ...formData,
            sections: [...(formData.sections || []), newSection]
        });
        setSectionInput({ title: '', content: '', required: true });
    };

    const handleRemoveSection = (sectionId: string) => {
        setFormData({
            ...formData,
            sections: formData.sections?.filter(s => s.id !== sectionId) || []
        });
    };

    const handleSubmit = () => {
        if (!formData.name || !formData.title) {
            onShowToast('Please fill in required fields', 'error');
            return;
        }

        if (editingId) {
            onUpdateDisclaimer({
                ...formData as Disclaimer,
                id: editingId,
                updatedAt: new Date().toISOString()
            });
            onShowToast('Disclaimer updated successfully!', 'success');
        } else {
            onAddDisclaimer({
                ...formData as Disclaimer,
                id: `disclaimer-${Date.now()}`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            onShowToast('Disclaimer created successfully!', 'success');
        }
        setShowModal(false);
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Are you sure you want to delete this disclaimer?')) {
            onDeleteDisclaimer(id);
            onShowToast('Disclaimer deleted', 'success');
        }
    };

    const getContextLabel = (context: string) => {
        const opt = contextOptions.find(c => c.value === context);
        return opt?.label || context;
    };

    return (
        <div className="animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-[#26150B]/5 pb-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-[#26150B] tracking-tight">Disclaimers</h1>
                    <p className="text-sm text-[#6E7568] mt-1 font-medium">Manage waivers, terms, and disclaimers</p>
                </div>
                <button 
                    onClick={handleOpenCreate}
                    className="btn-primary rounded-full py-3 px-6 flex items-center gap-2 text-xs font-bold uppercase tracking-wider cursor-pointer shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                >
                    <Icons.PlusIcon size={16}/> Add Disclaimer
                </button>
            </div>

            {/* Disclaimer List */}
            <div className="grid gap-6">
                {disclaimers.map(d => (
                    <div key={d.id} className="bg-white rounded-[2rem] p-6 border border-[#6E7568]/10 shadow-sm hover:shadow-lg transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <h3 className="text-[#26150B] font-bold text-lg">{d.name}</h3>
                                    <span className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase ${
                                        d.active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
                                    }`}>
                                        {d.active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <p className="text-xs text-[#6E7568] mb-2">Context: {getContextLabel(d.context)}</p>
                                <p className="text-sm text-[#26150B]/70">{d.sections.length} sections • {d.signatureRequired ? 'Signature required' : 'No signature'}</p>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => handleOpenEdit(d)}
                                    className="p-2 hover:bg-[#6E7568]/10 rounded-lg text-[#6E7568] transition-all"
                                >
                                    <Icons.EditIcon size={18}/>
                                </button>
                                <button 
                                    onClick={() => handleDelete(d.id)}
                                    className="p-2 hover:bg-red-50 hover:text-red-500 rounded-lg text-[#6E7568]/50 transition-all"
                                >
                                    <Icons.TrashIcon size={18}/>
                                </button>
                            </div>
                        </div>
                        
                        {/* Sections Preview */}
                        <div className="bg-[#FBF7EF]/50 p-4 rounded-xl border border-[#6E7568]/5">
                            <p className="text-[10px] text-[#6E7568] uppercase tracking-widest mb-2 font-bold">Sections</p>
                            <div className="space-y-2">
                                {d.sections.map(s => (
                                    <div key={s.id} className="flex items-start gap-2 text-xs">
                                        <span className="text-[#6E7568] font-bold min-w-[20px]">{s.order}.</span>
                                        <span className="text-[#26150B]/70">{s.title}</span>
                                        {s.required && <span className="text-red-400 text-[9px]">*required</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {disclaimers.length === 0 && (
                <div className="text-center py-16 text-[#6E7568]/40 text-sm italic bg-[#FBF7EF]/30 rounded-[2rem] border-2 border-dashed border-[#6E7568]/10">
                    No disclaimers created yet. Click "Add Disclaimer" to get started.
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-[#26150B]/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-300">
                    <div className="bg-[#FBF7EF] border border-[#6E7568]/20 rounded-[2.5rem] p-8 sm:p-10 w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-extrabold text-[#26150B] tracking-tight">
                                {editingId ? 'Edit Disclaimer' : 'Create Disclaimer'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-[#26150B]/40 hover:text-[#26150B] hover:bg-[#26150B]/5 rounded-full p-2 transition-all">
                                <Icons.XIcon />
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Basic Info */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider">Name</label>
                                    <input 
                                        className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 focus:border-[#6E7568]/50 outline-none transition-all shadow-sm font-medium" 
                                        value={formData.name || ''} 
                                        onChange={e => setFormData({...formData, name: e.target.value})} 
                                        placeholder="e.g., General Waiver"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider">Context</label>
                                    <select 
                                        className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 outline-none shadow-sm font-medium"
                                        value={formData.context}
                                        onChange={e => setFormData({...formData, context: e.target.value as any})}
                                    >
                                        {contextOptions.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider">Title</label>
                                <input 
                                    className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 focus:border-[#6E7568]/50 outline-none transition-all shadow-sm font-medium" 
                                    value={formData.title || ''} 
                                    onChange={e => setFormData({...formData, title: e.target.value})} 
                                    placeholder="e.g., Safety & Liability Waiver"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider">Introduction Text</label>
                                <textarea 
                                    className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 focus:border-[#6E7568]/50 outline-none transition-all shadow-sm font-medium resize-none h-24" 
                                    value={formData.introText || ''} 
                                    onChange={e => setFormData({...formData, introText: e.target.value})} 
                                    placeholder="Welcome text shown to users..."
                                />
                            </div>

                            {/* Sections */}
                            <div>
                                <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider">Sections</label>
                                <div className="bg-white p-4 rounded-2xl border border-[#6E7568]/10 space-y-4">
                                    {formData.sections?.map((section, idx) => (
                                        <div key={section.id} className="bg-[#FBF7EF] p-3 rounded-xl">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-xs font-bold text-[#26150B]">{idx + 1}. {section.title}</span>
                                                <button 
                                                    onClick={() => handleRemoveSection(section.id)}
                                                    className="text-red-400 hover:text-red-600 text-xs"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                            <p className="text-[10px] text-[#6E7568] line-clamp-2">{section.content}</p>
                                        </div>
                                    ))}

                                    {/* Add Section Form */}
                                    <div className="border-t border-[#6E7568]/10 pt-4">
                                        <p className="text-[10px] font-bold text-[#6E7568] uppercase tracking-wider mb-2">Add New Section</p>
                                        <div className="space-y-2">
                                            <input 
                                                className="w-full p-3 rounded-xl bg-[#FBF7EF] text-[#26150B] border border-[#6E7568]/10 text-xs font-medium" 
                                                value={sectionInput.title || ''} 
                                                onChange={e => setSectionInput({...sectionInput, title: e.target.value})} 
                                                placeholder="Section title (e.g., Medical Clearance)"
                                            />
                                            <textarea 
                                                className="w-full p-3 rounded-xl bg-[#FBF7EF] text-[#26150B] border border-[#6E7568]/10 text-xs font-medium resize-none h-20" 
                                                value={sectionInput.content || ''} 
                                                onChange={e => setSectionInput({...sectionInput, content: e.target.value})} 
                                                placeholder="Section content..."
                                            />
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="checkbox" 
                                                    id="sectionRequired"
                                                    checked={sectionInput.required}
                                                    onChange={e => setSectionInput({...sectionInput, required: e.target.checked})}
                                                    className="rounded"
                                                />
                                                <label htmlFor="sectionRequired" className="text-xs text-[#6E7568]">Required</label>
                                            </div>
                                            <button 
                                                onClick={handleAddSection}
                                                className="w-full py-2 bg-[#6E7568] text-white rounded-xl text-xs font-bold uppercase"
                                            >
                                                Add Section
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Options */}
                            <div className="flex items-center gap-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={formData.signatureRequired}
                                        onChange={e => setFormData({...formData, signatureRequired: e.target.checked})}
                                        className="rounded border-[#6E7568]/20"
                                    />
                                    <span className="text-xs font-bold text-[#6E7568] uppercase">Signature Required</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={formData.active}
                                        onChange={e => setFormData({...formData, active: e.target.checked})}
                                        className="rounded border-[#6E7568]/20"
                                    />
                                    <span className="text-xs font-bold text-[#6E7568] uppercase">Active</span>
                                </label>
                            </div>

                            <button onClick={handleSubmit} className="w-full btn-primary py-4 rounded-2xl font-bold text-sm tracking-widest uppercase mt-6 shadow-xl hover:scale-[1.02] transition-all bg-gradient-to-r from-[#6E7568] to-[#5a6155] text-[#FBF7EF] hover:shadow-2xl">
                                {editingId ? 'Save Changes' : 'Create Disclaimer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

interface AdminTeacherApprovalsProps {
    onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

interface TeacherRequest {
    id: string;
    user_id: string;
    name: string;
    email: string;
    phone: string | null;
    qualifications: string | null;
    experience: string | null;
    specializations: string[];
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    reviewed_by: string | null;
    reviewed_at: string | null;
}

const AdminTeacherApprovals: React.FC<AdminTeacherApprovalsProps> = ({ onShowToast }) => {
    const [requests, setRequests] = useState<TeacherRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');

    useEffect(() => {
        loadRequests();
    }, []);

    const loadRequests = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/teacher/pending');
            if (response.ok) {
                const data = await response.json();
                setRequests(data.requests || []);
            }
        } catch (err) {
            console.error('Failed to load teacher requests:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (requestId: string) => {
        try {
            const response = await fetch('/api/teacher/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId })
            });
            
            if (response.ok) {
                onShowToast('Teacher approved successfully!', 'success');
                loadRequests();
            } else {
                const err = await response.json();
                onShowToast(err.error || 'Failed to approve teacher', 'error');
            }
        } catch (err) {
            onShowToast('Failed to approve teacher', 'error');
        }
    };

    const handleReject = async (requestId: string) => {
        try {
            const response = await fetch('/api/teacher/reject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId })
            });
            
            if (response.ok) {
                onShowToast('Teacher request rejected', 'info');
                loadRequests();
            } else {
                const err = await response.json();
                onShowToast(err.error || 'Failed to reject teacher', 'error');
            }
        } catch (err) {
            onShowToast('Failed to reject teacher', 'error');
        }
    };

    const filteredRequests = requests.filter(r => filter === 'pending' ? r.status === 'pending' : filter === 'approved' ? r.status === 'approved' : r.status === 'rejected');

    return (
        <div className="animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-[#26150B]/5 pb-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-[#26150B] tracking-tight">Teacher Approvals</h1>
                    <p className="text-sm text-[#6E7568] mt-1 font-medium">Review and approve teacher registration requests</p>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-6">
                {(['pending', 'approved', 'rejected'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                            filter === f 
                                ? 'bg-[#26150B] text-[#FBF7EF]' 
                                : 'bg-[#FBF7EF] text-[#6E7568] border border-[#6E7568]/20 hover:bg-[#6E7568]/10'
                        }`}
                    >
                        {f === 'pending' && `Pending (${requests.filter(r => r.status === 'pending').length})`}
                        {f === 'approved' && 'Approved'}
                        {f === 'rejected' && 'Rejected'}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-4 border-[#6E7568]/20 border-t-[#6E7568] rounded-full animate-spin" />
                </div>
            ) : filteredRequests.length === 0 ? (
                <div className="bg-white p-12 rounded-2xl border border-[#6E7568]/10 text-center">
                    <div className="w-16 h-16 bg-[#6E7568]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Icons.UsersIcon size={24} className="text-[#6E7568]" />
                    </div>
                    <h3 className="text-lg font-bold text-[#26150B] mb-2">No {filter} requests</h3>
                    <p className="text-sm text-[#6E7568]">
                        {filter === 'pending' ? 'No teacher applications waiting for review.' : `No ${filter} teacher requests.`}
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredRequests.map(request => (
                        <div key={request.id} className="bg-white p-6 rounded-2xl border border-[#6E7568]/10 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-lg font-bold text-[#26150B]">{request.name}</h3>
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                                            request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                            request.status === 'approved' ? 'bg-green-100 text-green-800' :
                                            'bg-red-100 text-red-800'
                                        }`}>
                                            {request.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-[#6E7568] mb-1">{request.email}</p>
                                    {request.phone && <p className="text-sm text-[#6E7568] mb-2">{request.phone}</p>}
                                    
                                    {request.qualifications && (
                                        <div className="mb-2">
                                            <p className="text-xs font-bold text-[#26150B] uppercase tracking-wider mb-1">Qualifications</p>
                                            <p className="text-sm text-[#6E7568]">{request.qualifications}</p>
                                        </div>
                                    )}
                                    
                                    {request.experience && (
                                        <div className="mb-2">
                                            <p className="text-xs font-bold text-[#26150B] uppercase tracking-wider mb-1">Experience</p>
                                            <p className="text-sm text-[#6E7568]">{request.experience}</p>
                                        </div>
                                    )}
                                    
                                    {request.specializations && request.specializations.length > 0 && (
                                        <div>
                                            <p className="text-xs font-bold text-[#26150B] uppercase tracking-wider mb-1">Specializations</p>
                                            <div className="flex flex-wrap gap-2">
                                                {request.specializations.map(spec => (
                                                    <span key={spec} className="px-2 py-1 bg-[#6E7568]/10 rounded-full text-[10px] font-bold text-[#6E7568] uppercase">
                                                        {spec}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    
                                    <p className="text-xs text-[#6E7568]/60 mt-2">
                                        Submitted: {new Date(request.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                
                                {request.status === 'pending' && (
                                    <div className="flex gap-2 md:flex-col">
                                        <button
                                            onClick={() => handleApprove(request.id)}
                                            className="px-4 py-2 bg-green-600 text-white rounded-full text-xs font-bold uppercase tracking-wider hover:bg-green-700 transition-colors"
                                        >
                                            Approve
                                        </button>
                                        <button
                                            onClick={() => handleReject(request.id)}
                                            className="px-4 py-2 bg-red-600 text-white rounded-full text-xs font-bold uppercase tracking-wider hover:bg-red-700 transition-colors"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const AdminFeedback: React.FC<AdminFeedbackProps> = ({ classes }) => {
    const [feedback, setFeedback] = useState<Feedback[]>([]);
    const [stats, setStats] = useState<FeedbackStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState<string>('all');

    useMemo(() => {
        const loadFeedback = async () => {
            try {
                const response = await fetch('/api/feedback');
                const data = await response.json();
                setFeedback(data);
                
                const statsResponse = await fetch('/api/feedback/stats');
                const statsData = await statsResponse.json();
                setStats(statsData);
            } catch (error) {
                console.error('Error loading feedback:', error);
            } finally {
                setLoading(false);
            }
        };
        loadFeedback();
    }, []);

    const filteredFeedback = filterType === 'all' 
        ? feedback 
        : feedback.filter(f => f.type === filterType);

    const getClassTitle = (classId?: string) => {
        if (!classId) return 'General';
        const cls = classes.find(c => c.id === classId);
        return cls?.title || 'Unknown Class';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6E7568]"></div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#26150B]/5 pb-4">
                <div>
                    <h1 className="text-xl md:text-3xl font-extrabold text-[#26150B] tracking-tight">Feedback</h1>
                    <p className="text-sm text-[#6E7568] mt-1 font-medium">Client Feedback & NPS Scores</p>
                </div>
            </div>

            {/* Stats Overview */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-2xl p-5 border border-[#6E7568]/10 shadow-sm">
                        <p className="text-[9px] text-[#6E7568] font-bold uppercase tracking-wider mb-1">Total Feedback</p>
                        <p className="text-3xl font-extrabold text-[#26150B]">{stats.totalFeedback}</p>
                    </div>
                    <div className="bg-white rounded-2xl p-5 border border-[#6E7568]/10 shadow-sm">
                        <p className="text-[9px] text-[#6E7568] font-bold uppercase tracking-wider mb-1">Avg Rating</p>
                        <p className="text-3xl font-extrabold text-[#26150B] flex items-center gap-1">
                            {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '-'}
                            {stats.averageRating > 0 && <span className="text-lg text-[#f59e0b]">★</span>}
                        </p>
                    </div>
                    <div className="bg-white rounded-2xl p-5 border border-[#6E7568]/10 shadow-sm">
                        <p className="text-[9px] text-[#6E7568] font-bold uppercase tracking-wider mb-1">Avg NPS</p>
                        <p className="text-3xl font-extrabold text-[#26150B]">{stats.averageNps > 0 ? stats.averageNps.toFixed(1) : '-'}</p>
                    </div>
                    <div className="bg-white rounded-2xl p-5 border border-[#6E7568]/10 shadow-sm">
                        <p className="text-[9px] text-[#6E7568] font-bold uppercase tracking-wider mb-1">NPS Score</p>
                        <p className={`text-3xl font-extrabold ${
                            stats.npsDistribution.promoter - stats.npsDistribution.detractor > 0 ? 'text-green-500' :
                            stats.npsDistribution.promoter - stats.npsDistribution.detractor < 0 ? 'text-red-500' : 'text-[#26150B]'
                        }`}>
                            {stats.totalFeedback > 0 
                                ? stats.npsDistribution.promoter - stats.npsDistribution.detractor 
                                : '-'}
                        </p>
                    </div>
                </div>
            )}

            {/* Rating Distribution */}
            {stats && stats.totalFeedback > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Star Rating Distribution */}
                    <div className="bg-white rounded-[2rem] p-6 border border-[#6E7568]/10 shadow-sm">
                        <h3 className="text-xs font-bold text-[#26150B] mb-6 uppercase tracking-wider flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#6E7568]"></span> Rating Distribution
                        </h3>
                        <div className="space-y-3">
                            {[5, 4, 3, 2, 1].map(star => {
                                const count = stats.ratingDistribution[star] || 0;
                                const percentage = stats.totalFeedback > 0 ? (count / stats.totalFeedback) * 100 : 0;
                                return (
                                    <div key={star} className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-[#26150B] w-6">{star} ★</span>
                                        <div className="flex-1 h-4 bg-[#FBF7EF] rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-[#f59e0b] rounded-full transition-all duration-500" 
                                                style={{ width: `${percentage}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-xs text-[#6E7568] w-8 text-right">{count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* NPS Distribution */}
                    <div className="bg-white rounded-[2rem] p-6 border border-[#6E7568]/10 shadow-sm">
                        <h3 className="text-xs font-bold text-[#26150B] mb-6 uppercase tracking-wider flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#6E7568]"></span> NPS Distribution
                        </h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-red-400"></span>
                                    <span className="text-xs text-[#6E7568]">Detractors (0-6)</span>
                                </div>
                                <span className="text-sm font-bold text-[#26150B]">{stats.npsDistribution.detractor}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
                                    <span className="text-xs text-[#6E7568]">Passives (7-8)</span>
                                </div>
                                <span className="text-sm font-bold text-[#26150B]">{stats.npsDistribution.passive}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-green-400"></span>
                                    <span className="text-xs text-[#6E7568]">Promoters (9-10)</span>
                                </div>
                                <span className="text-sm font-bold text-[#26150B]">{stats.npsDistribution.promoter}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Feedback List */}
            <div className="bg-white rounded-[2rem] p-6 border border-[#6E7568]/10 shadow-sm">
                <div className="flex justify-between items-center mb-6 border-b border-[#FBF7EF] pb-4">
                    <h3 className="text-xs font-bold text-[#26150B] uppercase tracking-wider flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#6E7568]"></span> Recent Feedback
                    </h3>
                    <select 
                        value={filterType} 
                        onChange={(e) => setFilterType(e.target.value)}
                        className="bg-[#FBF7EF] border border-[#6E7568]/10 text-[#26150B] font-medium rounded-full p-2 px-4 text-xs outline-none"
                    >
                        <option value="all">All Types</option>
                        <option value="general">General</option>
                        <option value="post_class">Post-Class</option>
                        <option value="nps">NPS</option>
                    </select>
                </div>
                <div className="space-y-4">
                    {filteredFeedback.length > 0 ? filteredFeedback
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map(item => (
                        <div key={item.id} className="p-4 bg-[#FBF7EF]/50 rounded-2xl border border-[#6E7568]/10 hover:border-[#6E7568]/20 transition-colors">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-[#6E7568]/10 flex items-center justify-center text-[#6E7568] font-bold text-sm">
                                        {item.userName.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-[#26150B]">{item.userName}</p>
                                        <p className="text-[10px] text-[#6E7568]">{getClassTitle(item.classId)}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase ${
                                        item.type === 'nps' ? 'bg-purple-100 text-purple-600' :
                                        item.type === 'post_class' ? 'bg-blue-100 text-blue-600' :
                                        'bg-gray-100 text-gray-600'
                                    }`}>
                                        {item.type.replace('_', ' ')}
                                    </span>
                                    <p className="text-[9px] text-[#6E7568] mt-1">{new Date(item.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                            
                            {item.rating && (
                                <div className="mb-2 flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <span key={star} className={star <= item.rating! ? 'text-[#f59e0b]' : 'text-gray-300'}>★</span>
                                    ))}
                                </div>
                            )}
                            
                            {item.npsScore !== undefined && (
                                <div className="mb-2">
                                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                                        item.npsScore <= 6 ? 'bg-red-100 text-red-600' :
                                        item.npsScore <= 8 ? 'bg-yellow-100 text-yellow-600' :
                                        'bg-green-100 text-green-600'
                                    }`}>
                                        {item.npsScore}
                                    </span>
                                </div>
                            )}
                            
                            {item.comment && (
                                <p className="text-sm text-[#26150B]/80 italic leading-relaxed">"{item.comment}"</p>
                            )}
                        </div>
                    )) : (
                        <div className="text-center py-12 text-[#6E7568]/40 text-sm italic bg-[#FBF7EF]/30 rounded-xl border border-dashed border-[#6E7568]/10">
                            No feedback yet.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
const AdminTeachers: React.FC<AdminTeachersProps> = ({ teachers, onAddTeacher, onEditTeacher, onDeleteTeacher, onShowToast }) => {
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<Teacher>>({ 
        name: "", email: "", phone: "", bio: "", specialties: [], active: true 
    });
    const [specialtyInput, setSpecialtyInput] = useState("");

    const handleOpenCreate = () => {
        setEditingId(null);
        setFormData({ name: "", email: "", phone: "", bio: "", specialties: [], active: true });
        setShowModal(true);
    };

    const handleOpenEdit = (teacher: Teacher) => {
        setEditingId(teacher.id);
        setFormData({ ...teacher });
        setShowModal(true);
    };

    const handleAddSpecialty = () => {
        if (specialtyInput.trim() && !formData.specialties?.includes(specialtyInput.trim())) {
            setFormData({ 
                ...formData, 
                specialties: [...(formData.specialties || []), specialtyInput.trim()] 
            });
            setSpecialtyInput("");
        }
    };

    const handleRemoveSpecialty = (specialty: string) => {
        setFormData({
            ...formData,
            specialties: formData.specialties?.filter(s => s !== specialty) || []
        });
    };

    const handleSubmit = () => {
        if (!formData.name || !formData.email) {
            onShowToast("Name and email are required", "error");
            return;
        }
        
        if (editingId) {
            onEditTeacher({
                id: editingId,
                name: formData.name,
                email: formData.email,
                phone: formData.phone || "",
                bio: formData.bio || "",
                specialties: formData.specialties || [],
                active: formData.active ?? true
            });
            onShowToast("Teacher updated successfully!", "success");
        } else {
            onAddTeacher({
                id: `teacher-${Date.now()}`,
                name: formData.name,
                email: formData.email,
                phone: formData.phone || "",
                bio: formData.bio || "",
                specialties: formData.specialties || [],
                active: true
            });
            onShowToast("Teacher added successfully!", "success");
        }
        setShowModal(false);
    };

    return (
        <div className="animate-fade-in relative z-10">
            <div className="flex justify-between items-center mb-8 border-b border-[#26150B]/5 pb-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-[#26150B] tracking-tight">Teachers</h1>
                    <p className="text-sm text-[#6E7568] mt-1 font-medium">Manage Teaching Staff</p>
                </div>
                <button 
                    onClick={handleOpenCreate} 
                    className="btn-primary rounded-full py-3 px-6 flex items-center gap-2 text-xs font-bold uppercase tracking-wider cursor-pointer shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all z-20 relative"
                >
                    <Icons.PlusIcon size={16}/> Add Teacher
                </button>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {teachers.map(teacher => (
                    <div key={teacher.id} className="bg-white rounded-[2rem] p-8 border border-[#6E7568]/10 hover:shadow-lg transition-all duration-300 shadow-sm relative group overflow-hidden hover:-translate-y-1">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-[#FBF7EF] rounded-bl-[2rem] -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
                        
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-12 h-12 bg-[#FBF7EF] rounded-2xl flex items-center justify-center text-[#6E7568] shadow-inner border border-[#6E7568]/5 group-hover:scale-110 transition-transform">
                                    <Icons.UsersIcon size={24} />
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleOpenEdit(teacher)} className="p-2 text-[#6E7568] hover:bg-[#6E7568]/10 rounded-lg transition-all bg-white shadow-sm border border-[#6E7568]/10">
                                        <Icons.EditIcon size={14} />
                                    </button>
                                    <button onClick={() => {
                                        if(window.confirm("Delete teacher?")) onDeleteTeacher(teacher.id);
                                    }} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all bg-white shadow-sm border border-red-100">
                                        <Icons.TrashIcon size={14} />
                                    </button>
                                </div>
                            </div>
                            
                            <h3 className="text-[#26150B] font-bold text-xl mb-1 group-hover:text-[#6E7568] transition-colors">{teacher.name}</h3>
                            <p className="text-xs text-[#6E7568] mb-3 font-medium">{teacher.email}</p>
                            
                            {teacher.bio && (
                                <p className="text-xs text-[#26150B]/70 mb-4 line-clamp-2">{teacher.bio}</p>
                            )}

                            <div className="flex flex-wrap gap-1.5 mb-3">
                                {teacher.specialties.slice(0, 4).map(s => (
                                    <span key={s} className="px-2 py-1 bg-[#FBF7EF] text-[#6E7568] rounded-lg text-[9px] font-bold uppercase tracking-wide border border-[#6E7568]/10">
                                        {s}
                                    </span>
                                ))}
                                {teacher.specialties.length > 4 && (
                                    <span className="px-2 py-1 bg-[#6E7568]/10 text-[#6E7568] rounded-lg text-[9px] font-bold">
                                        +{teacher.specialties.length - 4} more
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${teacher.active ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                <span className="text-[10px] font-bold text-[#6E7568] uppercase tracking-wide">
                                    {teacher.active ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {teachers.length === 0 && (
                <div className="text-center py-16 text-[#6E7568]/40 text-sm italic bg-[#FBF7EF]/30 rounded-[2rem] border-2 border-dashed border-[#6E7568]/10">
                    No teachers added yet. Click "Add Teacher" to get started.
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-[#26150B]/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-300">
                    <div className="bg-[#FBF7EF] border border-[#6E7568]/20 rounded-[2.5rem] p-8 sm:p-10 w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-extrabold text-[#26150B] tracking-tight">{editingId ? "Edit Teacher" : "Add Teacher"}</h2>
                            <button onClick={() => setShowModal(false)} className="text-[#26150B]/40 hover:text-[#26150B] hover:bg-[#26150B]/5 rounded-full p-2 transition-all"><Icons.XIcon /></button>
                        </div>
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider pl-1">Name *</label>
                                <input 
                                    className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 focus:border-[#6E7568]/50 outline-none transition-all shadow-sm focus:shadow-md font-medium" 
                                    value={formData.name} 
                                    onChange={e=>setFormData({...formData, name: e.target.value})} 
                                    placeholder="e.g. Zelda"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider pl-1">Email *</label>
                                <input 
                                    type="email"
                                    className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 focus:border-[#6E7568]/50 outline-none transition-all shadow-sm focus:shadow-md font-medium" 
                                    value={formData.email} 
                                    onChange={e=>setFormData({...formData, email: e.target.value})} 
                                    placeholder="teacher@example.com"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider pl-1">Phone</label>
                                <input 
                                    className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 focus:border-[#6E7568]/50 outline-none transition-all shadow-sm focus:shadow-md font-medium" 
                                    value={formData.phone} 
                                    onChange={e=>setFormData({...formData, phone: e.target.value})}
                                    placeholder="+27 82 123 4567"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider pl-1">Bio</label>
                                <textarea 
                                    className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 focus:border-[#6E7568]/50 outline-none transition-all shadow-sm focus:shadow-md font-medium resize-none h-24" 
                                    value={formData.bio} 
                                    onChange={e=>setFormData({...formData, bio: e.target.value})}
                                    placeholder="Brief bio and qualifications..."
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider pl-1">Specialties</label>
                                <div className="flex gap-2 mb-2">
                                    <input 
                                        className="flex-1 p-3 rounded-xl bg-white text-[#26150B] border border-[#6E7568]/10 focus:border-[#6E7568]/50 outline-none transition-all shadow-sm font-medium text-sm" 
                                        value={specialtyInput}
                                        onChange={e => setSpecialtyInput(e.target.value)}
                                        placeholder="e.g. Running, Yoga"
                                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSpecialty())}
                                    />
                                    <button 
                                        onClick={handleAddSpecialty}
                                        className="px-4 py-2 bg-[#6E7568] text-[#FBF7EF] rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-[#5a6155] transition-colors"
                                    >
                                        Add
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {formData.specialties?.map(s => (
                                        <span key={s} className="px-3 py-1.5 bg-[#FBF7EF] text-[#6E7568] rounded-lg text-xs font-medium flex items-center gap-2 border border-[#6E7568]/10">
                                            {s}
                                            <button onClick={() => handleRemoveSpecialty(s)} className="text-[#6E7568]/50 hover:text-red-500">
                                                <Icons.XIcon size={12} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                            {editingId && (
                                <div className="flex items-center gap-3">
                                    <label className="text-xs font-bold text-[#6E7568] uppercase tracking-wider">Active:</label>
                                    <button 
                                        onClick={() => setFormData({ ...formData, active: !formData.active })}
                                        className={`relative w-12 h-6 rounded-full transition-colors ${formData.active ? 'bg-[#6E7568]' : 'bg-[#6E7568]/20'}`}
                                    >
                                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${formData.active ? 'left-7' : 'left-1'}`}></span>
                                    </button>
                                </div>
                            )}
                            <button onClick={handleSubmit} className="w-full btn-primary py-4 rounded-2xl font-bold text-sm tracking-widest uppercase mt-6 shadow-xl hover:scale-[1.02] transition-all bg-gradient-to-r from-[#6E7568] to-[#5a6155] text-[#FBF7EF] hover:shadow-2xl">
                                {editingId ? "Save Changes" : "Add Teacher"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const AdminVenues: React.FC<AdminVenuesProps> = ({ venues, onAddVenue, onEditVenue, onDeleteVenue }) => {
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<Venue>>({ name: "", address: "", suburb: "", mapsUrl: "", notes: "" });

    const handleOpenCreate = () => {
        setEditingId(null);
        setFormData({ name: "", address: "", suburb: "", mapsUrl: "", notes: "" });
        setShowModal(true);
    };

    const handleOpenEdit = (venue: Venue) => {
        setEditingId(venue.id);
        setFormData({ ...venue });
        setShowModal(true);
    };

    const handleSubmit = () => {
        if (!formData.name || !formData.address) return;
        
        if (editingId) {
            onEditVenue({
                id: editingId,
                name: formData.name,
                address: formData.address,
                suburb: formData.suburb || "",
                mapsUrl: formData.mapsUrl || "",
                notes: formData.notes || ""
            });
        } else {
            onAddVenue({
                id: `v${Date.now()}`,
                name: formData.name,
                address: formData.address,
                suburb: formData.suburb || "",
                mapsUrl: formData.mapsUrl || "",
                notes: formData.notes || ""
            });
        }
        setShowModal(false);
    };

    return (
        <div className="animate-fade-in relative z-10">
             <div className="flex justify-between items-center mb-8 border-b border-[#26150B]/5 pb-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-[#26150B] tracking-tight">Venues</h1>
                    <p className="text-sm text-[#6E7568] mt-1 font-medium">Manage Locations</p>
                </div>
                <button 
                    onClick={handleOpenCreate} 
                    className="btn-primary rounded-full py-3 px-6 flex items-center gap-2 text-xs font-bold uppercase tracking-wider cursor-pointer shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all z-20 relative"
                >
                    <Icons.PlusIcon size={16}/> Add Venue
                </button>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {venues.map(v => (
                    <div key={v.id} className="bg-white rounded-[2rem] p-8 border border-[#6E7568]/10 hover:shadow-lg transition-all duration-300 shadow-sm relative group overflow-hidden hover:-translate-y-1">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-[#FBF7EF] rounded-bl-[2rem] -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
                        
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-12 h-12 bg-[#FBF7EF] rounded-2xl flex items-center justify-center text-[#6E7568] shadow-inner border border-[#6E7568]/5 group-hover:scale-110 transition-transform">
                                    <Icons.MapPinIcon size={24} />
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleOpenEdit(v)} className="p-2 text-[#6E7568] hover:bg-[#6E7568]/10 rounded-lg transition-all bg-white shadow-sm border border-[#6E7568]/10">
                                        <Icons.EditIcon size={14} />
                                    </button>
                                    <button onClick={() => {
                                        if(window.confirm("Delete venue?")) onDeleteVenue(v.id);
                                    }} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all bg-white shadow-sm border border-red-100">
                                        <Icons.TrashIcon size={14} />
                                    </button>
                                </div>
                            </div>
                            
                            <h3 className="text-[#26150B] font-bold text-xl mb-2 group-hover:text-[#6E7568] transition-colors">{v.name}</h3>
                            <p className="text-xs text-[#6E7568] mb-4 font-medium flex items-center gap-2"><Icons.MapPinIcon size={12}/> {v.suburb || "No Suburb"}</p>
                            
                            <div className="bg-[#FBF7EF]/50 p-4 rounded-xl border border-[#FBF7EF] mb-4">
                                <p className="text-xs text-[#26150B]/80 leading-relaxed font-medium">{v.address}</p>
                            </div>

                            {v.mapsUrl && (
                                <a href={v.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#6E7568] hover:text-[#26150B] hover:underline transition-colors group/link">
                                    Open Maps <Icons.ArrowLeftIcon size={10} className="rotate-180 group-hover/link:translate-x-1 transition-transform"/>
                                </a>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                 <div className="fixed inset-0 bg-[#26150B]/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-300">
                    <div className="bg-[#FBF7EF] border border-[#6E7568]/20 rounded-[2.5rem] p-8 sm:p-10 w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-extrabold text-[#26150B] tracking-tight">{editingId ? "Edit Venue" : "Add Venue"}</h2>
                            <button onClick={() => setShowModal(false)} className="text-[#26150B]/40 hover:text-[#26150B] hover:bg-[#26150B]/5 rounded-full p-2 transition-all"><Icons.XIcon /></button>
                        </div>
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider pl-1">Name</label>
                                <input 
                                    className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 focus:border-[#6E7568]/50 outline-none transition-all shadow-sm focus:shadow-md font-medium" 
                                    value={formData.name} 
                                    onChange={e=>setFormData({...formData, name: e.target.value})} 
                                    placeholder="e.g. The Dome"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider pl-1">Address</label>
                                <input 
                                    className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 focus:border-[#6E7568]/50 outline-none transition-all shadow-sm focus:shadow-md font-medium" 
                                    value={formData.address} 
                                    onChange={e=>setFormData({...formData, address: e.target.value})} 
                                    placeholder="Full Street Address"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider pl-1">Suburb</label>
                                    <input 
                                        className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 focus:border-[#6E7568]/50 outline-none transition-all shadow-sm focus:shadow-md font-medium" 
                                        value={formData.suburb} 
                                        onChange={e=>setFormData({...formData, suburb: e.target.value})}
                                        placeholder="e.g. Sandton"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider pl-1">Maps URL</label>
                                    <input 
                                        className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 focus:border-[#6E7568]/50 outline-none transition-all shadow-sm focus:shadow-md font-medium" 
                                        value={formData.mapsUrl} 
                                        onChange={e=>setFormData({...formData, mapsUrl: e.target.value})}
                                        placeholder="https://maps.google.com/..."
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider pl-1">Notes (Optional)</label>
                                <textarea 
                                    className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 focus:border-[#6E7568]/50 outline-none transition-all shadow-sm focus:shadow-md font-medium resize-none h-24" 
                                    value={formData.notes} 
                                    onChange={e=>setFormData({...formData, notes: e.target.value})}
                                    placeholder="Parking info, access codes, etc."
                                />
                            </div>
                            <button onClick={handleSubmit} className="w-full btn-primary py-4 rounded-2xl font-bold text-sm tracking-widest uppercase mt-6 shadow-xl hover:scale-[1.02] transition-all bg-gradient-to-r from-[#6E7568] to-[#5a6155] text-[#FBF7EF] hover:shadow-2xl">
                                {editingId ? "Save Changes" : "Create Venue"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

interface AdminAppProps {
  user: User;
  onSignOut: () => void;
  classes: Class[];
  registrations: Registration[];
  venues: Venue[];
  templates: Template[];
  disclaimers: Disclaimer[];
  settings: AppSettings;
  users: User[];
  teachers: Teacher[];
  onAddClass: (c: Class) => void;
  onEditClass: (c: Class) => void;
  onDeleteClass: (id: string) => void;
  onAddVenue: (v: Venue) => void;
  onEditVenue: (v: Venue) => void;
  onDeleteVenue: (id: string) => void;
  onAddTemplate: (t: Template) => void;
  onUpdateTemplate: (t: Template) => void;
  onAddDisclaimer: (d: Disclaimer) => void;
  onUpdateDisclaimer: (d: Disclaimer) => void;
  onDeleteDisclaimer: (id: string) => void;
  onUpdateSettings: (s: AppSettings) => void;
  onVerifyPayment: (id: string, verified: boolean) => void;
  onPreviewLanding: () => void;
  onSaveCalendarTokens: (tokens: any) => void;
  onUpdateUser?: (user: User) => void;
  onAddAdmin?: (email: string, name: string, role: AdminRole) => void;
  onRemoveAdmin?: (userId: string) => void;
  onAddTeacher: (i: Teacher) => void;
  onEditTeacher: (i: Teacher) => void;
  onDeleteTeacher: (id: string) => void;
  chatMessages?: ChatMessage[];
  onSendChatMessage?: (content: string, recipientId?: string) => void;
}

export const AdminApp: React.FC<AdminAppProps> = ({
  user,
  onSignOut,
  classes,
  registrations,
  venues,
  templates,
  disclaimers,
  settings,
  users,
  teachers,
  onAddClass,
  onEditClass,
  onDeleteClass,
  onAddVenue,
  onEditVenue,
  onDeleteVenue,
  onAddTemplate,
  onUpdateTemplate,
  onAddDisclaimer,
  onUpdateDisclaimer,
  onDeleteDisclaimer,
  onUpdateSettings,
  onVerifyPayment,
  onPreviewLanding,
  onSaveCalendarTokens,
  onUpdateUser,
  onAddAdmin,
  onRemoveAdmin,
  onAddTeacher,
  onEditTeacher,
  onDeleteTeacher,
  chatMessages = [],
  onSendChatMessage
}) => {
  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toast = useToast();
  
  // Chat state
  const [selectedChatUserId, setSelectedChatUserId] = useState<string | null>(null);
  
  // Admin management state
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<AdminRole>('staff');
  
  // 2FA setup state
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFASecret, setTwoFASecret] = useState('');
  const [twoFAQrUrl, setTwoFAQrUrl] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  
  // Check if current user can manage admins
  const currentUserPermissions = user.isAdmin ? ROLE_PERMISSIONS[user.adminRole || 'admin'] : null;
  const canManageAdmins = currentUserPermissions?.canManageAdmins ?? false;
  
  // Get all admin users
  const adminUsers = users.filter(u => u.isAdmin);

  const handleConnectCalendar = async () => {
      try {
          const response = await fetch('/api/auth/google/url');
          if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.error || 'Failed to get auth URL');
          }
          const { url } = await response.json();
          
          const width = 500;
          const height = 600;
          const left = window.screen.width / 2 - width / 2;
          const top = window.screen.height / 2 - height / 2;
          
          window.open(url, 'google_auth', `width=${width},height=${height},top=${top},left=${left}`);

          const handleMessage = (event: MessageEvent) => {
              if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
                  onSaveCalendarTokens(event.data.tokens);
                  toast.showToast("Google Calendar connected successfully!", "success");
                  window.removeEventListener('message', handleMessage);
              }
          };
          window.addEventListener('message', handleMessage);

      } catch (error: any) {
          console.error(error);
          toast.showToast(`Failed to initiate Google Calendar connection: ${error.message}`, "error");
      }
  };

  const handleCopyNextClassInvite = () => {
      const upcomingClasses = classes
          .filter(c => c.status === "published" && new Date(c.dateTime) > new Date())
          .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
      
      const nextClass = upcomingClasses[0];
      if (nextClass) {
          const link = `https://app.pausefmd.co.za/invite/${nextClass.slug}`;
          navigator.clipboard.writeText(link);
          toast.showToast("Invite link copied to clipboard!", "success");
      }
  };

  return (
    // Changed main background from Espresso to Cream for a lighter, "Cream & Sage" look
    <div className="flex h-screen bg-[#FBF7EF] overflow-hidden font-['Montserrat']">
      <AdminSidebar 
        user={user} 
        onSignOut={onSignOut} 
        activeSection={activeSection} 
        onSectionChange={setActiveSection}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      
      <main className="flex-1 flex flex-col h-full relative overflow-hidden lg:ml-64 pb-6">
        <AdminHeaderBar 
            user={user} 
            onSignOut={onSignOut} 
            showBack={activeSection !== 'dashboard'}
            onBack={() => setActiveSection('dashboard')}
            onMenuClick={() => setSidebarOpen(true)}
        />

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar relative">
            {/* Background Grain/Noise */}
            <div className="fixed inset-0 opacity-20 pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-0 mix-blend-multiply"></div>
            
            <div className="max-w-6xl mx-auto relative z-10">
                {activeSection === 'dashboard' && <AdminDashboard classes={classes} registrations={registrations} venues={venues} onNavigate={setActiveSection} onCopyInvite={handleCopyNextClassInvite} activeSection={activeSection} />}
                {activeSection === 'analytics' && <AdminAnalytics classes={classes} registrations={registrations} users={users} onShowToast={toast.showToast} />}
                {activeSection === 'classes' && <AdminClasses classes={classes} venues={venues} teachers={teachers} onAddClass={onAddClass} onEditClass={onEditClass} onDeleteClass={onDeleteClass} onShowToast={toast.showToast} currentUser={user} />}
                {activeSection === 'attendees' && <AdminAttendees classes={classes} registrations={registrations} onVerifyPayment={onVerifyPayment} />}
                {activeSection === 'crm' && (
                  <Suspense fallback={<div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6E7568]"></div></div>}>
                    <MarketingLazy 
                      currentUser={user} 
                      onShowToast={toast.showToast}
                      settings={settings}
                      templates={templates}
                      disclaimers={disclaimers}
                      venues={venues}
                      onUpdateSettings={onUpdateSettings}
                      onAddTemplate={onAddTemplate}
                      onUpdateTemplate={onUpdateTemplate}
                      onAddDisclaimer={onAddDisclaimer}
                      onUpdateDisclaimer={onUpdateDisclaimer}
                      onDeleteDisclaimer={onDeleteDisclaimer}
                      onPreviewLanding={onPreviewLanding}
                    />
                  </Suspense>
                )}
                {activeSection === 'messages' && (
                  <AdminChatView 
                    currentUser={user}
                    messages={chatMessages}
                    users={users}
                    onSendMessage={(content, recipientId) => onSendChatMessage?.(content, recipientId)}
                    selectedUserId={selectedChatUserId}
                    onSelectUser={setSelectedChatUserId}
                  />
                )}
                {activeSection === 'teachers' && (
                    <div className="space-y-8">
                        <AdminTeachers teachers={teachers} onAddTeacher={onAddTeacher} onEditTeacher={onEditTeacher} onDeleteTeacher={onDeleteTeacher} onShowToast={toast.showToast} />
                        <div className="border-t border-[#6E7568]/10 pt-8">
                            <h3 className="text-lg font-bold text-[#26150B] mb-4">Teacher Applications</h3>
                            <AdminTeacherApprovals onShowToast={toast.showToast} />
                        </div>
                    </div>
                )}
                {activeSection === 'venues' && <AdminVenues venues={venues} onAddVenue={onAddVenue} onEditVenue={onEditVenue} onDeleteVenue={onDeleteVenue} />}
                {activeSection === 'feedback' && <AdminFeedback classes={classes} />}
                {activeSection === 'settings' && (
                    <div className="animate-fade-in">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-[#26150B]/5 pb-4">
                            <div>
                                <h1 className="text-2xl md:text-3xl font-extrabold text-[#26150B] tracking-tight">Settings</h1>
                                <p className="text-sm text-[#6E7568] mt-1 font-medium">Application configuration</p>
                            </div>
                        </div>
                        
                        {/* Admin Management Section */}
                        {canManageAdmins && (
                            <div className="bg-white p-6 rounded-2xl border border-[#6E7568]/10 mb-6 shadow-sm">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-[#26150B] font-bold uppercase tracking-wider text-xs flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#6E7568]"></span> Admin Users
                                    </h3>
                                    <button 
                                        onClick={() => setShowAddAdminModal(true)}
                                        className="btn-primary rounded-xl py-2 px-4 text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:-translate-y-0.5 transition-all"
                                    >
                                        <Icons.PlusIcon size={14} /> Add Admin
                                    </button>
                                </div>
                                
                                <div className="space-y-3">
                                    {adminUsers.map(admin => {
                                        const permissions = ROLE_PERMISSIONS[admin.adminRole || 'admin'];
                                        return (
                                            <div key={admin.id} className="flex items-center justify-between p-4 bg-[#FBF7EF] rounded-xl border border-[#6E7568]/10 hover:border-[#6E7568]/20 transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-[#6E7568] flex items-center justify-center text-[#FBF7EF] font-bold text-sm">
                                                        {admin.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-[#26150B]">{admin.name}</p>
                                                        <p className="text-[10px] text-[#6E7568]">{admin.email}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                                        admin.adminRole === 'super_admin' ? 'bg-purple-100 text-purple-600' :
                                                        admin.adminRole === 'admin' ? 'bg-blue-100 text-blue-600' :
                                                        admin.adminRole === 'teacher' ? 'bg-green-100 text-green-600' :
                                                        'bg-gray-100 text-gray-600'
                                                    }`}>
                                                        {admin.adminRole || 'admin'}
                                                    </span>
                                                    {admin.id !== user.id && (
                                                        <button 
                                                            onClick={() => onRemoveAdmin?.(admin.id)}
                                                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                        >
                                                            <Icons.TrashIcon size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                
                                {/* Role Permissions Reference */}
                                <div className="mt-6 p-4 bg-[#FBF7EF]/50 rounded-xl border border-[#6E7568]/5">
                                    <h4 className="text-[10px] font-bold text-[#6E7568] uppercase tracking-wider mb-3">Role Permissions Reference</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[9px]">
                                        {Object.entries(ROLE_PERMISSIONS).map(([role, perms]) => (
                                            <div key={role} className="bg-white p-3 rounded-lg border border-[#6E7568]/10">
                                                <p className="font-bold text-[#26150B] uppercase mb-2">{role.replace('_', ' ')}</p>
                                                <div className="space-y-1 text-[#6E7568]">
                                                    <p className={perms.canManageClasses ? 'text-green-600' : 'text-red-400'}>
                                                        {perms.canManageClasses ? '✓' : '✗'} Classes
                                                    </p>
                                                    <p className={perms.canManageUsers ? 'text-green-600' : 'text-red-400'}>
                                                        {perms.canManageUsers ? '✓' : '✗'} Users
                                                    </p>
                                                    <p className={perms.canViewAnalytics ? 'text-green-600' : 'text-red-400'}>
                                                        {perms.canViewAnalytics ? '✓' : '✗'} Analytics
                                                    </p>
                                                    <p className={perms.canManageSettings ? 'text-green-600' : 'text-red-400'}>
                                                        {perms.canManageSettings ? '✓' : '✗'} Settings
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        
                         <div className="bg-white p-6 rounded-2xl border border-[#6E7568]/10 mb-6 shadow-sm">
                             <h3 className="text-[#26150B] font-bold mb-4 uppercase tracking-wider text-xs flex items-center gap-2">
                                 <span className="w-1.5 h-1.5 rounded-full bg-[#6E7568]"></span> Contact Emails
                             </h3>
                             <div className="space-y-3 mb-4">
                                 {/* Primary Contact Email */}
                                 <div className="flex items-center gap-3 p-3 bg-[#FBF7EF] rounded-xl border border-[#6E7568]/10">
                                     <div className="flex-1">
                                         <p className="text-[10px] text-[#6E7568] uppercase tracking-wider font-bold">Primary Email</p>
                                         <p className="text-sm text-[#26150B] font-medium">{settings.contactEmail}</p>
                                     </div>
                                     <Icons.MailIcon size={16} className="text-[#6E7568]" />
                                 </div>
                                 
                                 {/* Additional Contact Emails */}
                                 {(settings.additionalContactEmails || []).map((email, idx) => (
                                     <div key={idx} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[#6E7568]/10">
                                         <div className="flex-1">
                                             <p className="text-sm text-[#26150B] font-medium">{email}</p>
                                         </div>
                                         <button 
                                             onClick={() => {
                                                 const newEmails = (settings.additionalContactEmails || []).filter((_, i) => i !== idx);
                                                 onUpdateSettings({ ...settings, additionalContactEmails: newEmails });
                                             }}
                                             className="text-red-400 hover:text-red-600 p-1"
                                         >
                                             <Icons.XIcon size={14} />
                                         </button>
                                     </div>
                                 ))}
                                 
                                 {/* Add New Email */}
                                 <div className="flex gap-2">
                                     <input 
                                         type="email" 
                                         placeholder="Add another contact email..."
                                         className="flex-1 p-3 rounded-xl bg-white text-[#26150B] border border-[#6E7568]/10 text-sm"
                                         id="newContactEmail"
                                     />
                                     <button 
                                         onClick={() => {
                                             const input = document.getElementById('newContactEmail') as HTMLInputElement;
                                             if (input?.value && input.value.includes('@')) {
                                                 const newEmails = [...(settings.additionalContactEmails || []), input.value];
                                                 onUpdateSettings({ ...settings, additionalContactEmails: newEmails });
                                                 input.value = '';
                                             }
                                         }}
                                         className="px-4 py-2 bg-[#6E7568] text-[#FBF7EF] rounded-xl text-xs font-bold uppercase"
                                     >
                                         Add
                                     </button>
                                 </div>
                             </div>
                         </div>
                         
                         <div className="bg-white p-6 rounded-2xl border border-[#6E7568]/10 mb-6 shadow-sm">
                             <h3 className="text-[#26150B] font-bold mb-4 uppercase tracking-wider text-xs flex items-center gap-2">
                                 <span className="w-1.5 h-1.5 rounded-full bg-[#6E7568]"></span> Google Calendar Integration
                             </h3>
                             <div className="space-y-4">
                                 {/* Connection Status */}
                                 <div className="flex items-center justify-between p-4 bg-[#FBF7EF] rounded-xl border border-[#6E7568]/10">
                                     <div className="flex items-center gap-3">
                                         <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                                             <Icons.CalendarIcon size={20} className="text-[#6E7568]" />
                                         </div>
                                         <div>
                                             <h4 className="text-sm font-bold text-[#26150B]">Google Calendar</h4>
                                             <p className="text-xs text-[#6E7568]">Sync classes to your calendar</p>
                                         </div>
                                     </div>
                                      {settings.googleCalendarTokens ? (
                                          <span className="text-xs font-bold text-green-600 bg-green-100 px-3 py-1 rounded-full flex items-center gap-1">
                                              <Icons.CheckIcon size={12} /> Connected
                                          </span>
                                      ) : (
                                          <button 
                                              onClick={handleConnectCalendar}
                                              className="text-xs font-bold uppercase tracking-wider bg-[#6E7568] text-[#FBF7EF] px-4 py-2 rounded-lg hover:bg-[#5a6155] transition-colors shadow-sm"
                                          >
                                              Connect
                                          </button>
                                      )}
                                 </div>
                                 
                                 {/* Calendar ID */}
                                 {settings.googleCalendarTokens && (
                                     <>
                                         <div>
                                             <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider">Calendar ID</label>
                                             <input 
                                                 type="text" 
                                                 value={settings.googleCalendarId || ''}
                                                 onChange={(e) => onUpdateSettings({ ...settings, googleCalendarId: e.target.value })}
                                                 placeholder="e.g., your-email@gmail.com"
                                                 className="w-full p-3 rounded-xl bg-white text-[#26150B] border border-[#6E7568]/10 text-sm"
                                             />
                                             <p className="text-[10px] text-[#6E7568] mt-1">Enter your Google Calendar ID (usually your email)</p>
                                         </div>
                                         
                                         {/* Sync Toggle */}
                                         <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-[#6E7568]/10">
                                             <div>
                                                 <h4 className="text-sm font-bold text-[#26150B]">Auto-Sync Classes</h4>
                                                 <p className="text-xs text-[#6E7568]">Automatically add new classes to your calendar</p>
                                             </div>
                                             <button 
                                                 onClick={() => onUpdateSettings({ ...settings, googleCalendarSyncEnabled: !settings.googleCalendarSyncEnabled })}
                                                 className={`relative w-12 h-6 rounded-full transition-colors ${settings.googleCalendarSyncEnabled ? 'bg-[#6E7568]' : 'bg-[#6E7568]/20'}`}
                                             >
                                                 <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${settings.googleCalendarSyncEnabled ? 'left-7' : 'left-1'}`}></span>
                                             </button>
                                         </div>
                                         
                                         {/* Last Sync Time */}
                                         {settings.googleCalendarLastSync && (
                                             <div className="p-3 bg-green-50 rounded-xl border border-green-200">
                                                 <div className="flex items-center gap-2">
                                                     <Icons.CheckIcon size={14} className="text-green-600" />
                                                     <span className="text-xs font-bold text-green-800">
                                                         Last synced: {new Date(settings.googleCalendarLastSync).toLocaleString()}
                                                     </span>
                                                 </div>
                                             </div>
                                         )}
                                         
                                         {/* Disconnect Button */}
                                         <button 
                                             onClick={() => {
                                                 onUpdateSettings({ 
                                                     ...settings, 
                                                     googleCalendarTokens: undefined,
                                                     googleCalendarId: undefined,
                                                     googleCalendarSyncEnabled: false,
                                                     googleCalendarLastSync: undefined
                                                 });
                                                 toast.showToast('Google Calendar disconnected', 'info');
                                             }}
                                             className="text-xs font-bold text-red-500 hover:text-red-700 underline"
                                         >
                                             Disconnect Google Calendar
                                         </button>
                                     </>
                                 )}
                             </div>
                         </div>
                         
                         {/* Two-Factor Authentication Section */}
                         <div className="bg-white p-6 rounded-2xl border border-[#6E7568]/10 mb-6 shadow-sm">
                             <h3 className="text-[#26150B] font-bold mb-4 uppercase tracking-wider text-xs flex items-center gap-2">
                                 <span className="w-1.5 h-1.5 rounded-full bg-[#6E7568]"></span> Two-Factor Authentication
                             </h3>
                             <div className="flex items-center justify-between p-4 bg-[#FBF7EF] rounded-xl border border-[#6E7568]/10">
                                 <div className="flex items-center gap-3">
                                     <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                                         <Icons.ShieldIcon size={20} className="text-[#6E7568]" />
                                     </div>
                                     <div>
                                         <h4 className="text-sm font-bold text-[#26150B]">Authenticator App</h4>
                                         <p className="text-xs text-[#6E7568]">Add an extra layer of security to your account</p>
                                     </div>
                                 </div>
                                 {user.twoFactorEnabled ? (
                                     <span className="text-xs font-bold text-green-600 bg-green-100 px-3 py-1 rounded-full flex items-center gap-1">
                                         <Icons.CheckIcon size={12} /> Enabled
                                     </span>
                                 ) : (
                                     <button 
                                         onClick={() => setShow2FASetup(true)}
                                         className="text-xs font-bold uppercase tracking-wider bg-[#6E7568] text-[#FBF7EF] px-4 py-2 rounded-lg hover:bg-[#5a6155] transition-colors shadow-sm"
                                     >
                                         Setup 2FA
                                     </button>
                                 )}
                             </div>
                             {user.twoFactorEnabled && (
                                 <div className="mt-4 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                                     <div className="flex items-start gap-3">
                                         <Icons.AlertIcon size={16} className="text-yellow-600 mt-0.5" />
                                         <div>
                                             <p className="text-xs font-bold text-yellow-800">Two-factor authentication is enabled</p>
                                             <p className="text-[10px] text-yellow-700 mt-1">You'll need to enter a code from your authenticator app when signing in.</p>
                                         </div>
                                     </div>
                                     <button 
                                         onClick={() => {
                                             if (onUpdateUser) {
                                                 onUpdateUser({ ...user, twoFactorEnabled: false, twoFactorSecret: undefined, twoFactorBackupCodes: undefined });
                                                 toast.showToast('Two-factor authentication disabled', 'success');
                                             }
                                         }}
                                         className="mt-3 text-xs font-bold text-red-600 hover:text-red-700 underline"
                                     >
                                         Disable 2FA
                                     </button>
                                 </div>
                             )}
                         </div>

                          <div className="bg-white p-6 rounded-2xl border border-[#6E7568]/10 mb-6 shadow-sm">
                            <h3 className="text-[#26150B] font-bold mb-4 uppercase tracking-wider text-xs flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#6E7568]"></span> Previews
                            </h3>
                            <div className="flex gap-4">
                                <button onClick={onPreviewLanding} className="btn-primary rounded-xl py-3 px-6 text-xs font-bold uppercase tracking-wider">Preview Invite Page</button>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl border border-[#6E7568]/10 shadow-sm">
                            <h3 className="text-[#26150B] font-bold mb-4 uppercase tracking-wider text-xs flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#6E7568]"></span> Zapper QR Code
                            </h3>
                            <div className="mb-4">
                                {settings.zapperQrBase64 ? (
                                    <img src={settings.zapperQrBase64} alt="Zapper QR" className="w-32 h-32 max-w-full object-contain bg-[#FBF7EF] rounded-lg p-2" loading="lazy" />
                                ) : <div className="text-[#6E7568]/40 text-xs">No QR Code Uploaded</div>}
                            </div>
                            <input type="file" accept="image/*" onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                        onUpdateSettings({ ...settings, zapperQrBase64: reader.result as string });
                                    };
                                    reader.readAsDataURL(file);
                                }
                            }} className="text-[#6E7568] text-xs" />
                        </div>
                    </div>
                )}

            </div>
        </div>
      </main>
      
      {/* Add Admin Modal */}
      {showAddAdminModal && (
          <div className="fixed inset-0 bg-[#26150B]/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-300">
              <div className="bg-[#FBF7EF] border border-[#6E7568]/20 rounded-[2.5rem] p-8 sm:p-10 w-full max-w-md shadow-2xl relative">
                  <div className="flex justify-between items-center mb-8">
                      <h2 className="text-2xl font-extrabold text-[#26150B] tracking-tight">Add Admin User</h2>
                      <button onClick={() => setShowAddAdminModal(false)} className="text-[#26150B]/40 hover:text-[#26150B] hover:bg-[#26150B]/5 rounded-full p-2 transition-all"><Icons.XIcon /></button>
                  </div>
                  
                  <div className="space-y-6">
                      <div>
                          <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider pl-1">Name</label>
                          <input 
                              className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 focus:border-[#6E7568]/50 outline-none transition-all shadow-sm focus:shadow-md font-medium" 
                              value={newAdminName} 
                              onChange={e => setNewAdminName(e.target.value)} 
                              placeholder="Full name"
                          />
                      </div>
                      
                      <div>
                          <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider pl-1">Email</label>
                          <input 
                              type="email"
                              className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 focus:border-[#6E7568]/50 outline-none transition-all shadow-sm focus:shadow-md font-medium" 
                              value={newAdminEmail} 
                              onChange={e => setNewAdminEmail(e.target.value)} 
                              placeholder="email@example.com"
                          />
                      </div>
                      
                      <div>
                          <label className="text-xs font-bold text-[#6E7568] block mb-2 uppercase tracking-wider pl-1">Role</label>
                          <select 
                              className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 outline-none shadow-sm font-medium"
                              value={newAdminRole}
                              onChange={e => setNewAdminRole(e.target.value as AdminRole)}
                          >
                              <option value="super_admin">Super Admin (Full Access)</option>
                              <option value="admin">Admin (Standard)</option>
                              <option value="teacher">Teacher (Classes Only)</option>
                              <option value="staff">Staff (Limited)</option>
                          </select>
                      </div>
                      
                      <button 
                          onClick={() => {
                              if (newAdminEmail && newAdminName && onAddAdmin) {
                                  onAddAdmin(newAdminEmail, newAdminName, newAdminRole);
                                  setNewAdminEmail('');
                                  setNewAdminName('');
                                  setNewAdminRole('staff');
                                  setShowAddAdminModal(false);
                                  toast.showToast('Admin user added successfully!', 'success');
                              }
                          }}
                          disabled={!newAdminEmail || !newAdminName}
                          className="w-full btn-primary py-4 rounded-2xl font-bold text-sm tracking-widest uppercase mt-6 shadow-xl hover:scale-[1.02] transition-all bg-gradient-to-r from-[#6E7568] to-[#5a6155] text-[#FBF7EF] hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          Add Admin
                      </button>
                  </div>
              </div>
          </div>
      )}
      
      {/* 2FA Setup Modal */}
      {show2FASetup && (
          <div className="fixed inset-0 bg-[#26150B]/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-300">
              <div className="bg-[#FBF7EF] border border-[#6E7568]/20 rounded-[2.5rem] p-8 sm:p-10 w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                  <div className="flex justify-between items-center mb-8">
                      <h2 className="text-2xl font-extrabold text-[#26150B] tracking-tight">Setup Two-Factor Authentication</h2>
                      <button onClick={() => setShow2FASetup(false)} className="text-[#26150B]/40 hover:text-[#26150B] hover:bg-[#26150B]/5 rounded-full p-2 transition-all"><Icons.XIcon /></button>
                  </div>
                  
                  <div className="space-y-6">
                      {/* Step 1: Download authenticator app */}
                      <div className="p-4 bg-[#FBF7EF] rounded-xl border border-[#6E7568]/10">
                          <div className="flex items-center gap-3 mb-2">
                              <div className="w-6 h-6 rounded-full bg-[#6E7568] text-[#FBF7EF] flex items-center justify-center text-xs font-bold">1</div>
                              <h4 className="text-sm font-bold text-[#26150B]">Download an Authenticator App</h4>
                          </div>
                          <p className="text-xs text-[#6E7568] ml-9">Install Google Authenticator, Authy, or similar app on your phone.</p>
                      </div>
                      
                      {/* Step 2: Scan QR code */}
                      <div className="p-4 bg-[#FBF7EF] rounded-xl border border-[#6E7568]/10">
                          <div className="flex items-center gap-3 mb-3">
                              <div className="w-6 h-6 rounded-full bg-[#6E7568] text-[#FBF7EF] flex items-center justify-center text-xs font-bold">2</div>
                              <h4 className="text-sm font-bold text-[#26150B]">Scan QR Code</h4>
                          </div>
                          <div className="ml-9 flex flex-col items-center">
                              {/* Simulated QR Code - In production, generate actual QR */}
                              <div className="w-40 h-40 bg-white rounded-xl border-2 border-[#6E7568]/20 flex items-center justify-center mb-3 shadow-inner">
                                  <div className="text-center">
                                      <Icons.ShieldIcon size={48} className="text-[#6E7568] mx-auto mb-2" />
                                      <p className="text-[9px] text-[#6E7568]/60 font-mono">QR Code</p>
                                      <p className="text-[8px] text-[#6E7568]/40">(Demo Mode)</p>
                                  </div>
                              </div>
                              <p className="text-[10px] text-[#6E7568] text-center">Or enter this code manually:</p>
                              <code className="mt-1 px-3 py-1.5 bg-white rounded-lg text-xs font-mono text-[#26150B] border border-[#6E7568]/10">
                                  {twoFASecret || 'JBSWY3DPEHPK3PXP'}
                              </code>
                          </div>
                      </div>
                      
                      {/* Step 3: Enter verification code */}
                      <div className="p-4 bg-[#FBF7EF] rounded-xl border border-[#6E7568]/10">
                          <div className="flex items-center gap-3 mb-3">
                              <div className="w-6 h-6 rounded-full bg-[#6E7568] text-[#FBF7EF] flex items-center justify-center text-xs font-bold">3</div>
                              <h4 className="text-sm font-bold text-[#26150B]">Enter Verification Code</h4>
                          </div>
                          <div className="ml-9">
                              <input 
                                  type="text"
                                  maxLength={6}
                                  className="w-full p-4 rounded-xl bg-white text-[#26150B] border border-[#6E7568]/10 focus:border-[#6E7568]/50 outline-none transition-all shadow-sm text-center text-2xl font-mono tracking-widest"
                                  value={twoFACode}
                                  onChange={e => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                  placeholder="000000"
                              />
                              <p className="text-[10px] text-[#6E7568] mt-2">Enter the 6-digit code from your authenticator app</p>
                          </div>
                      </div>
                      
                      {/* Backup Codes Preview */}
                      {backupCodes.length > 0 && (
                          <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                              <h4 className="text-sm font-bold text-yellow-800 mb-2 flex items-center gap-2">
                                  <Icons.AlertIcon size={14} /> Save Your Backup Codes
                              </h4>
                              <p className="text-[10px] text-yellow-700 mb-3">Store these codes safely. You can use them to access your account if you lose your authenticator.</p>
                              <div className="grid grid-cols-2 gap-2">
                                  {backupCodes.map((code, i) => (
                                      <code key={i} className="px-2 py-1 bg-white rounded text-xs font-mono text-[#26150B] border border-yellow-200">
                                          {code}
                                      </code>
                                  ))}
                              </div>
                          </div>
                      )}
                      
                      <button 
                          onClick={() => {
                              // In production, verify the TOTP code
                              if (twoFACode.length === 6 && onUpdateUser) {
                                  // Generate backup codes
                                  const newBackupCodes = Array.from({ length: 8 }, () => 
                                      Math.random().toString(36).substring(2, 8).toUpperCase()
                                  );
                                  setBackupCodes(newBackupCodes);
                                  
                                  onUpdateUser({ 
                                      ...user, 
                                      twoFactorEnabled: true, 
                                      twoFactorSecret: twoFASecret || 'JBSWY3DPEHPK3PXP',
                                      twoFactorBackupCodes: newBackupCodes
                                  });
                                  toast.showToast('Two-factor authentication enabled!', 'success');
                                  setShow2FASetup(false);
                                  setTwoFACode('');
                              }
                          }}
                          disabled={twoFACode.length !== 6}
                          className="w-full btn-primary py-4 rounded-2xl font-bold text-sm tracking-widest uppercase mt-6 shadow-xl hover:scale-[1.02] transition-all bg-gradient-to-r from-[#6E7568] to-[#5a6155] text-[#FBF7EF] hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          Verify & Enable 2FA
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

