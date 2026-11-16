import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppShell } from './AppShell'

test('renders the decorative Signal Aperture mark beside the unchanged wordmark', () => {
  render(<MemoryRouter><AppShell /></MemoryRouter>)

  const wordmark = screen.getByText('ReturnLens')
  const brand = wordmark.closest('.brand')
  const mark = brand?.querySelector('svg.brand-mark')

  expect(brand).not.toBeNull()
  expect(mark).toHaveAttribute('viewBox', '0 0 32 32')
  expect(mark).toHaveAttribute('aria-hidden', 'true')
  expect(mark).toHaveAttribute('focusable', 'false')
  expect(within(brand as HTMLElement).queryByText('R')).not.toBeInTheDocument()
})
