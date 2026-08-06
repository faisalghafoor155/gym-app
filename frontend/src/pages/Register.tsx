import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Dumbbell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api, { apiError } from '../api/client';
import type { AuthResponse } from '../types';
import toast from 'react-hot-toast';

interface RegisterForm {
  gymName: string;
  ownerName: string;
  email: string;
  password: string;
  phone: string;
}

export default function Register() {
  const [form, setForm] = useState<RegisterForm>({
    gymName: '', ownerName: '', email: '', password: '', phone: '',
  });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const set = (key: keyof RegisterForm) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post<AuthResponse>('/auth/register', form);
      login(data.user, data.gym);
      toast.success('Gym registered! You are the owner.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(apiError(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-md p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-8">
          <Dumbbell className="text-blue-600" size={28} />
          <span className="text-xl font-bold text-gray-900">GymPro</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Register your gym</h1>
        <p className="text-gray-500 text-sm mb-6">Create your gym management account</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gym Name *</label>
            <input
              type="text"
              required
              value={form.gymName}
              onChange={set('gymName')}
              placeholder="Fitness Plus Gym"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name *</label>
            <input
              type="text"
              required
              value={form.ownerName}
              onChange={set('ownerName')}
              placeholder="Ahmed Khan"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={set('email')}
              placeholder="owner@gym.com"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="text"
              value={form.phone}
              onChange={set('phone')}
              placeholder="03001234567"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={set('password')}
              placeholder="Min 8 characters"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already registered?{' '}
          <Link to="/login" className="text-blue-600 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
