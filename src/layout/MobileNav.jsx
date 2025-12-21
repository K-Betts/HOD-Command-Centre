import React from 'react';
import {
  Menu,
} from 'lucide-react';
import { getMobileNavPrimaryItems, getMobileNavMoreItems } from '../config/navigationConfig';

export function MobileNav({ activeTab, onChange, waitingCount = 0 }) {
  const [showMenu, setShowMenu] = React.useState(false);

  const mainNavItems = getMobileNavPrimaryItems().map(item => ({
    ...item,
    badge: item.id === 'tasks' ? waitingCount : undefined,
  }));

  const moreNavItems = getMobileNavMoreItems();

  const handleNavClick = (id) => {
    onChange?.(id);
    setShowMenu(false);
  };

  return (
    <>
      {/* Mobile Bottom Navigation - visible only on small screens */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 safe-area-inset-bottom">
        <div className="flex items-center justify-between h-16 px-2">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`flex flex-col items-center justify-center flex-1 h-16 gap-1 transition-colors relative ${
                  isActive ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
                }`}
                aria-label={`Navigate to ${item.label}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <div className="relative">
                  <Icon size={20} />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium truncate px-1">{item.label}</span>
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
                )}
              </button>
            );
          })}

          {/* More Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className={`flex flex-col items-center justify-center flex-1 h-16 gap-1 transition-colors ${
                showMenu ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
              aria-label={showMenu ? 'Close more menu' : 'Open more menu'}
              aria-haspopup="true"
              aria-expanded={showMenu}
            >
              <Menu size={20} />
              <span className="text-[10px] font-medium">More</span>
            </button>

            {/* More Menu Dropdown */}
            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute bottom-16 right-0 bg-white rounded-2xl shadow-lg border border-slate-200 z-40 min-w-[180px] overflow-hidden">
                  {moreNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className={`w-full px-4 py-3 flex items-center gap-3 text-left border-b border-slate-100 last:border-b-0 transition-colors ${
                          isActive
                            ? 'bg-slate-100 text-slate-900 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                        aria-label={`Navigate to ${item.label}`}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <Icon size={18} className="flex-shrink-0" />
                        <span className="text-sm">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Padding for bottom navigation on mobile */}
      <div className="lg:hidden h-16" />
    </>
  );
}
