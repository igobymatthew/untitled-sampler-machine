import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import App from './App'

describe('App integration', () => {
  it('renders shadcn sidebar components alongside the sampler UI', () => {
    render(<App />)

    expect(screen.getByText('Acme Inc.')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Documents' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Transport')).toBeInTheDocument()
  })

  it('allows collapsing the sidebar with the trigger control', async () => {
    const { container } = render(<App />)

    const sidebar = container.querySelector('[data-slot="sidebar"]')
    expect(sidebar).not.toBeNull()
    expect(sidebar).toHaveAttribute('data-state', 'expanded')

    const trigger = screen.getByRole('button', { name: /toggle sidebar/i })
    fireEvent.click(trigger)

    await waitFor(() =>
      expect(sidebar).toHaveAttribute('data-state', 'collapsed'),
    )
  })
})
