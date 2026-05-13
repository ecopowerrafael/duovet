import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Consultorias from './Consultorias';
import { render } from '@testing-library/react';

describe('Consultorias', () => {
  it('renderiza sem falhar', () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Consultorias />
        </MemoryRouter>
      </QueryClientProvider>
    );
  });
});
