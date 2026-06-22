'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Bell, Check, Circle } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';

import { useRouter } from 'next/navigation';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsDropdown({ user }: { user: SupabaseUser | null }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    // Fetch initial notifications
    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    };

    fetchNotifications();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase]);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notification: Notification) => {
    setIsOpen(false);
    
    if (!notification.is_read) {
      // Optimistic UI update
      setNotifications(prev => 
        prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));

      // Database update
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notification.id);
    }

    router.push(notification.link);
  };

  const markAllAsRead = async () => {
    if (unreadCount === 0) return;
    
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user?.id)
      .eq('is_read', false);
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
        aria-label="Benachrichtigungen"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-background animate-pulse" />
        )}
      </button>

      {isOpen && (
        <div className="yoriax-card absolute right-0 z-[100] mt-2 w-80 overflow-hidden rounded-2xl md:w-96">
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/20">
            <h3 className="font-bold text-white">Benachrichtigungen</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-xs text-primary-light transition-colors hover:text-white"
              >
                <Check className="w-3 h-3" />
                Alle als gelesen markieren
              </button>
            )}
          </div>
          
          <div className="max-h-[400px] overflow-y-auto overscroll-contain no-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-white/40 flex flex-col items-center">
                <Bell className="w-8 h-8 mb-3 opacity-20" />
                <p>Du bist auf dem neuesten Stand.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full text-left p-4 flex gap-3 transition-colors ${
                      notification.is_read 
                        ? 'hover:bg-white/5' 
                        : 'bg-primary/10 hover:bg-primary/15'
                    }`}
                  >
                    <div className="flex-shrink-0 mt-1">
                      {notification.is_read ? (
                        <Circle className="w-2 h-2 text-white/20 fill-white/20" />
                      ) : (
                        <Circle className="w-2 h-2 fill-primary-light text-primary-light" />
                      )}
                    </div>
                    <div>
                      <p className={`text-sm ${notification.is_read ? 'text-white/60' : 'text-white font-medium'}`}>
                        <span className="block font-bold text-xs text-white/40 mb-0.5">{notification.title}</span>
                        {notification.message}
                      </p>
                      <span className="text-[10px] text-white/30 mt-2 block">
                        {new Date(notification.created_at).toLocaleString('de-DE', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
