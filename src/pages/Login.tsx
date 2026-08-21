import { useRef, useState, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { User, Lock, ArrowRight, Sun, Moon } from 'lucide-react';
import gsap from 'gsap';
import { useGoogleLogin } from '@react-oauth/google';

// UI UX PRO MAX - Cinematic Geometric Rings & 3D Logo Animation
function AnimationPanel({ logoRef }: { logoRef: React.RefObject<HTMLImageElement> }) {
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Infinite smooth rotations for the geometric rings
    gsap.to('.gsap-ring-1', { rotation: 360, duration: 25, repeat: -1, ease: 'none' });
    gsap.to('.gsap-ring-2', { rotation: -360, duration: 35, repeat: -1, ease: 'none' });
    gsap.to('.gsap-ring-3', { rotation: 360, duration: 45, repeat: -1, ease: 'none' });
    
    // Slow pulsing background gradient
    gsap.to(bgRef.current, { scale: 1.15, opacity: 0.7, duration: 8, repeat: -1, yoyo: true, ease: 'sine.inOut' });
  }, []);

  return (
    <div className="absolute inset-0 flex flex-col justify-center items-center bg-[#020617] overflow-hidden shadow-[-15px_0_40px_rgba(0,0,0,0.3)]">
      {/* Deep premium background gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-brand-950/50 via-[#020617] to-black" />
      
      {/* Dynamic Pulsing Center */}
      <div ref={bgRef} className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.12)_0%,transparent_60%)] opacity-50" />

      {/* Decorative Geometric Rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-80 mix-blend-screen">
        <div className="gsap-ring-1 absolute w-[280px] h-[280px] border border-brand-500/20 rounded-full border-t-brand-400/80 shadow-[0_0_15px_rgba(56,189,248,0.1)]" />
        <div className="gsap-ring-2 absolute w-[420px] h-[420px] border border-brand-500/10 rounded-full border-b-brand-400/50" />
        <div className="gsap-ring-3 absolute w-[580px] h-[580px] border border-brand-500/5 rounded-full border-l-brand-400/30" />
        <div className="gsap-ring-2 absolute w-[750px] h-[750px] border border-brand-500/5 rounded-full border-r-brand-400/20 border-dashed" />
      </div>

      {/* Floating particles overlay */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.03] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center pointer-events-none">
        <div className="relative">
          {/* Inner intense glow */}
          <div className="absolute inset-0 bg-surface-0 rounded-full blur-[50px] opacity-10 logo-glow" />
          <div className="brightness-0 invert drop-shadow-[0_0_25px_rgba(255,255,255,0.6)]">
            <img
              ref={logoRef}
              src="/logo-icon.png"
              alt="Octopus"
              className="w-32 h-32 object-contain select-none relative z-10 opacity-0"
              draggable={false}
              style={{ 
                WebkitTouchCallout: 'none', 
                pointerEvents: 'none'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const loginApp = useAppStore((s) => s.loginApp);
  const addToast = useAppStore((s) => s.addToast);

  const leftSideRef = useRef<HTMLDivElement>(null);
  const rightSideRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);
  const [introFinished, setIntroFinished] = useState(false);

  // --- Cinematic GSAP Sequence ---
  useEffect(() => {
    // 1. Initial State Setup
    gsap.set(leftSideRef.current, { opacity: 0, x: -40 });
    gsap.set(rightSideRef.current, { width: '100%', right: 0 });
    
    // Logo starting state: scaled down, invisible, and flipped 90deg on Y axis
    gsap.set(logoRef.current, { opacity: 0, scale: 0.3, rotationY: 90 });
    // Rings starting state
    gsap.set('.gsap-ring-1, .gsap-ring-2, .gsap-ring-3', { opacity: 0, scale: 0.5 });

    const isMobile = window.innerWidth < 1024;
    const tl = gsap.timeline({
      onComplete: () => setIntroFinished(true)
    });

    // 2. Cinematic 3D Logo Reveal with extreme ease
    tl.fromTo(logoRef.current, 
      { opacity: 0, scale: 0.1, rotationY: 180, rotationX: 45, filter: 'blur(20px)' },
      { opacity: 1, scale: 1, rotationY: 0, rotationX: 0, filter: 'blur(0px)', duration: 2.8, ease: 'power4.out', delay: 0.2 }
    )
    
    // 3. Geometric Rings Explode Outward smoothly
    .to('.gsap-ring-1', { opacity: 1, scale: 1, duration: 2.0, ease: 'back.out(1.4)' }, "-=2.4")
    .to('.gsap-ring-2', { opacity: 1, scale: 1, duration: 2.0, ease: 'back.out(1.2)' }, "-=2.2")
    .to('.gsap-ring-3', { opacity: 1, scale: 1, duration: 2.0, ease: 'back.out(1.0)' }, "-=2.0")

    // 4. Subtle float effect on logo to show it is "alive"
    .to(logoRef.current, { y: -15, rotationZ: 2, duration: 2.5, ease: 'sine.inOut', yoyo: true, repeat: -1 }, "-=1.0")

    // 5. Hold for impact
    .to({}, { duration: 0.4 })

    // 6. Compress rings slightly before the split
    .to('.gsap-ring-1, .gsap-ring-2, .gsap-ring-3', { scale: 0.75, opacity: 0.4, duration: 1.2, ease: 'power3.inOut' }, "split-=1.2")
    
    // Make logo slightly smaller and shift for the split
    .to(logoRef.current, { scale: 0.85, duration: 1.2, ease: 'power3.inOut' }, "split-=1.2")

    // 7. Split transition
    .to(rightSideRef.current, isMobile ? {
      y: '-100%',
      duration: 1.6,
      ease: 'expo.inOut'
    } : {
      width: '45%',
      duration: 1.6,
      ease: 'expo.inOut'
    }, "split")

    // 8. Left side Form glides in
    .to(leftSideRef.current, {
      opacity: 1,
      x: 0,
      duration: 1.4,
      ease: 'power3.out'
    }, "split+=0.4")
    
    // 9. Staggered form field reveal (Snappy & elegant)
    .fromTo('.gsap-stagger-item', 
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out' },
      "split+=0.2"
    );

    return () => {
      tl.kill();
    };
  }, []);

  // Handle responsive layout AFTER intro finishes
  useEffect(() => {
    if (!introFinished) return;
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        gsap.set(rightSideRef.current, { y: '-100%', width: '100%', opacity: 1 });
      } else {
        gsap.set(rightSideRef.current, { y: '0%', opacity: 1, width: '45%' });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [introFinished]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'admin' && password === 'rtm-team-2026') {
      setError('');
      // Small success animation before logging in
      gsap.to(leftSideRef.current, { opacity: 0, scale: 0.98, duration: 0.4, ease: 'power2.inOut', onComplete: loginApp });
    } else {
      setError('Invalid username or password.');
      gsap.fromTo(leftSideRef.current, { x: -10 }, { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)' });
    }
  };

  const handleGoogleSuccess = async (tokenResponse: any) => {
    try {
      setError('');
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: tokenResponse.access_token }),
      });
      
      let data;
      try {
        data = await res.json();
      } catch (err) {
        throw new Error('Backend returned invalid response. Ensure the backend server was restarted.');
      }
      
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Store token and login
      localStorage.setItem('auth_token', data.token);
      gsap.to(leftSideRef.current, { opacity: 0, scale: 0.98, duration: 0.4, ease: 'power2.inOut', onComplete: loginApp });
      addToast({ message: `Welcome back, ${data.user.name}`, type: 'success' });
    } catch (e: any) {
      setError(e.message || 'Login failed');
      gsap.fromTo(leftSideRef.current, { x: -10 }, { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)' });
    }
  };

  const loginWithGoogle = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: () => {
      setError('Google Authentication Failed');
      gsap.fromTo(leftSideRef.current, { x: -10 }, { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)' });
    },
  // Attempting to filter by domain if the browser supports it
    hosted_domain: 'talabat.com'
  });

  return (
    <div className="relative min-h-screen w-full bg-surface-0 dark:bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] dark:from-brand-950/20 dark:via-[#020617] dark:to-black overflow-hidden flex font-legacy">
      {/* Left Side: Form */}
      <div
        ref={leftSideRef}
        className="w-full lg:w-[55%] min-h-screen flex flex-col justify-center items-center px-6 py-12 relative z-10"
      >
        <button
          onClick={useAppStore(s => s.toggleDarkMode)}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-surface-50 text-surface-500 transition-colors focus:outline-none"
        >
          {useAppStore(s => s.darkMode) ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <div className="w-full max-w-sm">
          {/* Main Logo on Form */}
          <div className="mb-8 flex flex-col items-center pointer-events-none select-none gsap-stagger-item">
            <img
              src="/octopus-logo.png"
              alt="Octopus Outsourcing"
              className="h-20 w-auto object-contain drop-shadow-sm select-none dark:brightness-0 dark:invert"
              draggable={false}
              style={{ WebkitTouchCallout: 'none' }}
            />
          </div>

          <div className="w-full flex flex-col gap-4">


            {error && (
              <div className="gsap-stagger-item mb-2">
                <p className="text-danger-600 text-xs font-medium bg-danger-50 border border-danger-100 rounded-lg px-4 py-2.5 shadow-sm text-center">
                  {error}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="w-full mb-2">
              <div className="gsap-stagger-item mb-4">
                <label className="block text-xs text-surface-600 font-semibold mb-1.5">Username</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none z-10">
                    <User size={16} className="text-surface-400 dark:text-white group-focus-within:text-brand-500 dark:group-focus-within:text-brand-400 transition-colors" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    className="input pl-10 h-11 text-sm bg-surface-50 border-surface-200 focus:bg-surface-0 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all rounded-lg shadow-sm hover:border-surface-300"
                  />
                </div>
              </div>

              <div className="gsap-stagger-item mb-5">
                <label className="block text-xs text-surface-600 font-semibold mb-1.5">Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none z-10">
                    <Lock size={16} className="text-surface-400 dark:text-white group-focus-within:text-brand-500 dark:group-focus-within:text-brand-400 transition-colors" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="input pl-10 h-11 text-sm bg-surface-50 border-surface-200 focus:bg-surface-0 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all rounded-lg shadow-sm hover:border-surface-300"
                  />
                </div>
              </div>

              <button type="submit" className="gsap-stagger-item w-full btn-primary h-11 text-sm shadow-md shadow-brand-500/20 group relative overflow-hidden rounded-lg transition-transform hover:-translate-y-0.5 active:translate-y-0">
                <span className="relative z-10 flex items-center justify-center gap-2 font-semibold tracking-wide">
                  Sign In <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </button>
            </form>

            <div className="gsap-stagger-item flex items-center gap-3 my-1">
              <div className="flex-1 h-[1px] bg-surface-200"></div>
              <span className="text-xs text-surface-400 font-medium uppercase tracking-wider">or</span>
              <div className="flex-1 h-[1px] bg-surface-200"></div>
            </div>

            <button 
              onClick={() => loginWithGoogle()}
              className="gsap-stagger-item w-full bg-surface-0 dark:bg-surface-0/40 dark:backdrop-blur-xl border border-surface-200 dark:border-white/10 text-surface-700 dark:text-white h-12 text-sm shadow-sm hover:bg-surface-50 dark:hover:bg-surface-0/60 transition-all flex items-center justify-center gap-3 font-semibold rounded-lg group relative overflow-hidden"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </button>
          </div>

          <div className="mt-8 border-t border-surface-100 pt-4 pb-2 text-center gsap-stagger-item">
            <p className="text-[10px] text-surface-400 leading-relaxed max-w-xs mx-auto mb-2.5">
              &copy; {new Date().getFullYear()}. All rights reserved. Confidential & Proprietary.
            </p>
            <div className="text-[10px] text-surface-500 tracking-wide flex justify-center items-center gap-1.5">
              <span className="text-surface-400">Designed and Developed by</span>
              <span className="font-bold text-brand-600">Yousef Samir</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side: Cinematic Animation Panel */}
      <div
        ref={rightSideRef}
        className="absolute top-0 bottom-0 right-0 w-full z-50 pointer-events-none shadow-2xl"
      >
        <AnimationPanel logoRef={logoRef} />
      </div>
    </div>
  );
}

