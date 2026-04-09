import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import ClientDetail from './ClientDetail';
import { render } from '@testing-library/react';

vi.mock('../lib/AuthContextJWT', () => {
  return {
    useAuth: () => ({ user: { email: 'admin@duovet.app' } })
  };
});

describe('ClientDetail', () => {
  it('renderiza sem falhar', () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ClientDetail />
        </MemoryRouter>
      </QueryClientProvider>
    );
  });
});
