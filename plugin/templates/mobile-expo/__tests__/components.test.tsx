import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ArcDial } from '../src/components/ArcDial';
import { ReserveSlider } from '../src/components/ReserveSlider';
import { OfflineBanner } from '../src/components/ui';
import { store } from '../src/store';

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View, SafeAreaProvider: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

beforeEach(async () => {
  await act(async () => store.reset());
});

describe('ReserveSlider', () => {
  async function setup(initial = 30) {
    const onChange = jest.fn();
    // Gestures need the same root view the app mounts in app/_layout.tsx.
    await render(
      <GestureHandlerRootView>
        <ReserveSlider value={initial} onChange={onChange} />
      </GestureHandlerRootView>,
    );
    return onChange;
  }
  it('offers single-tap alternatives to dragging', async () => {
    const onChange = await setup(30);
    await fireEvent.press(screen.getByTestId('reserve-more'));
    expect(onChange).toHaveBeenLastCalledWith(35);
    await fireEvent.press(screen.getByTestId('reserve-less'));
    expect(onChange).toHaveBeenLastCalledWith(25);
  });
  it('clamps at the ends', async () => {
    const lo = await setup(10);
    await fireEvent.press(screen.getByTestId('reserve-less'));
    expect(lo).toHaveBeenLastCalledWith(10);
  });
  it('is adjustable by assistive technology', async () => {
    const onChange = await setup(50);
    const slider = screen.getByTestId('reserve-slider');
    expect(slider.props.accessibilityRole).toBe('adjustable');
    expect(slider.props.accessibilityValue).toMatchObject({ min: 10, max: 100, now: 50, text: '50%' });
    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).toHaveBeenLastCalledWith(55);
    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onChange).toHaveBeenLastCalledWith(45);
  });
  it('shows the current value', async () => {
    await setup(65);
    expect(screen.getByTestId('reserve-value')).toHaveTextContent('65%');
  });
});

describe('ArcDial', () => {
  it('describes itself in words', async () => {
    await render(<ArcDial hour={13} battery={82} />);
    expect(screen.getByLabelText('Battery at 82 percent at 13:00')).toBeTruthy();
  });
  it('uses the active language', async () => {
    await act(async () => store.set({ locale: 'ar' }));
    await render(<ArcDial hour={6.5} battery={40} />);
    expect(screen.getByTestId('arc-dial').props.accessibilityLabel).toMatch(/40/);
    expect(screen.getByTestId('arc-dial').props.accessibilityLabel).toMatch(/[؀-ۿ]/);
  });
});

describe('OfflineBanner', () => {
  it('announces itself and reconnects', async () => {
    await act(async () => store.set({ online: false }));
    await render(<OfflineBanner />);
    expect(screen.getByTestId('offline-banner').props.accessibilityRole).toBe('alert');
    await fireEvent.press(screen.getByTestId('reconnect'));
    expect(store.get().online).toBe(true);
  });
});
