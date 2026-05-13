import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Clients from './Clients.jsx';

describe('Página de Clientes', () => {
  it('renderiza o título', () => {
    render(<Clients />);
    expect(screen.getByText(/clientes/i)).toBeInTheDocument();
  });
});