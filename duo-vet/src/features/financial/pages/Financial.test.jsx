import React from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Financial from './Financial';

describe('Financial', () => {
  it('renders without crashing', () => {
    const queryClient = new QueryClient();
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <Financial />
        </QueryClientProvider>
      </MemoryRouter>
    );
  });
});
