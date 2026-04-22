import { Link, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { LogOut, Activity, Users, Moon, Sun, Globe } from "lucide-react";
import { useI18n } from "./I18nProvider";
import { useState, useEffect } from "react";

export default function Navbar() {
  const { user, role, logOut } = useAuth();
  const location = useLocation();
  const { lang, toggleLang, t } = useI18n();
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  return (
    <nav className="w-full max-w-7xl mx-auto bg-white/40 dark:bg-slate-900/40 backdrop-blur-[15px] border border-white/30 dark:border-white/10 rounded-[20px] flex items-center px-6 h-[60px] justify-between shadow-sm sticky top-0 z-50">
      <div className="flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-white/50 dark:bg-white/10 flex items-center justify-center text-[#1565C0] dark:text-[#64B5F6]">
            <Activity className="h-6 w-6 font-bold" />
          </div>
          <span className="font-bold text-lg tracking-tight text-[#0D47A1] dark:text-blue-100 hidden sm:block">
            MedPulse
          </span>
        </Link>
        <div className="flex items-center space-x-2">
          <Link
            to="/"
            className={`px-4 py-2 rounded-xl text-sm transition-colors ${
              location.pathname === "/" ||
              location.pathname.startsWith("/patients")
                ? "bg-[#1E88E5] text-white font-semibold shadow-sm"
                : "text-[#1565C0] dark:text-blue-200 font-medium hover:bg-white/50 dark:hover:bg-white/10"
            }`}
          >
            {t("patients")}
          </Link>
          {role === "admin" && (
            <Link
              to="/admin"
              className={`px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-2 ${
                location.pathname === "/admin"
                  ? "bg-[#1E88E5] text-white font-semibold shadow-sm"
                  : "text-[#1565C0] dark:text-blue-200 font-medium hover:bg-white/50 dark:hover:bg-white/10"
              }`}
            >
              <Users className="h-4 w-4" />
              Admin
            </Link>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-1.5 rounded-lg text-[#1565C0] dark:text-blue-200 hover:bg-white/50 dark:hover:bg-white/10 transition-colors"
          title="Toggle Theme"
        >
          {darkMode ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>
        <button
          onClick={toggleLang}
          className="p-1.5 rounded-lg text-[#1565C0] dark:text-blue-200 hover:bg-white/50 dark:hover:bg-white/10 transition-colors font-semibold text-xs tracking-wide flex items-center gap-1"
        >
          <Globe className="h-4 w-4" /> {lang.toUpperCase()}
        </button>

        <div className="hidden sm:flex items-center gap-2 text-[13px] text-[#1565C0] dark:text-blue-200">
          <span className="font-medium">
            Dr. {user?.displayName?.split(" ")[0] || "Doctor"}
          </span>
          {role === "admin" && (
            <span className="bg-[#FFD54F] text-[#7F5F00] text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wide">
              Admin
            </span>
          )}
        </div>
        <div className="w-8 h-8 rounded-full bg-[#1E88E5] text-white flex items-center justify-center font-bold text-xs ring-2 ring-white/50 dark:ring-white/20">
          {user?.displayName?.charAt(0).toUpperCase() || "D"}
        </div>
        <button
          onClick={logOut}
          className="p-1.5 rounded-lg text-[#1565C0] dark:text-blue-200 hover:text-red-600 dark:hover:text-red-400 hover:bg-white/50 dark:hover:bg-white/10 transition-colors ml-1"
          title={t("logout")}
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
