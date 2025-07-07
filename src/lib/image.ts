import sharp from 'sharp'

export type ImageInput = string | Buffer | Uint8Array

export type QuadrantResult = {
  topLeft: Buffer
  topRight: Buffer
  bottomLeft: Buffer
  bottomRight: Buffer
}

export type QuadrantPosition =
  | 'topLeft'
  | 'topRight'
  | 'bottomLeft'
  | 'bottomRight'

export const splitImageToQuadrants = async (
  input: ImageInput,
): Promise<QuadrantResult> => {
  const { width, height } = await sharp(input).metadata()

  if (!width || !height) {
    throw new Error('Unable to determine image dimensions')
  }

  const halfWidth = Math.floor(width / 2)
  const halfHeight = Math.floor(height / 2)

  const [topLeft, topRight, bottomLeft, bottomRight] = await Promise.all([
    sharp(input)
      .extract({ left: 0, top: 0, width: halfWidth, height: halfHeight })
      .toBuffer(),
    sharp(input)
      .extract({
        left: halfWidth,
        top: 0,
        width: halfWidth,
        height: halfHeight,
      })
      .toBuffer(),
    sharp(input)
      .extract({
        left: 0,
        top: halfHeight,
        width: halfWidth,
        height: halfHeight,
      })
      .toBuffer(),
    sharp(input)
      .extract({
        left: halfWidth,
        top: halfHeight,
        width: halfWidth,
        height: halfHeight,
      })
      .toBuffer(),
  ])

  return {
    topLeft,
    topRight,
    bottomLeft,
    bottomRight,
  }
}

export const splitImageToQuadrantArray = async (
  input: ImageInput,
): Promise<Buffer[]> => {
  const result = await splitImageToQuadrants(input)
  return [
    result.topLeft,
    result.topRight,
    result.bottomLeft,
    result.bottomRight,
  ]
}

export const getQuadrantByPosition = async (
  input: ImageInput,
  position: QuadrantPosition,
): Promise<Buffer> => {
  const result = await splitImageToQuadrants(input)
  return result[position]
}

export const resizeImage = async (
  input: ImageInput,
  width: number,
  height?: number,
): Promise<Buffer> => {
  return sharp(input).resize(width, height).toBuffer()
}

export const getImageMetadata = async (
  input: ImageInput,
): Promise<{ width: number; height: number; format?: string }> => {
  const metadata = await sharp(input).metadata()

  if (!metadata.width || !metadata.height) {
    throw new Error('Unable to determine image dimensions')
  }

  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
  }
}
