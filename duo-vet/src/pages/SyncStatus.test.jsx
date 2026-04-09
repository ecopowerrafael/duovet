import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import SyncStatus from './SyncStatus';
import { render } from '@testing-library/react';

describe('SyncStatus', () => {
  it('renderiza sem falhar', () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SyncStatus />
        </MemoryRouter>
      </QueryClientProvider>
    );
  });
});
