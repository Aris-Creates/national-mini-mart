// src/pages/LoginPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Store, AlertTriangle, Loader2 } from 'lucide-react';

type FormType = 'signIn' | 'signUp';

const getFriendlyErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
    case 'auth/user-not-found': return 'No account found with this email.';
    case 'auth/wrong-password': return 'Incorrect password. Please try again.';
    case 'auth/invalid-email': return 'Please enter a valid email address.';
    case 'auth/email-already-in-use': return 'This email is already registered. Please sign in.';
    case 'auth/weak-password': return 'Password should be at least 6 characters.';
    case 'auth/too-many-requests': return 'Access temporarily disabled. Please try again later.';
    default: return 'An unexpected error occurred. Please try again.';
  }
};

export default function LoginPage() {
  const [formType, setFormType] = useState<FormType>('signIn');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleTabChange = (type: FormType) => {
    setFormType(type);
    // Clear fields and errors when switching tabs
    setFullName('');
    setEmail('');
    setPassword('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (formType === 'signIn') {
        await signIn(email, password);
      } else {
        await signUp(fullName, email, password);
      }
      // On success, the App router will handle the redirect
      navigate('/'); 
    } catch (err: any) {
      console.error("Firebase Auth Error:", err.code, err.message);
      setError(getFriendlyErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white shadow-lg border border-gray-200">
        <div className="text-center">
          <Store className="mx-auto h-12 w-12 text-blue-600" />
          <h1 className="mt-4 text-3xl font-bold text-gray-900">National Mini Mart</h1>
          <p className="mt-2 text-gray-500">
            {formType === 'signIn' ? 'Sign in to access your dashboard' : 'Create a new employee account'}
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b">
          <button
            onClick={() => handleTabChange('signIn')}
            className={`flex-1 py-2 text-sm font-medium ${formType === 'signIn' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Sign In
          </button>
          <button
            onClick={() => handleTabChange('signUp')}
            className={`flex-1 py-2 text-sm font-medium ${formType === 'signUp' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Sign Up
          </button>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          {formType === 'signUp' && (
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <Input
                id="fullName"
                type="text"
                autoComplete="name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          {error && (
            <div className="flex items-center gap-3 text-sm text-red-800 bg-red-100 p-3 border border-red-200">
              <AlertTriangle size={18} className="text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <Button type="submit" variant='secondary' className="w-full flex justify-center items-center gap-2" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                formType === 'signIn' ? 'Sign In' : 'Create Account'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}