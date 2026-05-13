import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Reports from './Reports';
import { render } from '@testing-library/react';

describe('Reports', () => {
  it('renderiza sem falhar', () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Reports />
        </MemoryRouter>
      </QueryClientProvider>
    );
  });
});
