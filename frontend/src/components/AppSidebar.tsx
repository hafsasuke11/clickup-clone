import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ListTodo, Calendar, LayoutDashboard, Kanban, FolderKanban, Users, UserPlus, LogOut, ChevronLeft, ChevronRight, ChevronDown, Check, Plus } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useUiStore } from '@/store/uiStore';
import { initialsOf, colorFor } from '@/utils/avatarHelpers';

const NAV_ITEMS = [
  { to: '/app/list', label: 'List', icon: ListTodo },
  { to: '/app/calendar', label: 'Calendar', icon: Calendar },
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/board', label: 'Board', icon: Kanban },
  { to: '/app/projects', label: 'Projects', icon: FolderKanban },
  { to: '/app/users', label: 'Users', icon: Users },
];

export default function AppSidebar() {
  const navigate = useNavigate();
  const { user, logout, knownAccounts, switchAccount, beginAddAccount } = useAuthStore();
  const { workspace, workspaces, switchWorkspace, members } = useWorkspaceStore();
  const { setInviteModalOpen, sidebarOpen, toggleSidebar } = useUiStore();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const hasMultipleWorkspaces = workspaces.length > 1;

  const otherAccounts = knownAccounts.filter((a) => a.id !== user?.id);

  const handleAddAccount = () => {
    setAccountMenuOpen(false);
    beginAddAccount();
    navigate('/login');
  };

  return (
    <aside className={`shrink-0 bg-sidebar border-r border-border flex flex-col h-full transition-all duration-200 ${sidebarOpen ? 'w-64' : 'w-[68px]'}`}>
      {/* Workspace header */}
      <div className={`relative border-b border-border shrink-0 ${sidebarOpen ? '' : 'flex justify-center'}`}>
        <button
          onClick={() => hasMultipleWorkspaces && setSwitcherOpen((v) => !v)}
          className={`flex items-center h-16 w-full transition-colors ${hasMultipleWorkspaces ? 'hover:bg-black/[0.03] cursor-pointer' : 'cursor-default'} ${sidebarOpen ? 'gap-2.5 px-4' : 'justify-center px-2'}`}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ background: 'linear-gradient(135deg, #6D4FE0 0%, #EE46BC 100%)' }}>
            {(workspace?.name ?? 'C')[0].toUpperCase()}
          </div>
          {sidebarOpen && (
            <>
              <span className="text-sm font-semibold text-text-primary truncate flex-1 text-left">{workspace?.name ?? 'Workspace'}</span>
              {hasMultipleWorkspaces && <ChevronDown size={14} className={`text-text-secondary shrink-0 transition-transform ${switcherOpen ? 'rotate-180' : ''}`} />}
            </>
          )}
        </button>

        {switcherOpen && hasMultipleWorkspaces && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setSwitcherOpen(false)} />
            <div className={`absolute top-full mt-1 z-50 bg-surface border border-border rounded-xl shadow-xl py-1 ${sidebarOpen ? 'left-4 right-4' : 'left-2 w-56'}`}>
              <p className="px-3 py-1.5 text-[10px] font-semibold text-text-disabled uppercase tracking-wider">Your workspaces</p>
              {workspaces.map((w) => (
                <button
                  key={w.id}
                  onClick={() => { void switchWorkspace(w.id); setSwitcherOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:bg-black/[0.03] ${w.id === workspace?.id ? 'text-accent-purple' : 'text-text-primary'}`}
                >
                  <div className="w-5 h-5 rounded flex items-center justify-center text-white font-bold text-[10px] shrink-0" style={{ background: 'linear-gradient(135deg, #6D4FE0 0%, #EE46BC 100%)' }}>
                    {w.name[0]?.toUpperCase()}
                  </div>
                  <span className="truncate flex-1">{w.name}</span>
                  {w.id === workspace?.id && <Check size={13} className="shrink-0" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Collapse/expand toggle */}
      <button
        onClick={toggleSidebar}
        title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        className={`flex items-center gap-2 text-text-secondary hover:text-text-primary hover:bg-black/[0.03] transition-colors border-b border-border py-2 shrink-0 ${
          sidebarOpen ? 'justify-end px-4' : 'justify-center px-2'
        }`}
      >
        {sidebarOpen ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
      </button>

      {/* Nav */}
      <nav className={`flex-1 overflow-y-auto py-4 space-y-1 ${sidebarOpen ? 'px-3' : 'px-2'}`}>
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={sidebarOpen ? undefined : label}
            className={({ isActive }) =>
              `flex items-center gap-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${sidebarOpen ? 'px-3' : 'px-0 justify-center'} ${
                isActive ? 'bg-accent-purple/10 text-accent-purple' : 'text-text-secondary hover:text-text-primary hover:bg-black/[0.03]'
              }`
            }
          >
            <Icon size={16} className="shrink-0" />
            {sidebarOpen && label}
          </NavLink>
        ))}

        {/* Members */}
        <div className="pt-6">
          {sidebarOpen ? (
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-xs font-semibold text-text-disabled uppercase tracking-wider">Members</span>
              <button onClick={() => setInviteModalOpen(true)} className="text-text-secondary hover:text-accent-purple transition-colors" title="Invite member">
                <UserPlus size={14} />
              </button>
            </div>
          ) : (
            <div className="flex justify-center mb-2">
              <button onClick={() => setInviteModalOpen(true)} className="text-text-secondary hover:text-accent-purple transition-colors" title="Invite member">
                <UserPlus size={15} />
              </button>
            </div>
          )}
          <div className={`space-y-1 ${sidebarOpen ? '' : 'flex flex-col items-center'}`}>
            {members.map((m) => (
              <div key={m.userId} className={`flex items-center gap-2.5 py-1.5 ${sidebarOpen ? 'px-3' : 'px-0'}`} title={sidebarOpen ? undefined : (m.user?.fullName ?? 'Unknown')}>
                <div className={`w-6 h-6 rounded-full ${colorFor(m.userId)} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}>
                  {m.user ? initialsOf(m.user.fullName) : '?'}
                </div>
                {sidebarOpen && (
                  <>
                    <span className="text-xs text-text-secondary truncate">{m.user?.fullName ?? 'Unknown'}</span>
                    {m.role === 'owner' && <span className="text-[9px] text-text-disabled uppercase ml-auto shrink-0">Owner</span>}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </nav>

      {/* User / account menu */}
      <div className="relative border-t border-border shrink-0">
        <div className={`p-3 flex items-center ${sidebarOpen ? 'gap-2.5' : 'flex-col gap-2'}`}>
          <button
            onClick={() => setAccountMenuOpen((v) => !v)}
            className={`flex items-center min-w-0 flex-1 rounded-lg transition-colors hover:bg-black/[0.03] ${sidebarOpen ? 'gap-2.5 p-1 -m-1' : 'justify-center'}`}
            title={sidebarOpen ? undefined : user?.fullName}
          >
            <div className="w-8 h-8 rounded-full bg-accent-purple flex items-center justify-center text-xs font-bold text-white shrink-0">
              {user ? initialsOf(user.fullName) : ''}
            </div>
            {sidebarOpen && (
              <div className="min-w-0 flex-1 text-left">
                <p className="text-xs font-medium text-text-primary truncate">{user?.fullName}</p>
                <p className="text-[11px] text-text-disabled truncate">{user?.email}</p>
              </div>
            )}
            {sidebarOpen && <ChevronDown size={14} className={`text-text-secondary shrink-0 transition-transform ${accountMenuOpen ? 'rotate-180' : ''}`} />}
          </button>
          {!sidebarOpen && (
            <button onClick={logout} className="text-text-secondary hover:text-accent-red transition-colors shrink-0" title="Sign out">
              <LogOut size={15} />
            </button>
          )}
        </div>

        {accountMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setAccountMenuOpen(false)} />
            <div className={`absolute bottom-full mb-1 z-50 bg-surface border border-border rounded-xl shadow-xl py-1 ${sidebarOpen ? 'left-3 right-3' : 'left-2 w-60'}`}>
              {otherAccounts.length > 0 && (
                <>
                  <p className="px-3 py-1.5 text-[10px] font-semibold text-text-disabled uppercase tracking-wider">Switch account</p>
                  {otherAccounts.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => { switchAccount(a.id); setAccountMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:bg-black/[0.03]"
                    >
                      <div className={`w-6 h-6 rounded-full ${colorFor(a.id)} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}>
                        {initialsOf(a.fullName)}
                      </div>
                      <span className="min-w-0 flex-1">
                        <span className="block text-text-primary truncate">{a.fullName}</span>
                        <span className="block text-[11px] text-text-disabled truncate">{a.email}</span>
                      </span>
                    </button>
                  ))}
                  <div className="my-1 border-t border-border" />
                </>
              )}
              <button
                onClick={handleAddAccount}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-text-primary transition-colors hover:bg-black/[0.03]"
              >
                <span className="w-6 h-6 rounded-full border border-dashed border-border flex items-center justify-center shrink-0">
                  <Plus size={13} className="text-text-secondary" />
                </span>
                Add another account
              </button>
              <button
                onClick={() => { setAccountMenuOpen(false); logout(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-accent-red transition-colors hover:bg-black/[0.03]"
              >
                <span className="w-6 h-6 flex items-center justify-center shrink-0">
                  <LogOut size={14} />
                </span>
                Sign out{otherAccounts.length > 0 && user ? ` (${user.fullName})` : ''}
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
