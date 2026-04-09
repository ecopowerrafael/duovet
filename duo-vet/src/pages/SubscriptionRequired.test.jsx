import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import SubscriptionRequired from './SubscriptionRequired';
import { render } from '@testing-library/react';

describe('SubscriptionRequired', () => {
  it('renderiza sem falhar', () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SubscriptionRequired 
            reason="trial_expired" 
            message="Teste necessário"
            trialEndDate={new Date().toISOString()}
            organization={{ name: 'Org Demo' }}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );
  });
});
