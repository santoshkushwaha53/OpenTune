import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/api_client.dart';
import '../data/download_store.dart';
import '../data/session_store.dart';
import '../domain/preferences.dart';
import '../domain/track.dart';

enum OnboardingStep {
  welcome,
  artists,
  categories,
  languages,
  moods,
  summary,
  generating,
  firstTen,
  confirm,
}

final onboardingControllerProvider =
    ChangeNotifierProvider<OnboardingController>((ref) {
      return OnboardingController(
        api: ref.read(apiClientProvider),
        session: ref.read(sessionStoreProvider),
        downloads: ref.read(downloadStoreProvider),
      );
    });

class OnboardingController extends ChangeNotifier {
  OnboardingController({
    required ApiClient api,
    required SessionStore session,
    required DownloadStore downloads,
  }) : _api = api,
       _session = session,
       _downloads = downloads;

  final ApiClient _api;
  final SessionStore _session;
  final DownloadStore _downloads;

  OnboardingStep step = OnboardingStep.welcome;
  String? error;
  bool busy = false;
  String generatingMessage = 'Finding your sound...';

  List<CatalogArtist> artists = [];
  List<Map<String, dynamic>> categories = [];
  List<Map<String, dynamic>> languages = [];
  List<Map<String, dynamic>> moods = [];

  final selectedArtistIds = <String>{};
  final selectedCategorySlugs = <String>{};
  final selectedLanguageCodes = <String>{};
  final selectedMoodSlugs = <String>{};
  final selectedStarterIds = <String>{};

  String languageMode = 'prefer';
  bool wifiOnly = true;
  bool showMoreCategories = false;

  List<TrackSummary> starterTracks = [];
  int estimatedBytes = 0;
  String honestLabel = '';

  static const _generatingCopy = [
    'Finding your sound...',
    'Matching artists...',
    'Finding open music...',
    'Checking download availability...',
    'Building your first playlist...',
    'Almost ready...',
  ];

  int get preferenceIndex {
    switch (step) {
      case OnboardingStep.artists:
        return 1;
      case OnboardingStep.categories:
        return 2;
      case OnboardingStep.languages:
        return 3;
      case OnboardingStep.moods:
        return 4;
      case OnboardingStep.summary:
        return 5;
      default:
        return 0;
    }
  }

  List<CatalogArtist> get selectedArtists =>
      artists.where((artist) => selectedArtistIds.contains(artist.id)).toList();

  List<Map<String, dynamic>> get selectedCategories => categories
      .where((row) => selectedCategorySlugs.contains(row['slug']))
      .toList();

  List<Map<String, dynamic>> get selectedLanguages => languages
      .where((row) => selectedLanguageCodes.contains(row['code']))
      .toList();

  List<Map<String, dynamic>> get selectedMoods =>
      moods.where((row) => selectedMoodSlugs.contains(row['slug'])).toList();

  List<TrackSummary> get downloadableStarter =>
      starterTracks.where((track) => track.download).toList();

  Future<void> loadCatalogs() async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      final fetched = await Future.wait([
        _api.onboardingArtists(),
        _api.onboardingCategories(),
        _api.onboardingLanguages(),
        _api.onboardingMoods(),
      ]);
      artists = fetched[0].map(CatalogArtist.fromJson).toList();
      categories = fetched[1];
      languages = fetched[2];
      moods = fetched[3];
    } catch (_) {
      error = "You're offline. Skip personalization or try again.";
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> searchArtists(String query) async {
    try {
      final rows = await _api.onboardingArtists(query: query);
      artists = rows.map(CatalogArtist.fromJson).toList();
      notifyListeners();
    } catch (_) {
      error = 'Could not search open-catalog artists.';
      notifyListeners();
    }
  }

  Future<void> revealMoreCategories() async {
    showMoreCategories = true;
    categories = await _api.onboardingCategories(more: true);
    notifyListeners();
  }

  void toggleArtist(String id) {
    if (selectedArtistIds.contains(id)) {
      selectedArtistIds.remove(id);
    } else if (selectedArtistIds.length < 15) {
      selectedArtistIds.add(id);
    }
    notifyListeners();
  }

  void clearArtists() {
    selectedArtistIds.clear();
    notifyListeners();
  }

  void toggleSlug(Set<String> target, String id) {
    if (target.contains(id)) {
      target.remove(id);
    } else {
      target.add(id);
    }
    notifyListeners();
  }

  void toggleStarter(String id) {
    if (selectedStarterIds.contains(id)) {
      selectedStarterIds.remove(id);
    } else {
      selectedStarterIds.add(id);
    }
    notifyListeners();
  }

  bool canContinueArtists() => selectedArtistIds.length >= 3;

  bool canContinueCategories() => selectedCategorySlugs.isNotEmpty;

  bool canContinueLanguages() => selectedLanguageCodes.isNotEmpty;

  void back() {
    error = null;
    switch (step) {
      case OnboardingStep.artists:
        step = OnboardingStep.welcome;
      case OnboardingStep.categories:
        step = OnboardingStep.artists;
      case OnboardingStep.languages:
        step = OnboardingStep.categories;
      case OnboardingStep.moods:
        step = OnboardingStep.languages;
      case OnboardingStep.summary:
        step = OnboardingStep.moods;
      case OnboardingStep.firstTen:
        step = OnboardingStep.summary;
      case OnboardingStep.confirm:
        step = OnboardingStep.firstTen;
      default:
        break;
    }
    notifyListeners();
  }

  void go(OnboardingStep next) {
    step = next;
    error = null;
    notifyListeners();
  }

  Future<void> skip() async {
    busy = true;
    notifyListeners();
    try {
      await _api.completeOnboarding(skip: true);
      await _session.markOnboardingDone();
    } catch (_) {
      await _session.markOnboardingDone();
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> persistPreferences() async {
    await _api.savePreferences({
      'artistIds': selectedArtistIds.toList(),
      'categorySlugs': selectedCategorySlugs.toList(),
      'languageCodes': selectedLanguageCodes.toList(),
      'moodSlugs': selectedMoodSlugs.toList(),
      'languageMode': languageMode,
      'wifiOnlyDownloads': wifiOnly,
      'downloadStarterPack': true,
    });
  }

  Future<void> buildPack() async {
    step = OnboardingStep.generating;
    error = null;
    busy = true;
    notifyListeners();
    var tick = 0;
    final timer =
        Stream<int>.periodic(
          const Duration(milliseconds: 700),
          (i) => i,
        ).listen((_) {
          generatingMessage = _generatingCopy[tick % _generatingCopy.length];
          tick += 1;
          notifyListeners();
        });
    try {
      await persistPreferences();
      final pack = await _api.starterPack();
      starterTracks = TrackSummary.listFrom(pack['tracks']);
      estimatedBytes = pack['estimatedBytes'] as int? ?? 0;
      honestLabel =
          pack['honestLabel'] as String? ??
          'We found ${starterTracks.length} tracks available for offline listening.';
      selectedStarterIds
        ..clear()
        ..addAll(downloadableStarter.map((track) => track.id));
      if (starterTracks.isEmpty) {
        error = "Couldn't build your music mix.";
        step = OnboardingStep.summary;
      } else {
        step = OnboardingStep.firstTen;
      }
    } catch (_) {
      error = "Couldn't build your music mix.";
      step = OnboardingStep.summary;
    } finally {
      await timer.cancel();
      busy = false;
      notifyListeners();
    }
  }

  Future<void> confirmAndGoHome() async {
    busy = true;
    notifyListeners();
    try {
      await _api.completeOnboarding();
      final chosen = downloadableStarter
          .where((track) => selectedStarterIds.contains(track.id))
          .toList();
      if (chosen.isNotEmpty) {
        unawaited(() async {
          try {
            await _downloads.startStarterPack(
              tracks: chosen,
              wifiOnly: wifiOnly,
              resolveUrl: _api.downloadSourceUrl,
            );
          } catch (_) {}
        }());
      }
      await _session.markOnboardingDone();
    } catch (_) {
      error = 'Could not finish onboarding.';
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> loadExisting() async {
    try {
      final prefs = UserPreferences.fromJson(await _api.preferences());
      selectedArtistIds
        ..clear()
        ..addAll(prefs.favoriteArtists.map((artist) => artist.id));
      selectedCategorySlugs
        ..clear()
        ..addAll(prefs.favoriteCategories.map((item) => item.id));
      selectedLanguageCodes
        ..clear()
        ..addAll(prefs.preferredLanguages.map((item) => item.id));
      selectedMoodSlugs
        ..clear()
        ..addAll(prefs.preferredMoods.map((item) => item.id));
      languageMode = prefs.languageMode;
      wifiOnly = prefs.wifiOnlyDownloads;
      artists = [...prefs.favoriteArtists, ...artists];
      notifyListeners();
    } catch (_) {}
  }

  void setLanguageMode(String mode) {
    languageMode = mode;
    notifyListeners();
  }

  void setWifiOnly(bool value) {
    wifiOnly = value;
    notifyListeners();
  }
}
