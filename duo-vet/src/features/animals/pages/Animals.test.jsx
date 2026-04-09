import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import Animals from './Animals.jsx';

describe('Página de Animais', () => {
  it('renderiza o título', () => {
    render(<Animals />);
    expect(screen.getByText(/animais/i)).toBeInTheDocument();
  });
});
