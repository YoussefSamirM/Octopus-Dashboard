import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface GSAPPageTransitionProps {
  children: React.ReactNode;
  pageKey: string;
}

export default function GSAPPageTransition({ children, pageKey }: GSAPPageTransitionProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Reset initial state
    const ctx = gsap.context(() => {
      // Main container entrance
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' }
      );

      // Stagger headers & text
      const headers = containerRef.current?.querySelectorAll('.page-header, .page-title, .page-description');
      if (headers && headers.length > 0) {
        gsap.fromTo(
          headers,
          { opacity: 0, y: -5 },
          { opacity: 1, y: 0, duration: 0.2, stagger: 0.03, ease: 'power2.out' }
        );
      }

      // Stagger cards, buttons & interactive widgets
      const cards = containerRef.current?.querySelectorAll('.card, .gsap-card, .btn-primary, .btn-secondary');
      if (cards && cards.length > 0) {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 10, scale: 0.99 },
          { opacity: 1, y: 0, scale: 1, duration: 0.25, stagger: 0.02, ease: 'power2.out', delay: 0.05 }
        );
      }

      // Add magnetic / 3D tilt hover effects to all cards using GSAP
      const hoverCards = containerRef.current?.querySelectorAll('.card');
      hoverCards?.forEach((card) => {
        const el = card as HTMLElement;
        const handleMouseEnter = () => {
          gsap.to(el, { y: -3, scale: 1.01, boxShadow: '0 12px 30px -10px rgba(14, 165, 233, 0.15)', duration: 0.3, ease: 'power2.out' });
        };
        const handleMouseLeave = () => {
          gsap.to(el, { y: 0, scale: 1, boxShadow: 'none', duration: 0.3, ease: 'power2.out' });
        };
        el.addEventListener('mouseenter', handleMouseEnter);
        el.addEventListener('mouseleave', handleMouseLeave);
      });
    }, containerRef);

    return () => ctx.revert();
  }, [pageKey]);

  return (
    <div ref={containerRef} className="w-full min-h-full">
      {children}
    </div>
  );
}
