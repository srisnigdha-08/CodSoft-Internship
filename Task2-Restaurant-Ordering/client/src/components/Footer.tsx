import React from 'react';
import { UtensilsCrossed, Phone, Mail, MapPin, Clock, ShieldCheck, Heart } from 'lucide-react';

interface FooterProps {
  onNavigate: (page: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-charcoal-950 text-stone-300 pt-16 pb-12 border-t border-charcoal-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-stone-800">
          {/* Brand & Story */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onNavigate('home')}>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-terracotta-600 to-amber-600 flex items-center justify-center text-white">
                <UtensilsCrossed className="w-5 h-5" />
              </div>
              <span className="font-display text-2xl font-bold text-white tracking-tight">DineDesk</span>
            </div>
            <p className="text-sm text-stone-400 leading-relaxed">
              A contemporary restaurant ordering & dining platform bringing culinary excellence, digital ordering, and seamless kitchen operations under one roof.
            </p>
            <div className="flex items-center space-x-2 text-xs text-amber-500 font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>CodSoft Task 2 — Full Stack Web Development</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="font-display text-base font-semibold text-white tracking-wide">Quick Navigation</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <button onClick={() => onNavigate('home')} className="hover:text-terracotta-400 transition-colors">
                  Home Overview
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('menu')} className="hover:text-terracotta-400 transition-colors">
                  Digital Menu & Ordering
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('reserve')} className="hover:text-terracotta-400 transition-colors">
                  Table Reservations
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('orders')} className="hover:text-terracotta-400 transition-colors">
                  Live Order Tracking
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('kitchen')} className="text-amber-400 hover:text-amber-300 transition-colors">
                  Kitchen Display System (KDS)
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('admin')} className="text-stone-400 hover:text-white transition-colors">
                  Admin Control Center
                </button>
              </li>
            </ul>
          </div>

          {/* Opening Hours */}
          <div className="space-y-3">
            <h4 className="font-display text-base font-semibold text-white tracking-wide">Dining Hours</h4>
            <div className="space-y-2 text-sm text-stone-400">
              <div className="flex items-start space-x-2">
                <Clock className="w-4 h-4 text-terracotta-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-stone-200">Monday – Thursday</p>
                  <p className="text-xs">12:00 PM – 10:30 PM</p>
                </div>
              </div>
              <div className="flex items-start space-x-2 pt-1">
                <Clock className="w-4 h-4 text-terracotta-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-stone-200">Friday – Sunday</p>
                  <p className="text-xs">11:30 AM – 11:30 PM (Continuous)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-3">
            <h4 className="font-display text-base font-semibold text-white tracking-wide">Contact & Location</h4>
            <div className="space-y-2.5 text-sm text-stone-400">
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-terracotta-500 flex-shrink-0" />
                <span>42 Heritage Boulevard, Gourmet Quarter</span>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-terracotta-500 flex-shrink-0" />
                <span>+91 98765 43210</span>
              </div>
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-terracotta-500 flex-shrink-0" />
                <span>reservations@dinedesk.local</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500 space-y-4 sm:space-y-0">
          <p>© 2026 DineDesk Restaurant Platform. Built with React, TypeScript, Node.js & PostgreSQL.</p>
          <div className="flex items-center space-x-1">
            <span>Crafted for CodSoft Internship with</span>
            <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500 inline" />
          </div>
        </div>
      </div>
    </footer>
  );
};
