import React from 'react';
import { render, screen } from '@testing-library/react';
import { LandingPage } from '../landing-page';

describe('LandingPage Component', () => {
  it('renders the landing page without crashing', () => {
    render(<LandingPage />);
    expect(screen.getByText(/Create Your Assistant/i)).toBeInTheDocument();
  });
});