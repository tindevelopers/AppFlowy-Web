import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import RightMenu from './RightMenu';

const mockOpenOrDownload = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/components/app/app.hooks', () => ({
  useAppOutline: () => [],
  useAppView: () => ({ view_id: 'view-id' }),
  useAppViewId: () => 'view-id',
}));

jest.mock('src/components/app/share/ShareButton', () => ({ viewId }: { viewId: string }) => (
  <div data-testid='share-button' data-view-id={viewId} />
));
jest.mock('./FavoriteButton', () => ({ viewId }: { viewId: string }) => (
  <div data-testid='favorite-button' data-view-id={viewId} />
));
jest.mock('./MoreActions', () => ({ viewId }: { viewId: string }) => (
  <div data-testid='more-actions' data-view-id={viewId} />
));
jest.mock('./Users', () => ({
  Users: ({ viewId }: { viewId: string }) => <div data-testid='users' data-view-id={viewId} />,
}));

jest.mock('@/utils/open_schema', () => ({
  openOrDownload: (...args: unknown[]) => mockOpenOrDownload(...args),
}));

describe('RightMenu', () => {
  beforeEach(() => {
    mockOpenOrDownload.mockClear();
  });

  it('renders share, favorite, more-actions, and users when viewId is present', () => {
    render(
      <MemoryRouter initialEntries={['/app/workspace-id/view-id']}>
        <RightMenu />
      </MemoryRouter>
    );

    const shareBtn = screen.queryByTestId('share-button');
    const favBtn = screen.queryByTestId('favorite-button');
    const moreBtn = screen.queryByTestId('more-actions');
    const users = screen.queryByTestId('users');

    expect(shareBtn).not.toBeNull();
    expect(shareBtn?.getAttribute('data-view-id')).toBe('view-id');
    expect(favBtn).not.toBeNull();
    expect(favBtn?.getAttribute('data-view-id')).toBe('view-id');
    expect(moreBtn).not.toBeNull();
    expect(moreBtn?.getAttribute('data-view-id')).toBe('view-id');
    expect(users).not.toBeNull();
  });

  it('calls openOrDownload when the logo button is clicked', () => {
    render(
      <MemoryRouter initialEntries={['/app/workspace-id/view-id']}>
        <RightMenu />
      </MemoryRouter>
    );

    // The logo SVG is rendered inside a button with a MUI Tooltip
    const logoButton = document.querySelector('button svg')?.closest('button');
    expect(logoButton).not.toBeNull();

    fireEvent.click(logoButton!);
    expect(mockOpenOrDownload).toHaveBeenCalledTimes(1);
  });
});
