import { useEffect } from 'react';

/**
 * LandingPage - Componente que carrega a página de landing via iframe
 */
export default function LandingPage() {
  useEffect(() => {
    // Scroll to top quando a página carrega
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="w-full h-screen bg-white">
      <iframe
        src="/landing.html"
        className="w-full h-full border-0"
        title="DuoVet - Página de Landing"
        referrerPolicy="no-referrer"
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
      />
    </div>
  );
}
