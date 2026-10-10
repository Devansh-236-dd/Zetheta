import { render, screen, fireEvent, act } from '@testing-library/react';
import { PinEntry } from '../../src/components/PinEntry';

describe('PinEntry', () => {
  beforeEach(() => { sessionStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => vi.useRealTimers());

  it('rejects a wrong PIN with tries left, then accepts the demo PIN', () => {
    const ok = vi.fn();
    render(<PinEntry onSuccess={ok} />);
    const input = screen.getByLabelText('Enter your 4-digit Zetheta PIN');
    fireEvent.change(input, { target: { value: '0000' } });
    act(() => { vi.advanceTimersByTime(400); });
    expect(screen.getByText(/2 tries left\. No money has been sent/)).toBeTruthy();
    expect(ok).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '1234' } });
    act(() => { vi.advanceTimersByTime(800); });
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it('offers an OTP alternative that works without the PIN', () => {
    const ok = vi.fn();
    render(<PinEntry onSuccess={ok} />);
    fireEvent.click(screen.getByText('Use a one-time code (OTP) instead'));
    fireEvent.click(screen.getByText('Fill code from SMS'));
    act(() => { vi.advanceTimersByTime(800); });
    expect(ok).toHaveBeenCalledTimes(1);
  });
});
