# YouTube connector (stream only)

Official [YouTube Data API v3](https://developers.google.com/youtube/v3) search and video metadata only. Set `YOUTUBE_API_KEY` to enable.

The connector:

- Searches embeddable, syndicated videos
- Returns `https://www.youtube.com/watch?v={id}` for the Flutter **official YouTube player**
- Sets `supportsDownload: false` — OpenTune never invents an MP3 or extracts audio
- Never fetches audio or video bytes on the API

Playback happens on the user device inside YouTube’s player. OpenTune controls play, pause, seek, and next. Background audio-only extraction is not supported.

CI uses recorded JSON fixtures. Do not put live secrets in tests.
