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

    const ctx = gsap.context(() => {
      const tl = gsap.timeline();

      // 1. Main container smooth fade in
      tl.fromTo(
        containerRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.5, ease: 'power2.out' }
      );

      // 2. Stagger headers & descriptions smoothly
      const headers = containerRef.current?.querySelectorAll('.page-header h1, .page-header p, .page-title, .page-description');
      if (headers && headers.length > 0) {
        tl.fromTo(
          headers,
          { opacity: 0, y: 15 },
          { opacity: 1, y: 0, duration: 0.6, stagger: 0.04, ease: 'power3.out' },
          "-=0.3"
        );
      }

      // 3. Stagger cards, buttons, inputs (UI elements)
      const uiElements = containerRef.current?.querySelectorAll('.card, .btn-primary, .btn-secondary, .input, select');
      if (uiElements && uiElements.length > 0) {
        tl.fromTo(
          uiElements,
          { opacity: 0, y: 20, scale: 0.98 },
          { opacity: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.03, ease: 'power3.out' },
          "-=0.4"
        );
      }

      // 4. Stagger table rows for professional data loading effect
      const tableRows = containerRef.current?.querySelectorAll('tbody tr');
      if (tableRows && tableRows.length > 0) {
        tl.fromTo(
          tableRows,
          { opacity: 0, x: -15 },
          { opacity: 1, x: 0, duration: 0.5, stagger: 0.02, ease: 'power3.out' },
          "-=0.4"
        );
      }

      // Add magnetic / 3D tilt hover effects to all cards using GSAP
      const hoverCards = containerRef.current?.querySelectorAll('.card');
      hoverCards?.forEach((card) => {
        const el = card as HTMLElement;
        const handleMouseEnter = () => {
          gsap.to(el, { y: -4, scale: 1.01, boxShadow: '0 20px 40px -15px rgba(37, 99, 235, 0.15)', duration: 0.4, ease: 'power3.out' });
        };
        const handleMouseLeave = () => {
          gsap.to(el, { y: 0, scale: 1, boxShadow: 'none', duration: 0.4, ease: 'power3.out' });
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
