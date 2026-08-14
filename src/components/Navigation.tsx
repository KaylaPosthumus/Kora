import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import CoriBtn from "./buttons/CoriBtn";
import { Icons } from "../constants/icons";
import { logout, navbarUserStatus } from "../services/authService";
import logo from "../assets/logos/cori_logo_green.png";

// MUI Icons:
import LoginIcon from "@mui/icons-material/Login";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import HomeIcon from "@mui/icons-material/Home";
import EventNoteIcon from "@mui/icons-material/EventNote";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import GroupsIcon from "@mui/icons-material/Groups";
import BuildIcon from "@mui/icons-material/Build";
import AssignmentIcon from "@mui/icons-material/Assignment";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import CodeIcon from "@mui/icons-material/Code";
import ApiIcon from "@mui/icons-material/Api";
import PersonAddAltIcon from "@mui/icons-material/PersonAddAlt";

const Navigation: React.FC = () => {
  const [userStatus, setUserStatus] = useState<number | null>(null); // -1, 0, 1, 2
  const [devMode, setDevMode] = useState<boolean>(false);
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

  return (
    <div className="w-[296px] flex-shrink-0 z-10">
      {/* Sidebar */}
      <div className="fixed top-4 left-4 bg-zinc-900 text-white w-[260px] rounded-3xl h-[calc(100vh-32px)] overflow-hidden">
        <div className="p-10 h-full overflow-y-auto flex flex-col justify-between">
          <div className="flex flex-col">
            <img src={logo} alt="Coriander" className="mb-4 w-full" />
            {/* Auth Links */}
            {userStatus === -1 || userStatus === 0 ? (
              <div className="mt-4 flex flex-col gap-4">
                <small className="text-corigreen-500 text-uppercase">Authentication</small>
                <Link to="/" className={getLinkClassName("/", false)}>
                  Login
                </Link>
                <Link to="/employee/signup" className={getLinkClassName("/employee/signup", false)}>
                  Employee Sign Up
                </Link>
                <Link to="/admin/signup" className={getLinkClassName("/admin/signup", false)}>
                  Admin Sign Up
                </Link>
              </div>
            ) : null}

            {/* Employee Links */}
            {userStatus === 1 && (
              <div className="flex flex-col gap-4 mt-4">
                <Link to="/employee/home" className={getLinkClassName("/employee/home")}>
                  <Icons.Home fontSize="small" />
                  Home
                </Link>

                <Link
                  to="/employee/leave-overview"
                  className={getLinkClassName("/employee/leave-overview")}
                >
                  <Icons.EventNote fontSize="small" />
                  My Leave
                </Link>

                <Link to="/employee/meetings" className={getLinkClassName("/employee/meetings")}>
                  <Icons.MeetingRoom fontSize="small" />
                  My Meetings
                </Link>

                <Link to="/employee/profile" className={getLinkClassName("/employee/profile")}>
                  <Icons.AccountCircle fontSize="small" />
                  Profile
                </Link>
              </div>
            )}

            {/* Admin Links */}
            {userStatus === 2 && (
              <div className="mb-4 flex flex-col gap-4">
                <Link to="/admin/dashboard" className={getLinkClassName("/admin/dashboard")}>
                  <Icons.Dashboard fontSize="small" />
                  Dashboard
                </Link>

                <Link to="/admin/employees" className={getLinkClassName("/admin/employees")}>
                  <Icons.Group fontSize="small" />
                  Employees
                </Link>

                <Link
                  to="/admin/create-employee"
                  className={getLinkClassName("/admin/create-employee")}
                >
                  <Icons.PersonAddAlt fontSize="small" />
                  Create Employee
                </Link>

                <Link to="/admin/equipment" className={getLinkClassName("/admin/equipment")}>
                  <Icons.Construction fontSize="small" />
                  Equipment
                </Link>

                <Link
                  to="/admin/leave-requests"
                  className={getLinkClassName("/admin/leave-requests")}
                >
                  <Icons.Assignment fontSize="small" />
                  Leave Requests
                </Link>

                <Link to="/admin/meetings" className={getLinkClassName("/admin/meetings")}>
                  <Icons.MeetingRoom fontSize="small" />
                  Meetings
                </Link>
                {/* <Link to="/admin/individual-employee" className="nav-link text-white">
              Individual Employee
            </Link> */}
              </div>
            )}

            {/* Reference links only if dev mode is enabled */}
            {devMode && (
              <div className="mt-4">
                <small className="text-corigreen-500 text-uppercase">Reference</small>
                <Link to="/reference" className={getLinkClassName("/reference", false)}>
                  Custom Stuffies
                </Link>
                <Link
                  to="/temp-modals/leave-overview"
                  className={getLinkClassName("/temp-modals/leave-overview", false)}
                >
                  Modals: Leave Overv
                </Link>
                <Link
                  to="/temp-modals/admin-dash"
                  className={getLinkClassName("/temp-modals/admin-dash", false)}
                >
                  Modals: Admin Dash
                </Link>
                <Link to="/apiplayground" className={getLinkClassName("/apiplayground", false)}>
                  API Playground - do not remove
                </Link>
                <Link
                  to="/temp-new-gathering-box"
                  className={getLinkClassName("/temp-new-gathering-box", false)}
                >
                  New Meeting / Gathering Box
                </Link>
              </div>
            )}
          </div>

          <CoriBtn style="black" className="w-full" onClick={logout}>
            Logout
          </CoriBtn>
        </div>
      </div>
    </div>
  );
};

export default Navigation;
