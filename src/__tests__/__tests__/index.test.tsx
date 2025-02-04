import React from 'react';
import { render, screen } from '@testing-library/react';
import Home from '../index';

describe('Home Page', () => {
  it('renders the home page without crashing', () => {
    render(<Home />);
    expect(screen.getByText(/Unleash the power of/i)).toBeInTheDocument();
  });
});