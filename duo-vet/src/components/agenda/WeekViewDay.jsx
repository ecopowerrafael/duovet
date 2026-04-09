import React, { useState } from 'react';
import EventCard from './EventCard';
import { Button } from '../ui/button';
import { ChevronDown } from 'lucide-react';

export default function WeekViewDay({ 
  day, 
  events, 
  isToday, 
  client, 
  property, 
  onNewEvent, 
  onEdit, 
  onSync, 
  syncPending 
}) {
  const [expandMore, setExpandMore] = useState(false);
  const maxVisibleEvents = 3;
  const visibleEvents = expandMore ? events : events.slice(0, maxVisibleEvents);
  const moreCount = events.length > maxVisibleEvents ? events.length - maxVisibleEvents : 0;

  return (
    <div
      className={`flex-1 border-r border-[var(--border-color)] last:border-r-0 p-3 space-y-2 min-h-[400px] md:min-h-[600px] cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors ${
        isToday ? 'bg-[#22c55e]/10' : 'bg-[var(--bg-card)]'
      }`}
      onClick={() => onNewEvent(day)}
    >
      {/* Empty state */}
      {events.length === 0 && (
        <div className="text-center text-[var(--text-muted)] text-sm py-12">
          Sem eventos
        </div>
      )}

      {/* Events */}
      <div onClick={(e) => e.stopPropagation()}>
        {visibleEvents.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            client={client}
            property={property}
            onEdit={onEdit}
            onSync={onSync}
            syncPending={syncPending}
            isCompact={true}
          />
        ))}
      </div>

      {/* More indicator */}
      {moreCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setExpandMore(!expandMore);
          }}
          className="w-full text-xs text-[#22c55e] hover:bg-[#22c55e]/10 h-8 rounded-lg"
        >
          <ChevronDown className={`w-3 h-3 mr-1 transition-transform ${expandMore ? 'rotate-180' : ''}`} />
          +{moreCount} evento{moreCount > 1 ? 's' : ''}
        </Button>
      )}
    </div>
  );
}
