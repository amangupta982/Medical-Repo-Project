import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import StatusBadge from './StatusBadge';

test('renders success status badge with correct text', () => {
  render(<StatusBadge level="success" />);
  
  const badge = screen.getByText('success');
  expect(badge).toBeInTheDocument();
  expect(badge).toHaveClass('badge success');
});

test('renders warning status badge', () => {
  render(<StatusBadge level="warning" />);
  
  const badge = screen.getByText('warning');
  expect(badge).toBeInTheDocument();
});

test('renders error status badge', () => {
  render(<StatusBadge level="error" size="large" />);
  
  const badge = screen.getByText('error');
  expect(badge).toBeInTheDocument();
  expect(badge).toHaveClass('badge error badge-lg');
});
