import React from 'react';
import { PawPrint } from 'lucide-react';

const speciesImages = {
  bovino: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697bf59bd017f1e4d3629335/6b7f7dbdb_silhueta-de-vaca.png',
  equino: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697bf59bd017f1e4d3629335/da3a58229_cavalo-com-pose-de-caminhada-lenta.png',
  ovino: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697bf59bd017f1e4d3629335/1a0f6a78f_ovelha.png',
  caprino: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697bf59bd017f1e4d3629335/c10c63d8c_cabra.png',
  suino: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697bf59bd017f1e4d3629335/3eecae453_silhueta-vista-lateral-do-porco.png',
  bubalino: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697bf59bd017f1e4d3629335/3322a068d_bufalo.png'
};

export default function AnimalIcon({ species, className = "w-5 h-5", white = true, isLot = false, color = "currentColor" }) {
  const speciesKey = species?.toLowerCase() || 'bovino';
  const imageUrl = speciesImages[speciesKey] || speciesImages.bovino;

  if (isLot) {
    return (
      <div className={`relative ${className}`}>
        <img 
          src={imageUrl} 
          alt={species} 
          className="w-[70%] h-[70%] absolute top-0 right-0"
          style={{ 
            objectFit: 'contain',
            filter: color !== 'currentColor' ? `drop-shadow(0 0 0 ${color})` : (white ? 'brightness(0) invert(1)' : 'none'),
            opacity: 0.6
          }}
        />
        <img 
          src={imageUrl} 
          alt={species} 
          className="w-[85%] h-[85%] absolute bottom-0 left-0"
          style={{ 
            objectFit: 'contain',
            filter: color !== 'currentColor' ? `drop-shadow(0 0 0 ${color})` : (white ? 'brightness(0) invert(1)' : 'none')
          }}
        />
      </div>
    );
  }

  if (imageUrl) {
    return (
      <img 
        src={imageUrl} 
        alt={species} 
        className={className}
        style={{ 
          objectFit: 'contain',
          filter: color !== 'currentColor' ? `drop-shadow(0 0 0 ${color})` : (white ? 'brightness(0) invert(1)' : 'none')
        }}
      />
    );
  }

  return <PawPrint className={className} style={{ color }} />;
}