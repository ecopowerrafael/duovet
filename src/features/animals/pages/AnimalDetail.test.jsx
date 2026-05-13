import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import AnimalDetail from './AnimalDetail.jsx';

describe('Página de Detalhe do Animal', () => {
  it('renderiza o título', () => {
    render(<AnimalDetail />);
    expect(screen.getByText(/animal/i)).toBeInTheDocument();
  });
});
