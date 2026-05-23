import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard from './components/Dashboard';
import LoginPage from './components/LoginPage';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6ED] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-[#A93226] border-t-transparent rounded-full animate-spin"></div>
          <p className="font-serif text-sm text-[#7C6647] tracking-widest">御书房启殿中...</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;
  return <Dashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
