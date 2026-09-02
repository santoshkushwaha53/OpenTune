enum DownloadState { queued, downloading, failed, completed }

class DownloadRecord {
  const DownloadRecord({
    required this.trackId,
    required this.path,
    required this.title,
    this.bytes,
    this.progress = 0,
    this.state = DownloadState.queued,
    this.license,
    this.attribution,
    this.checksum,
    this.downloadedAt,
    this.error,
    this.artistName,
    this.artworkUrl,
    this.artworkPath,
    this.durationMs,
  });

  final String trackId;
  final String path;
  final String title;
  final int? bytes;
  final double progress;
  final DownloadState state;
  final String? license;
  final String? attribution;
  final String? checksum;
  final DateTime? downloadedAt;
  final String? error;
  final String? artistName;
  final String? artworkUrl;
  final String? artworkPath;
  final int? durationMs;

  bool get isCompleted => state == DownloadState.completed;

  DownloadRecord copyWith({
    String? path,
    String? title,
    int? bytes,
    double? progress,
    DownloadState? state,
    String? license,
    String? attribution,
    String? checksum,
    DateTime? downloadedAt,
    String? error,
    String? artistName,
    String? artworkUrl,
    String? artworkPath,
    int? durationMs,
    bool clearError = false,
  }) {
    return DownloadRecord(
      trackId: trackId,
      path: path ?? this.path,
      title: title ?? this.title,
      bytes: bytes ?? this.bytes,
      progress: progress ?? this.progress,
      state: state ?? this.state,
      license: license ?? this.license,
      attribution: attribution ?? this.attribution,
      checksum: checksum ?? this.checksum,
      downloadedAt: downloadedAt ?? this.downloadedAt,
      error: clearError ? null : error ?? this.error,
      artistName: artistName ?? this.artistName,
      artworkUrl: artworkUrl ?? this.artworkUrl,
      artworkPath: artworkPath ?? this.artworkPath,
      durationMs: durationMs ?? this.durationMs,
    );
  }

  Map<String, dynamic> toJson() => {
    'trackId': trackId,
    'path': path,
    'title': title,
    'bytes': bytes,
    'state': state.name,
    'license': license,
    'attribution': attribution,
    'checksum': checksum,
    'downloadedAt': downloadedAt?.toIso8601String(),
    'artistName': artistName,
    'artworkUrl': artworkUrl,
    'artworkPath': artworkPath,
    'durationMs': durationMs,
  };

  Map<String, dynamic> toTrackJson() => {
    'id': trackId,
    'title': title,
    'durationMs': durationMs ?? 0,
    'artworkUrl': artworkPath ?? artworkUrl,
    'artist': {'name': artistName},
    'license': {'spdxId': license},
    'availability': {
      'stream': true,
      'download': true,
      'attributionRequired': attribution != null && attribution!.isNotEmpty,
    },
  };

  factory DownloadRecord.fromJson(Map<String, dynamic> json) {
    final stateName = json['state'] as String?;
    final state = DownloadState.values.firstWhere(
      (value) => value.name == stateName,
      orElse: () => DownloadState.completed,
    );
    return DownloadRecord(
      trackId: json['trackId'] as String,
      path: json['path'] as String,
      title: json['title'] as String? ?? 'Track',
      bytes: json['bytes'] as int?,
      progress: state == DownloadState.completed ? 1 : 0,
      state: state,
      license: json['license'] as String?,
      attribution: json['attribution'] as String?,
      checksum: json['checksum'] as String?,
      downloadedAt: DateTime.tryParse(json['downloadedAt'] as String? ?? ''),
      artistName: json['artistName'] as String?,
      artworkUrl: json['artworkUrl'] as String?,
      artworkPath: json['artworkPath'] as String?,
      durationMs: json['durationMs'] as int?,
    );
  }
}

class DownloadRejected implements Exception {
  DownloadRejected(this.message);
  final String message;

  @override
  String toString() => message;
}
