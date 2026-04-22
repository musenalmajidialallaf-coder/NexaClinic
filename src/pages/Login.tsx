import { useAuth } from "../components/AuthProvider";
import { Activity, ShieldAlert } from "lucide-react";
import { Navigate, useLocation } from "react-router-dom";
import { useI18n } from "../components/I18nProvider";

export default function Login() {
  const { signIn, isSigningIn, user, loading, error } = useAuth();
  const location = useLocation();
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#E3F2FD] dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E88E5] dark:border-blue-400"></div>
      </div>
    );
  }

  if (user) {
    const from = location.state?.from?.pathname || "/";
    return <Navigate to={from} replace />;
  }

  return (
    <div className="min-h-screen bg-[#E3F2FD] dark:bg-slate-900 bg-[radial-gradient(at_0%_0%,_#E3F2FD_0%,_#BBDEFB_50%,_#90CAF9_100%)] dark:bg-[radial-gradient(at_0%_0%,_#0F172A_0%,_#1E293B_50%,_#020617_100%)] flex items-center justify-center p-4 antialiased font-sans transition-colors duration-200">
      <div className="max-w-md w-full bg-white/35 dark:bg-slate-900/30 backdrop-blur-[15px] border border-white/30 dark:border-white/10 rounded-[24px] shadow-2xl overflow-hidden p-[2px]">
        <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-[10px] rounded-[22px] p-8">
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 bg-gradient-to-br from-[#1E88E5] to-[#1565C0] rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/20">
              <span className="font-black text-xl text-white tracking-tighter">NC</span>
            </div>
          </div>
          <h2 className="text-center text-[22px] font-bold text-[#0D47A1] dark:text-blue-100 mb-2 tracking-tight">
            Welcome to NexaClinic
          </h2>
          <p className="text-center text-[#1565C0]/80 dark:text-blue-200/80 mb-8 text-[15px]">
            Healthcare Portal Secure Access
          </p>

          {error && (
            <div className="mb-6 bg-red-50/80 dark:bg-red-900/30 border border-red-200/50 dark:border-red-900/50 backdrop-blur-sm rounded-xl p-4 flex items-start gap-3 shadow-sm">
              <ShieldAlert className="h-5 w-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                {error}
              </p>
            </div>
          )}

          <button
            onClick={signIn}
            disabled={isSigningIn}
            className="w-full relative flex items-center justify-center gap-3 px-4 py-3.5 border border-white/50 dark:border-slate-600 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-sm font-bold rounded-xl text-[#0D47A1] dark:text-blue-100 hover:bg-white dark:hover:bg-slate-700/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1E88E5] dark:focus:ring-blue-400 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSigningIn ? (
              <div className="h-5 w-5 border-2 border-[#1E88E5] border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            {isSigningIn ? "Signing in..." : "Continue with Google"}
          </button>

          <div className="mt-8 text-center text-[10px] font-bold tracking-widest text-[#1565C0]/50 dark:text-blue-200/50 uppercase">
            Strictly Authorized Personnel Only
          </div>
        </div>
      </div>
    </div>
  );
}
