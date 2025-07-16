import { S3 } from '@/integration/s3'
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const drawOutVideoCutoutScriptTool = createTool({
  id: 'draw-out-video-cutout-script',
  description:
    'Generates a shell script with curl download commands and ffmpeg commands to compose audio and speedpaint videos into a final video',
  inputSchema: z.object({
    audios: z
      .array(z.string())
      .describe(
        'Array of VFS paths to audio files (e.g., ["/scene-1/audio.mp3", "/scene-2/audio.mp3"])',
      ),
    speedpaint_videos: z
      .array(z.string())
      .describe(
        'Array of VFS paths to speedpaint video files (e.g., ["/scene-1/speedpaint.mp4", "/scene-2/speedpaint.mp4"])',
      ),
    output_filename: z
      .string()
      .optional()
      .default('final-video.mp4')
      .describe('Name of the final output video file'),
  }),
  outputSchema: z.object({
    script: z
      .string()
      .describe('Generated shell script containing curl and ffmpeg commands'),
  }),
  execute: async ({ context: input, threadId }) => {
    const { audios, speedpaint_videos, output_filename } = input

    const publicUrl = (key: string) =>
      S3.createPublicUrl({ bucket: 'dev', key: `/${threadId}/${key}` })

    if (audios.length !== speedpaint_videos.length) {
      throw new Error(
        'Number of audio files must match number of speedpaint videos',
      )
    }

    let script = '#!/bin/bash\n\n'
    script += '# Generated video composition script\n'
    script += `# Total scenes: ${audios.length}\n\n`

    // Create download directory
    script += '# Create working directory\n'
    script += 'mkdir -p downloads\n'
    script += 'cd downloads\n\n'

    // Generate curl commands for downloading
    script += '# Download audio files\n'
    audios.forEach((audio, index) => {
      const filename = `audio-${index + 1}.mp3`
      script += `curl -L "${publicUrl(audio)}" -o "${filename}"\n`
    })
    script += '\n'

    script += '# Download speedpaint video files\n'
    speedpaint_videos.forEach((video, index) => {
      const filename = `speedpaint-${index + 1}.mp4`
      script += `curl -L "${publicUrl(video)}" -o "${filename}"\n`
    })
    script += '\n'

    // Generate ffmpeg concat file for videos
    script += '# Create video concat file\n'
    script += 'cat > video_list.txt << EOF\n'
    speedpaint_videos.forEach((_, index) => {
      script += `file 'speedpaint-${index + 1}.mp4'\n`
    })
    script += 'EOF\n\n'

    // Generate ffmpeg concat file for audios
    script += '# Create audio concat file\n'
    script += 'cat > audio_list.txt << EOF\n'
    audios.forEach((_, index) => {
      script += `file 'audio-${index + 1}.mp3'\n`
    })
    script += 'EOF\n\n'

    // Concatenate all videos
    script += '# Concatenate all videos\n'
    script +=
      'ffmpeg -f concat -safe 0 -i video_list.txt -c copy merged_video.mp4\n\n'

    // Concatenate all audios
    script += '# Concatenate all audios\n'
    script +=
      'ffmpeg -f concat -safe 0 -i audio_list.txt -c copy merged_audio.mp3\n\n'

    // Combine video and audio into final output
    script += '# Combine video and audio into final output\n'
    script += `ffmpeg -i merged_video.mp4 -i merged_audio.mp3 -c:v copy -c:a aac -strict experimental "${output_filename}"\n\n`

    // Move final video to parent directory
    script += '# Move final video to parent directory\n'
    script += `mv "${output_filename}" ../\n`
    script += 'cd ..\n\n'

    // Optional cleanup
    script += '# Optional: Clean up temporary files\n'
    script += '# rm -rf downloads\n\n'

    script += `echo "Video composition complete: ${output_filename}"\n`

    return {
      script,
    }
  },
})
