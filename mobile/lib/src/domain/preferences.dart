class CatalogArtist {
  const CatalogArtist({required this.id, required this.name, this.artworkUrl});

  final String id;
  final String name;
  final String? artworkUrl;

  factory CatalogArtist.fromJson(Map<String, dynamic> json) {
    return CatalogArtist(
      id: json['id'] as String,
      name: json['name'] as String? ?? 'Artist',
      artworkUrl: json['artworkUrl'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'artworkUrl': artworkUrl,
  };
}

class PreferenceCatalogItem {
  const PreferenceCatalogItem({required this.id, required this.name});

  final String id;
  final String name;
}

class UserPreferences {
  const UserPreferences({
    this.favoriteArtists = const [],
    this.favoriteCategories = const [],
    this.preferredLanguages = const [],
    this.preferredMoods = const [],
    this.languageMode = 'prefer',
    this.wifiOnlyDownloads = true,
    this.autoDownloadRecommendations = false,
    this.downloadStarterPack = true,
    this.onboardingCompleted = false,
    this.onboardingVersion = 0,
    this.starterTrackIds = const [],
  });

  final List<CatalogArtist> favoriteArtists;
  final List<PreferenceCatalogItem> favoriteCategories;
  final List<PreferenceCatalogItem> preferredLanguages;
  final List<PreferenceCatalogItem> preferredMoods;
  final String languageMode;
  final bool wifiOnlyDownloads;
  final bool autoDownloadRecommendations;
  final bool downloadStarterPack;
  final bool onboardingCompleted;
  final int onboardingVersion;
  final List<String> starterTrackIds;

  factory UserPreferences.fromJson(Map<String, dynamic> json) {
    return UserPreferences(
      favoriteArtists: _artists(json['favoriteArtists']),
      favoriteCategories: _named(json['favoriteCategories'], 'slug'),
      preferredLanguages: _named(json['preferredLanguages'], 'code'),
      preferredMoods: _named(json['preferredMoods'], 'slug'),
      languageMode: json['languageMode'] as String? ?? 'prefer',
      wifiOnlyDownloads: json['wifiOnlyDownloads'] as bool? ?? true,
      autoDownloadRecommendations:
          json['autoDownloadRecommendations'] as bool? ?? false,
      downloadStarterPack: json['downloadStarterPack'] as bool? ?? true,
      onboardingCompleted: json['onboardingCompleted'] as bool? ?? false,
      onboardingVersion: json['onboardingVersion'] as int? ?? 0,
      starterTrackIds: (json['starterTrackIds'] as List<dynamic>? ?? [])
          .whereType<String>()
          .toList(),
    );
  }

  static List<CatalogArtist> _artists(dynamic raw) {
    return (raw as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(CatalogArtist.fromJson)
        .toList();
  }

  static List<PreferenceCatalogItem> _named(dynamic raw, String idKey) {
    return (raw as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(
          (row) => PreferenceCatalogItem(
            id: row[idKey] as String? ?? '',
            name: row['name'] as String? ?? '',
          ),
        )
        .where((item) => item.id.isNotEmpty)
        .toList();
  }
}
