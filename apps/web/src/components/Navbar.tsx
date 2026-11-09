import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Mic, History, Sparkles, LogOut, LogIn, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const Navbar: React.FC = () => {
  const { user, isDemo, signOut, signInAsDemo } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 font-bold text-xl text-slate-900 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
            <Mic className="w-5 h-5" />
          </div>
          <span className="tracking-tight">
            Speak<span className="text-sky-600">Sharp</span>
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-1 sm:gap-2">
          <Link
            to="/practice"
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
              isActive('/practice')
                ? 'bg-sky-50 text-sky-700'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Mic className="w-4 h-4" />
            Practice
          </Link>
          <Link
            to="/history"
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
              isActive('/history')
                ? 'bg-sky-50 text-sky-700'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <History className="w-4 h-4" />
            History
          </Link>
        </nav>

        {/* User state / Auth actions */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2.5">
              {isDemo ? (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 flex items-center gap-1 border border-amber-200">
                  <Sparkles className="w-3 h-3" /> Demo Mode
                </span>
              ) : (
                <span className="text-xs text-slate-500 font-medium truncate max-w-[140px]">
                  {user.email || 'Speaker'}
                </span>
              )}
              <button
                onClick={() => signOut()}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => signInAsDemo()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-sky-600 text-white hover:bg-sky-700 transition-colors shadow-sm"
            >
              <LogIn className="w-3.5 h-3.5" />
              Try Demo
            </button>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-slate-600 hover:text-slate-900"
          aria-label="Toggle mobile menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white px-4 pt-2 pb-4 space-y-2">
          <Link
            to="/practice"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-medium text-slate-700 hover:bg-slate-50"
          >
            Practice
          </Link>
          <Link
            to="/history"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-medium text-slate-700 hover:bg-slate-50"
          >
            History
          </Link>
          {user ? (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {isDemo ? 'Demo Mode' : user.email || 'Speaker'}
              </span>
              <button
                onClick={() => {
                  signOut();
                  setMobileMenuOpen(false);
                }}
                className="text-xs text-red-600 font-medium py-1 px-2"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                signInAsDemo();
                setMobileMenuOpen(false);
              }}
              className="w-full text-center mt-2 py-2 rounded-lg bg-sky-600 text-white text-sm font-semibold"
            >
              Try Demo Now
            </button>
          )}
        </div>
      )}
    </header>
  );
};

