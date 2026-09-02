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

/// Official YouTube watch URL. Playback uses YouTube's player, never a downloaded file.
String? youtubeVideoId(String? url) {
  if (url == null || url.isEmpty) {
    return null;
  }
  final uri = Uri.tryParse(url);
  if (uri == null || (uri.scheme != 'https' && uri.scheme != 'http')) {
    return null;
  }
  final host = uri.host.toLowerCase();
  if (host == 'youtu.be') {
    final id = uri.pathSegments.isEmpty ? '' : uri.pathSegments.first;
    return _validYoutubeId(id);
  }
  if (host == 'youtube.com' ||
      host == 'www.youtube.com' ||
      host == 'm.youtube.com') {
    return _validYoutubeId(uri.queryParameters['v']);
  }
  return null;
}

bool isYoutubeWatchUrl(String url) => youtubeVideoId(url) != null;

String? _validYoutubeId(String? value) {
  final id = value?.trim() ?? '';
  if (RegExp(r'^[A-Za-z0-9_-]{11}$').hasMatch(id)) {
    return id;
  }
  return null;
}
