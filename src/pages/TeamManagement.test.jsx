import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import TeamManagement from './TeamManagement';
import { render } from '@testing-library/react';

describe('TeamManagement', () => {
  it('renderiza sem falhar', () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TeamManagement />
        </MemoryRouter>
      </QueryClientProvider>
    );
  });
});
