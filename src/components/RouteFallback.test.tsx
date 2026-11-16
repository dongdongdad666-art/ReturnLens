import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { RouteFallback } from './RouteFallback'

test('announces route loading and reserves page geometry', () => {
  const { container } = render(<RouteFallback />)
  expect(screen.getByRole('status', { name: '正在加载页面' })).toBeInTheDocument()
  expect(container.querySelector('.route-fallback-grid')).toBeInTheDocument()
})
