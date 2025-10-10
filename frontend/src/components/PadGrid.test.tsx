import { render, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { PadGrid } from './PadGrid'
import { useStore } from '../store'
import { decodeArrayBuffer } from '../audio/SamplePlayer'
import { setBuffer } from '../audio/BufferStore'

vi.mock('../store', () => ({
  useStore: vi.fn(),
}))
vi.mock('../audio/Engine', () => ({
  engine: {
    resume: vi.fn().mockResolvedValue(undefined),
    ctx: { currentTime: 0 },
  },
}))

vi.mock('../audio/SamplePlayer', () => ({
  decodeArrayBuffer: vi.fn(() =>
    Promise.resolve({
      duration: 1.5,
      sampleRate: 44100,
    })
  ),
  playBuffer: vi.fn(),
}))

vi.mock('../audio/BufferStore', () => ({
  getBuffer: vi.fn(),
  setBuffer: vi.fn(),
}))

describe('PadGrid', () => {
  let setPad: Mock
  let setSelectedPad: Mock
  const mockedUseStore = useStore as unknown as Mock

  beforeEach(() => {
    vi.clearAllMocks()
    mockedUseStore.mockReset()

    setPad = vi.fn()
    setSelectedPad = vi.fn()

    const pads = [
      {
        id: 'pad-1',
        name: 'Pad 1',
        gain: 1,
        attack: 0,
        decay: 0,
        startOffset: 0,
        loop: false,
        sample: undefined,
      },
    ]

    mockedUseStore.mockImplementation(
      (selector: (state: any) => any) =>
        selector({
          pads,
          setPad,
          selectedPadId: 'pad-1',
          setSelectedPad,
        })
    )
  })

  it('loads the same file twice after resetting the input value', async () => {
    globalThis.URL.createObjectURL = vi.fn()

    const { container } = render(<PadGrid />)

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(input).toBeTruthy()

    const mockFile = new File(['sample-data'], 'sound.wav', { type: 'audio/wav' })
    const arrayBufferSpy = vi.fn(() => Promise.resolve(new ArrayBuffer(8)))
    Object.defineProperty(mockFile, 'arrayBuffer', {
      value: arrayBufferSpy,
    })

    fireEvent.change(input, { target: { files: [mockFile] } })
    await waitFor(() => expect(setPad).toHaveBeenCalledTimes(1))

    fireEvent.change(input, { target: { files: [mockFile] } })
    await waitFor(() => expect(setPad).toHaveBeenCalledTimes(2))

    expect(arrayBufferSpy).toHaveBeenCalledTimes(2)

    const mockedDecodeArrayBuffer = decodeArrayBuffer as unknown as Mock
    const mockedSetBuffer = setBuffer as unknown as Mock

    expect(mockedDecodeArrayBuffer.mock.calls).toHaveLength(2)
    expect(mockedSetBuffer.mock.calls).toHaveLength(2)
  })
})
