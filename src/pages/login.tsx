import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth'; // Ensure this path is correct
import { Input } from '../components/ui/Input'; // Ensure this path is correct
import { Button } from '../components/ui/Button'; // Ensure this path is correct
import { Store, AlertTriangle, Loader2 } from 'lucide-react';

// A helper function to convert Firebase error codes into user-friendly messages
const getFriendlyErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
    case 'auth/user-not-found':
      return 'No account found with this email. Please check your email or sign up.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Access to this account has been temporarily disabled due to many failed login attempts. Please try again later.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
};

export default function LoginPage() {
  // --- STATE MANAGEMENT ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // --- HOOKS ---
  const { signIn } = useAuth();
  const navigate = useNavigate();

  // --- EVENT HANDLERS ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      navigate('/pos'); // Redirect to the main POS page on successful login
    } catch (err: any) {
      console.error("Firebase Auth Error:", err.code, err.message);
      setError(getFriendlyErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900 p-4">
      <div className="w-full max-w-md p-8 space-y-8 bg-slate-800 rounded-2xl shadow-2xl">
        
        {/* --- Header --- */}
        <div className="text-center">
          <Store className="mx-auto h-12 w-12 text-blue-500" />
          <h1 className="mt-4 text-3xl font-bold text-slate-100">National Mini Mart</h1>
          <p className="mt-2 text-slate-400">Sign in to access your dashboard</p>
        </div>
        
        {/* --- Login Form --- */}
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300">
              Email address
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 placeholder:text-slate-400 text-white"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 placeholder:text-slate-400 text-white"
              placeholder="••••••••"
            />
          </div>
          
          {/* --- Error Message Display --- */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 p-3 rounded-md">
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* --- Submit Button with Loading State --- */}
          <div>
            <Button type="submit" className="w-full flex justify-center items-center gap-2" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}