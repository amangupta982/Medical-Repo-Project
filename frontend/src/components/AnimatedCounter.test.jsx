import { render, screen, waitFor } from '@testing-library/react';
import { expect, test } from 'vitest';
import AnimatedCounter from './AnimatedCounter';

test('renders initial value and updates to target value', async () => {
  render(<AnimatedCounter value={100} duration={0.1} />);
  
  // Wait for the animation to finish (duration is 0.1s, so 100ms)
  await waitFor(() => {
    expect(screen.getByText('100')).toBeInTheDocument();
  }, { timeout: 1000 });
});

test('handles formatting correctly', async () => {
  render(<AnimatedCounter value={1500} prefix="$" suffix="K" duration={0.1} />);
  
  await waitFor(() => {
    // 1500 might be formatted with commas depending on implementation, but basic check:
    expect(screen.getByText(/\$1,?500K/)).toBeInTheDocument();
  }, { timeout: 1000 });
});
