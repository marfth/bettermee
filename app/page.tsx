'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type ActiveTab = 'dashboard' | 'money' | 'fitness' | 'habits';

interface Transaction {
  id: number;
  date: string;
  type: 'save' | 'spend';
  amount: number;
}

interface HabitItem {
  id: number;
  text: string;
  completed: boolean;
}

interface UserProfile {
  name: string;
  email: string;
}

export default function BetterMeeApp() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [userNameInput, setUserNameInput] = useState<string>('');
  const [emailInput, setEmailInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const [darkMode, setDarkMode] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState<ActiveTab>('dashboard');

  const [currentDateString, setCurrentDateString] = useState<string>('');
  const [dayNumber, setDayNumber] = useState<number>(1);

  // Money State
  const [expectedIncome, setExpectedIncome] = useState<number>(0);
  const [monthlyGoal, setMonthlyGoal] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dailyInputAmount, setDailyInputAmount] = useState<string>('');
  const [activeTxType, setActiveTxType] = useState<'save' | 'spend'>('save');

  // Fitness State
  const [targetWorkoutDays, setTargetWorkoutDays] = useState<number>(3);
  const [workoutDays, setWorkoutDays] = useState<{ [key: string]: boolean }>({
    Mon: false, Tue: false, Wed: false, Thu: false, Fri: false, Sat: false, Sun: false,
  });
  const [showGymSuccess, setShowGymSuccess] = useState<boolean>(false);

  // Habits State
  const [habits, setHabits] = useState<HabitItem[]>([]);
  const [newHabitText, setNewHabitText] = useState('');
  const [showHabitsSuccess, setShowHabitsSuccess] = useState(false);

  // Fetch user data from Supabase tables
  const fetchUserData = async (uid: string) => {
    // Fetch Habits
    const { data: habitsData } = await supabase.from('habits').select('*').eq('user_id', uid);
    if (habitsData) {
      setHabits(habitsData.map(h => ({ id: h.id, text: h.text, completed: h.completed })));
    }

    // Fetch Transactions
    const { data: txData } = await supabase.from('transactions').select('*').eq('user_id', uid);
    if (txData) {
      setTransactions(txData.map(t => ({ id: t.id, date: t.date, type: t.type as 'save' | 'spend', amount: Number(t.amount) })));
    }

    // Fetch Workouts
    const { data: workoutData } = await supabase.from('workouts').select('*').eq('user_id', uid);
    if (workoutData && workoutData.length > 0) {
      const wMap: { [key: string]: boolean } = { Mon: false, Tue: false, Wed: false, Thu: false, Fri: false, Sat: false, Sun: false };
      workoutData.forEach(w => {
        wMap[w.day_name] = w.completed;
      });
      setWorkoutDays(wMap);
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const uid = session.user.id;
        setUserId(uid);
        setUser({
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
          email: session.user.email || '',
        });
        setIsLoggedIn(true);
        fetchUserData(uid);
      }
    };
    checkSession();

    const today = new Date();
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    setCurrentDateString(today.toLocaleDateString('en-US', options));
    setDayNumber(1);
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !passwordInput || (authMode === 'signup' && !userNameInput)) return;

    setLoading(true);

    if (authMode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email: emailInput,
        password: passwordInput,
        options: { data: { name: userNameInput } }
      });

      if (error) {
        alert(error.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        setUserId(data.user.id);
        await supabase.from('profiles').insert([{ id: data.user.id, name: userNameInput }]);
      }

      alert('Account created successfully!');
      setUser({ name: userNameInput, email: emailInput });
      setIsLoggedIn(true);
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput,
        password: passwordInput,
      });

      if (error) {
        alert(error.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        setUserId(data.user.id);
        setUser({
          name: data.user.user_metadata?.name || emailInput.split('@')[0],
          email: data.user.email || emailInput,
        });
        setIsLoggedIn(true);
        fetchUserData(data.user.id);
      }
    }

    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserId(null);
    setIsLoggedIn(false);
  };

  // --- MONEY ACTIONS ---
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dailyInputAmount || isNaN(Number(dailyInputAmount)) || !userId) return;

    const amountNum = Number(dailyInputAmount);
    const dateStr = `Day ${dayNumber} Entry`;

    const { data, error } = await supabase.from('transactions').insert([
      { user_id: userId, date: dateStr, type: activeTxType, amount: amountNum }
    ]).select();

    if (error) {
      alert(error.message);
      return;
    }

    if (data && data[0]) {
      const newT: Transaction = {
        id: data[0].id,
        date: data[0].date,
        type: data[0].type as 'save' | 'spend',
        amount: Number(data[0].amount),
      };
      setTransactions([newT, ...transactions]);
    }
    setDailyInputAmount('');
  };

  const removeTransaction = async (id: number) => {
    await supabase.from('transactions').delete().eq('id', id);
    setTransactions(transactions.filter(t => t.id !== id));
  };

  // --- FITNESS ACTIONS ---
  const toggleWorkoutDay = async (day: string) => {
    if (!userId) return;
    const newStatus = !workoutDays[day];
    const updatedWorkouts = { ...workoutDays, [day]: newStatus };
    setWorkoutDays(updatedWorkouts);

    // Upsert into Supabase workouts table
    await supabase.from('workouts').upsert([
      { user_id: userId, day_name: day, completed: newStatus }
    ], { onConflict: 'user_id,day_name' });

    const completedCount = Object.values(updatedWorkouts).filter(Boolean).length;
    setShowGymSuccess(completedCount >= targetWorkoutDays);
  };

  // --- HABIT ACTIONS ---
  const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitText.trim() || !userId) return;

    const { data, error } = await supabase.from('habits').insert([
      { user_id: userId, text: newHabitText, completed: false }
    ]).select();

    if (error) {
      alert(error.message);
      return;
    }

    if (data && data[0]) {
      const newItem: HabitItem = { id: data[0].id, text: data[0].text, completed: data[0].completed };
      setHabits([...habits, newItem]);
    }
    setNewHabitText('');
  };

  const toggleHabit = async (id: number) => {
    const habit = habits.find(h => h.id === id);
    if (!habit) return;
    const newStatus = !habit.completed;

    const updatedHabits = habits.map(h => h.id === id ? { ...h, completed: newStatus } : h);
    setHabits(updatedHabits);

    await supabase.from('habits').update({ completed: newStatus }).eq('id', id);

    const allCompleted = updatedHabits.length > 0 && updatedHabits.every(h => h.completed);
    setShowHabitsSuccess(allCompleted);
  };

  const totalSaved = transactions.filter(t => t.type === 'save').reduce((acc, t) => acc + t.amount, 0);
  const totalSpent = transactions.filter(t => t.type === 'spend').reduce((acc, t) => acc + t.amount, 0);
  const netBalance = expectedIncome - totalSpent + totalSaved;

  let moneyStatus: 'green' | 'yellow' | 'red' = 'green';
  let moneyStatusText = 'Set your income and savings target to begin tracking! 🚀';
  if (monthlyGoal > 0) {
    if (netBalance < monthlyGoal * 0.7) {
      moneyStatus = 'red';
      moneyStatusText = 'Critical: Below safe threshold. Cut back on spending! ⚠️';
    } else if (netBalance < monthlyGoal) {
      moneyStatus = 'yellow';
      moneyStatusText = 'Warning: 50/50 trajectory. Maintain discipline to hit your goal.';
    } else {
      moneyStatus = 'green';
      moneyStatusText = 'On track to beat your monthly financial target! 🚀';
    }
  }

  const workoutsCompletedCount = Object.values(workoutDays).filter(Boolean).length;
  const fitnessScore = targetWorkoutDays > 0 ? Math.min(100, Math.round((workoutsCompletedCount / targetWorkoutDays) * 100)) : 0;

  const completedHabitsCount = habits.filter(h => h.completed).length;
  const habitsProgress = habits.length > 0 ? Math.round((completedHabitsCount / habits.length) * 100) : 0;

  const getAnimatedEmoji = () => {
    if (habits.length === 0) return '🌱';
    if (habitsProgress === 100) return '🤩✨';
    if (habitsProgress >= 75) return '😁🚀';
    if (habitsProgress >= 50) return '🙂👍';
    return '😴';
  };

  const overallProgress = Math.round((Math.min(100, fitnessScore) + habitsProgress + (monthlyGoal > 0 && netBalance >= monthlyGoal ? 100 : 50)) / 3);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#0A0B0E] text-slate-100 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-[#11131C] border border-slate-800/80 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center font-black text-white text-xl shadow-lg shadow-amber-500/20 mb-3" style={{ backgroundImage: 'linear-gradient(to top right, #f59e0b, #ea580c)' }}>
              BM
            </div>
            <h1 className="text-2xl font-black bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(to right, #fbbf24, #f97316)' }}>
              Welcome to BetterMee
            </h1>
            <p className="text-xs text-slate-400 mt-1">Cloud Auto-Save Enabled ⚡</p>
          </div>

          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 mb-6">
            <button type="button" onClick={() => setAuthMode('signin')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${authMode === 'signin' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}>Sign In</button>
            <button type="button" onClick={() => setAuthMode('signup')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${authMode === 'signup' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}>Sign Up</button>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === 'signup' && (
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Your Name</label>
                <input type="text" value={userNameInput} onChange={(e) => setUserNameInput(e.target.value)} placeholder="e.g. Alex" required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500" />
              </div>
            )}
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1">Email Address</label>
              <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} placeholder="name@example.com" required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="••••••••" required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-sm text-slate-200 focus:outline-none focus:border-amber-500" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-400 p-1.5 cursor-pointer">👁️</button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition shadow-lg cursor-pointer mt-2 disabled:opacity-50" style={{ backgroundImage: 'linear-gradient(to right, #f59e0b, #ea580c)' }}>
              {loading ? 'Processing...' : authMode === 'signup' ? 'Create Account' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-[#0A0B0E] text-slate-100' : 'bg-slate-50 text-slate-900'} font-sans relative overflow-hidden`}>
      <nav className={`border-b ${darkMode ? 'border-slate-800/80 bg-[#0E1017]/90' : 'border-slate-200 bg-white/95'} backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex justify-between items-center shadow-lg`}>
        <div className="flex items-center gap-4">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className={`p-2 rounded-xl border ${darkMode ? 'border-slate-800 bg-slate-900 text-amber-400' : 'border-slate-200 bg-slate-100 text-amber-600'}`}>☰</button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white shadow-lg shadow-amber-500/20" style={{ backgroundImage: 'linear-gradient(to top right, #f59e0b, #ea580c)' }}>BM</div>
            <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(to right, #fbbf24, #f97316)' }}>BetterMee</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setDarkMode(!darkMode)} className="text-xs px-3 py-1.5 rounded-lg border font-medium">{darkMode ? '☀️ Light' : '🌙 Dark'}</button>
          <button onClick={handleSignOut} className="text-xs px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500 hover:text-white transition font-medium cursor-pointer">Sign Out</button>
        </div>
      </nav>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setSidebarOpen(false)}></div>
          <div className={`relative w-72 ${darkMode ? 'bg-[#0E1017] border-r border-slate-800' : 'bg-white border-r border-slate-200'} p-6 flex flex-col justify-between shadow-2xl z-10`}>
            <div>
              <div className="flex justify-between items-center mb-8">
                <div>
                  <span className="font-bold text-lg text-amber-500 block">Hello, {user?.name} 👋</span>
                  <span className="text-[11px] text-slate-400">Cloud Sync Active</span>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="text-slate-400">✕</button>
              </div>
              <div className="space-y-2">
                <button onClick={() => { setCurrentTab('dashboard'); setSidebarOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-medium transition flex items-center gap-3 ${currentTab === 'dashboard' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-slate-400'}`}>📊 Main Dashboard</button>
                <button onClick={() => { setCurrentTab('money'); setSidebarOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-medium transition flex items-center gap-3 ${currentTab === 'money' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-slate-400'}`}>💰 Money Tracker</button>
                <button onClick={() => { setCurrentTab('fitness'); setSidebarOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-medium transition flex items-center gap-3 ${currentTab === 'fitness' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-slate-400'}`}>🏋️ Gym & Fitness</button>
                <button onClick={() => { setCurrentTab('habits'); setSidebarOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-medium transition flex items-center gap-3 ${currentTab === 'habits' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-slate-400'}`}>✨ Daily Activities</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {currentTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="p-6 rounded-2xl border border-slate-800 shadow-xl flex justify-between items-center bg-[#11131C]">
              <div>
                <span className="text-xs uppercase font-semibold text-amber-500">Welcome back, {user?.name} 🔥</span>
                <h1 className="text-2xl font-bold mt-1">Your cloud database is fully synchronized.</h1>
              </div>
              <div className="bg-slate-950 border border-slate-800 px-6 py-4 rounded-xl text-center">
                <span className="text-xs text-slate-400 block font-medium">Overall Progress</span>
                <span className="text-2xl font-black text-amber-400">{overallProgress}%</span>
              </div>
            </div>
          </div>
        )}

        {currentTab === 'money' && (
          <div className="p-6 rounded-2xl border border-slate-800 bg-[#11131C] shadow-xl space-y-6">
            <h2 className="text-xl font-bold">💰 Money Tracker (Cloud Saved)</h2>
            <div className="flex gap-3">
              <input type="number" placeholder="Amount ($)" value={dailyInputAmount} onChange={(e) => setDailyInputAmount(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200" />
              <button onClick={() => setActiveTxType('save')} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTxType === 'save' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 text-slate-400'}`}>Save</button>
              <button onClick={() => setActiveTxType('spend')} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTxType === 'spend' ? 'bg-rose-500 text-white' : 'bg-slate-900 text-slate-400'}`}>Spend</button>
              <button onClick={handleAddTransaction} className="px-6 py-3 bg-amber-500 text-slate-950 font-bold rounded-xl text-sm">Add</button>
            </div>
            <div className="space-y-2">
              {transactions.map(t => (
                <div key={t.id} className="flex justify-between p-3 bg-slate-950 rounded-xl border border-slate-800 items-center">
                  <span>{t.type.toUpperCase()}: ${t.amount} ({t.date})</span>
                  <button onClick={() => removeTransaction(t.id)} className="text-rose-400 text-xs">Delete</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentTab === 'fitness' && (
          <div className="p-6 rounded-2xl border border-slate-800 bg-[#11131C] shadow-xl space-y-6">
            <h2 className="text-xl font-bold">🏋️ Gym Tracker (Cloud Saved)</h2>
            <div className="grid grid-cols-7 gap-3">
              {Object.keys(workoutDays).map(day => (
                <button key={day} onClick={() => toggleWorkoutDay(day)} className={`p-4 rounded-xl border flex flex-col items-center ${workoutDays[day] ? 'bg-amber-500/10 border-amber-500 text-amber-400' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                  <span className="font-bold">{day}</span>
                  <span className="text-xs">{workoutDays[day] ? 'Active' : 'Rest'}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {currentTab === 'habits' && (
          <div className="p-6 rounded-2xl border border-slate-800 bg-[#11131C] shadow-xl space-y-6">
            <h2 className="text-xl font-bold">✨ Daily Activities (Cloud Saved)</h2>
            <form onSubmit={handleAddHabit} className="flex gap-2">
              <input type="text" value={newHabitText} onChange={(e) => setNewHabitText(e.target.value)} placeholder="Add habit..." className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm" />
              <button type="submit" className="px-5 py-2.5 bg-amber-500 text-slate-950 font-bold rounded-xl text-sm">Add</button>
            </form>
            <div className="space-y-3">
              {habits.map(h => (
                <div key={h.id} onClick={() => toggleHabit(h.id)} className={`p-4 rounded-xl border flex justify-between items-center cursor-pointer ${h.completed ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 line-through' : 'bg-slate-950 border-slate-800 text-slate-200'}`}>
                  <span>{h.text}</span>
                  <span>{h.completed ? 'Done ✅' : 'Pending'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}