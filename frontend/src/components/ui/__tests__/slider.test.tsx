import { render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const rootPropsSpy = vi.fn()

vi.mock("@radix-ui/react-slider", async () => {
  const React = await vi.importActual<typeof import("react")>("react")

  const Root = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    (props, ref) => {
      rootPropsSpy(props)

      return (
        <div ref={ref} data-testid="slider-root" {...props}>
          {props.children}
        </div>
      )
    }
  )

  const createSimpleComponent = (testId: string) =>
    React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => (
      <div ref={ref} data-testid={testId} {...props}>
        {props.children}
      </div>
    ))

  return {
    __esModule: true,
    Root,
    Track: createSimpleComponent("slider-track"),
    Range: createSimpleComponent("slider-range"),
    Thumb: createSimpleComponent("slider-thumb"),
  }
})

import { Slider } from "../slider"

describe("Slider", () => {
  beforeEach(() => {
    rootPropsSpy.mockClear()
  })

  it("forwards onValueChange to SliderPrimitive.Root", () => {
    const handleValueChange = vi.fn()

    render(<Slider onValueChange={handleValueChange} defaultValue={[50]} />)

    expect(rootPropsSpy).toHaveBeenCalled()
    const forwardedProps = rootPropsSpy.mock.calls[0][0] as {
      onValueChange?: (value: number[]) => void
    }

    expect(forwardedProps.onValueChange).toBe(handleValueChange)
  })
})
