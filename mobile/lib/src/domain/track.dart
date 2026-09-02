class TrackSummary {
  const TrackSummary({
    required this.id,
    required this.title,
    required this.durationMs,
    this.artworkUrl,
    this.artistName,
    this.albumTitle,
    this.spdxId,
    this.stream = true,
    this.download = false,
    this.attributionRequired = true,
  });

  final String id;
  final String title;
  final int durationMs;
  final String? artworkUrl;
  final String? artistName;
  final String? albumTitle;
  final String? spdxId;
  final bool stream;
  final bool download;
  final bool attributionRequired;

  factory TrackSummary.fromJson(Map<String, dynamic> json) {
    final artist = json['artist'] as Map<String, dynamic>?;
    final album = json['album'] as Map<String, dynamic>?;
    final license = json['license'] as Map<String, dynamic>?;
    final availability = json['availability'] as Map<String, dynamic>?;
    return TrackSummary(
      id: json['id'] as String,
      title: json['title'] as String? ?? 'Unknown',
      durationMs: json['durationMs'] as int? ?? 0,
      artworkUrl: json['artworkUrl'] as String?,
      artistName: artist?['name'] as String?,
      albumTitle: album?['title'] as String?,
      spdxId: license?['spdxId'] as String?,
      stream: availability?['stream'] as bool? ?? true,
      download: availability?['download'] as bool? ?? false,
      attributionRequired:
          availability?['attributionRequired'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'durationMs': durationMs,
    'artworkUrl': artworkUrl,
    'artist': {'name': artistName},
    'album': {'title': albumTitle},
    'license': {'spdxId': spdxId},
    'availability': {
      'stream': stream,
      'download': download,
      'attributionRequired': attributionRequired,
    },
  };

  static List<TrackSummary> listFrom(dynamic raw) {
    return (raw as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(TrackSummary.fromJson)
        .toList();
  }
}
