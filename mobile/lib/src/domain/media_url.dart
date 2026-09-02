/// Playback may only load provider-hosted URLs or local files — never API media.
bool isOpenTuneApiAudioUrl(String url) {
  final uri = Uri.tryParse(url);
  if (uri == null) {
    return false;
  }
  return uri.path.contains('/api/v1/audio');
}

bool isRemoteProviderUrl(String url) {
  final uri = Uri.tryParse(url);
  if (uri == null || (uri.scheme != 'https' && uri.scheme != 'http')) {
    return false;
  }
  return !isOpenTuneApiAudioUrl(url);
}
