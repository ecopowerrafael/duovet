import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Plans from './Plans';
import { render } from '@testing-library/react';

describe('Plans', () => {
  it('renderiza sem falhar', () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Plans />
        </MemoryRouter>
      </QueryClientProvider>
    );
  });
});
