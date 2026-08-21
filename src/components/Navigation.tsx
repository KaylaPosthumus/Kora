import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import KoraBtn from "./buttons/KoraBtn";
import { Icons } from "../constants/icons";
import { logout, navbarUserStatus } from "../services/authService";
import logo from "../assets/logos/cori_logo_green.png";

import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";

/**
 * Navigation renders three shells over one set of links.
 *
 * Desktop (lg and up) keeps the fixed sidebar the app has always had. Below that
 * the sidebar is gone — 296px of permanent chrome is most of a phone — and is
 * replaced by a top bar with a slide-over drawer. Employees additionally get a
 * bottom nav, because they are the ones actually on a phone and their four
 * destinations fit the pattern exactly; admins reach their six links through the
 * drawer.
 *
 * The links are data rather than markup so the three shells cannot drift apart.
 */

type NavLink = {
  to: string;
  label: string;
  /** Absent for the auth links, which render as plain text like before. */
  icon?: React.ElementType;
  /** Shown in the employee bottom nav. */
  primary?: boolean;
  /** Shorter label for the bottom nav, where width is tight. */
  shortLabel?: string;
};

type NavGroup = { heading?: string; links: NavLink[] };

const authGroup: NavGroup = {
  heading: "Authentication",
  links: [
    { to: "/", label: "Login" },
    { to: "/employee/signup", label: "Employee Sign Up" },
    { to: "/admin/signup", label: "Admin Sign Up" },
  ],
};

const employeeGroup: NavGroup = {
  links: [
    { to: "/employee/home", label: "Home", icon: Icons.Home, primary: true },
    {
      to: "/employee/leave-overview",
      label: "My Leave",
      shortLabel: "Leave",
      icon: Icons.EventNote,
      primary: true,
    },
    {
      to: "/employee/meetings",
      label: "My Meetings",
      shortLabel: "Meetings",
      icon: Icons.MeetingRoom,
      primary: true,
    },
    { to: "/employee/profile", label: "Profile", icon: Icons.AccountCircle, primary: true },
  ],
};

const adminGroup: NavGroup = {
  links: [
    { to: "/admin/dashboard", label: "Dashboard", icon: Icons.Dashboard },
    { to: "/admin/employees", label: "Employees", icon: Icons.Group },
    { to: "/admin/create-employee", label: "Create Employee", icon: Icons.PersonAddAlt },
    { to: "/admin/equipment", label: "Equipment", icon: Icons.Construction },
    { to: "/admin/leave-requests", label: "Leave Requests", icon: Icons.Assignment },
    { to: "/admin/meetings", label: "Meetings", icon: Icons.MeetingRoom },
  ],
};

const referenceGroup: NavGroup = {
  heading: "Reference",
  links: [
    { to: "/reference", label: "Custom Stuffies" },
    { to: "/temp-modals/leave-overview", label: "Modals: Leave Overv" },
    { to: "/temp-modals/admin-dash", label: "Modals: Admin Dash" },
    { to: "/apiplayground", label: "API Playground - do not remove" },
    { to: "/temp-new-gathering-box", label: "New Meeting / Gathering Box" },
  ],
};

const Navigation: React.FC = () => {
  const [userStatus, setUserStatus] = useState<number | null>(null); // -1, 0, 1, 2
  const [devMode] = useState<boolean>(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  const isActiveLink = (path: string) => location.pathname === path;

  const getLinkClassName = (path: string, hasIcon = true) => {
    const baseClasses = hasIcon
      ? "nav-link flex items-center gap-2 hover:text-sakura-300"
      : "nav-link";
    return isActiveLink(path)
      ? `${baseClasses} text-sakura-500 font-semibold focus:text-sakura-500`
      : `${baseClasses} text-white font-light focus:text-white`;
  };

  useEffect(() => {
    const checkStatus = async () => {
      const status = await navbarUserStatus();
      setUserStatus(status);
    };
    checkStatus();
  }, []);

  // Tapping a link navigates; leaving the drawer open over the new page would
  // hide it.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // A drawer that traps the page behind it should close on Escape, and the page
  // behind it should not scroll while it is open.
  useEffect(() => {
    if (!drawerOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  const groups: NavGroup[] = [];
  if (userStatus === -1 || userStatus === 0) groups.push(authGroup);
  if (userStatus === 1) groups.push(employeeGroup);
  if (userStatus === 2) groups.push(adminGroup);
  if (devMode) groups.push(referenceGroup);

  const primaryLinks = groups.flatMap((group) => group.links.filter((link) => link.primary));

  /** The link list, shared by the sidebar and the drawer. */
  const renderGroups = () => (
    <div className="flex flex-col">
      {groups.map((group, index) => (
        <div key={group.heading ?? index} className="mt-4 flex flex-col gap-4">
          {group.heading && (
            <small className="text-corigreen-500 text-uppercase">{group.heading}</small>
          )}
          {group.links.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={getLinkClassName(to, Boolean(Icon))}
              aria-current={isActiveLink(to) ? "page" : undefined}
            >
              {Icon && <Icon fontSize="small" />}
              {label}
            </Link>
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — unchanged from the original layout. */}
      <div className="hidden lg:block w-[296px] flex-shrink-0 z-10">
        <div className="fixed top-4 left-4 bg-zinc-900 text-white w-[260px] rounded-3xl h-[calc(100vh-32px)] overflow-hidden">
          <div className="p-10 h-full overflow-y-auto flex flex-col justify-between">
            <div className="flex flex-col">
              <img src={logo} alt="Kora" className="mb-4 w-full" />
              {renderGroups()}
            </div>

            <KoraBtn style="black" className="w-full" onClick={logout}>
              Logout
            </KoraBtn>
          </div>
        </div>
      </div>

      {/* Mobile top bar. */}
      <header className="lg:hidden fixed top-0 inset-x-0 h-14 z-30 bg-zinc-900 text-white flex items-center justify-between px-4">
        <img src={logo} alt="Kora" className="h-7 w-auto" />
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          className="p-2 -mr-2 text-white"
        >
          <MenuRoundedIcon />
        </button>
      </header>

      {/* Mobile drawer. */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-zinc-900 text-white flex flex-col"
          >
            <div className="flex items-center justify-between p-4">
              <img src={logo} alt="Kora" className="h-7 w-auto" />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="p-2 -mr-2 text-white"
              >
                <CloseRoundedIcon />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6">{renderGroups()}</div>

            <div className="p-6 pt-0">
              <KoraBtn style="black" className="w-full" onClick={logout}>
                Logout
              </KoraBtn>
            </div>
          </div>
        </div>
      )}

      {/* Employee bottom nav. Sits above the home indicator on iOS. */}
      {primaryLinks.length > 0 && (
        <nav
          aria-label="Primary"
          className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-zinc-900 text-white flex justify-around pb-[env(safe-area-inset-bottom)]"
        >
          {primaryLinks.map(({ to, label, shortLabel, icon: Icon }) => {
            const active = isActiveLink(to);
            return (
              <Link
                key={to}
                to={to}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={`flex flex-1 flex-col items-center gap-1 py-2 text-[11px] ${
                  active ? "text-sakura-500 font-semibold" : "text-white font-light"
                }`}
              >
                {Icon && <Icon fontSize="small" />}
                {shortLabel ?? label}
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
};

export default Navigation;
