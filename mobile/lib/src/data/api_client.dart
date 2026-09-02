import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../domain/track.dart';
import 'catalog_cache.dart';
import 'offline_store.dart';

/// Override at build time: `--dart-define=API_BASE_URL=https://opentune-api.onrender.com`
const kApiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://127.0.0.1:3000',
);

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(offline: ref.read(offlineStoreProvider));
});

class ApiClient {
  ApiClient({
    Dio? dio,
    this.baseUrl = kApiBaseUrl,
    FlutterSecureStorage? storage,
    CatalogCache? cache,
    OfflineStore? offline,
  }) : _dio =
           dio ??
           Dio(
             BaseOptions(
               baseUrl: baseUrl,
               connectTimeout: const Duration(seconds: 30),
               receiveTimeout: const Duration(seconds: 30),
             ),
           ),
       _storage = storage ?? const FlutterSecureStorage(),
       _cache = cache ?? CatalogCache(),
       _offline = offline;

  final Dio _dio;
  final String baseUrl;
  final FlutterSecureStorage _storage;
  final CatalogCache _cache;
  final OfflineStore? _offline;

  Future<void> _attachAuth() async {
    try {
      final token = await _storage.read(key: 'accessToken');
      if (token != null) {
        _dio.options.headers['Authorization'] = 'Bearer $token';
      } else {
        _dio.options.headers.remove('Authorization');
      }
    } catch (_) {
      // Secure storage is unavailable in some test environments.
    }
  }

  Future<void> _storeTokens(Map<String, dynamic> data) async {
    final tokens = data['tokens'] as Map<String, dynamic>?;
    if (tokens == null) {
      return;
    }
    await _storage.write(
      key: 'accessToken',
      value: tokens['accessToken'] as String,
    );
    await _storage.write(
      key: 'refreshToken',
      value: tokens['refreshToken'] as String,
    );
  }

  Future<bool> hasSession() async {
    try {
      return await _storage.read(key: 'accessToken') != null;
    } catch (_) {
      return false;
    }
  }

  Future<void> logout() async {
    try {
      await _attachAuth();
      final refresh = await _storage.read(key: 'refreshToken');
      if (refresh != null) {
        await _dio.post<Map<String, dynamic>>(
          '/api/v1/auth/logout',
          data: {'refreshToken': refresh},
        );
      }
    } catch (_) {
      // Best-effort revoke.
    }
    try {
      await _storage.delete(key: 'accessToken');
      await _storage.delete(key: 'refreshToken');
    } catch (_) {}
    _dio.options.headers.remove('Authorization');
  }

  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/v1/auth/login',
      data: {'email': email, 'password': password},
    );
    final data = response.data ?? {};
    await _storeTokens(data);
    return data;
  }

  Future<Map<String, dynamic>> register({
    required String email,
    required String username,
    required String password,
    required String displayName,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/v1/auth/register',
      data: {
        'email': email,
        'username': username,
        'password': password,
        'displayName': displayName,
      },
    );
    final data = response.data ?? {};
    await _storeTokens(data);
    return data;
  }

  Future<List<TrackSummary>> search(String query) async {
    final q = query.trim();
    if (q.isEmpty) {
      return [];
    }
    if (_offline?.offline == true) {
      return [];
    }
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/api/v1/search',
        queryParameters: {'q': q},
      );
      _offline?.enterOnline();
      return TrackSummary.listFrom(response.data?['results']);
    } on DioException {
      _offline?.enterOffline();
      rethrow;
    }
  }

  Future<List<TrackSummary>> trending() async {
    if (_offline?.offline == true) {
      return [];
    }
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/api/v1/discovery/trending',
      );
      _offline?.enterOnline();
      return TrackSummary.listFrom(response.data?['results']);
    } on DioException {
      _offline?.enterOffline();
      return [];
    }
  }

  Future<List<String>> genres() async {
    if (_offline?.offline == true) {
      return [];
    }
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/api/v1/discovery/genres',
      );
      _offline?.enterOnline();
      final rows = response.data?['genres'] as List<dynamic>? ?? [];
      return rows
          .whereType<Map<String, dynamic>>()
          .map((row) => row['name'] as String? ?? '')
          .where((name) => name.isNotEmpty)
          .toList();
    } on DioException {
      _offline?.enterOffline();
      return [];
    }
  }

  Future<Map<String, dynamic>> home() async {
    if (_offline?.offline == true) {
      return await _cache.readHome() ??
          {
            'greeting': 'Discover open music',
            'recommended': <dynamic>[],
            'offline': true,
          };
    }
    try {
      await _attachAuth();
      final response = await _dio.get<Map<String, dynamic>>(
        '/api/v1/discovery/home',
      );
      final data = response.data ?? {};
      await _cache.writeHome(data);
      _offline?.enterOnline();
      return data;
    } on DioException {
      _offline?.enterOffline();
      return await _cache.readHome() ??
          {
            'greeting': 'Discover open music',
            'recommended': <dynamic>[],
            'offline': true,
          };
    }
  }

  Future<Map<String, dynamic>> track(String id) async {
    final response = await _dio.get<Map<String, dynamic>>('/api/v1/tracks/$id');
    return response.data ?? {};
  }

  Future<Map<String, dynamic>> trackSources(String id) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/tracks/$id/sources',
    );
    return response.data ?? {};
  }

  Future<Map<String, dynamic>> artist(String id) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/artists/$id',
    );
    return response.data ?? {};
  }

  Future<Map<String, dynamic>> album(String id) async {
    final response = await _dio.get<Map<String, dynamic>>('/api/v1/albums/$id');
    return response.data ?? {};
  }

  Future<String?> downloadSourceUrl(String trackId) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/downloads/$trackId/source',
    );
    return response.data?['downloadUrl'] as String?;
  }

  Future<Map<String, dynamic>> library() async {
    if (_offline?.offline == true) {
      return {
        'favorites': <dynamic>[],
        'playlists': <dynamic>[],
        'recents': <dynamic>[],
        'offline': true,
      };
    }
    try {
      await _attachAuth();
      final response = await _dio.get<Map<String, dynamic>>('/api/v1/library');
      _offline?.enterOnline();
      return response.data ?? {};
    } on DioException {
      _offline?.enterOffline();
      return {
        'favorites': <dynamic>[],
        'playlists': <dynamic>[],
        'recents': <dynamic>[],
        'offline': true,
      };
    }
  }

  Future<void> setFavorite(String trackId, {required bool favorite}) async {
    await _attachAuth();
    if (favorite) {
      await _dio.put('/api/v1/library/favorites/$trackId');
    } else {
      await _dio.delete('/api/v1/library/favorites/$trackId');
    }
  }

  Future<List<dynamic>> favorites() async {
    await _attachAuth();
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/library/favorites',
    );
    return response.data?['favorites'] as List<dynamic>? ?? [];
  }

  Future<Map<String, dynamic>> createPlaylist(String title) async {
    await _attachAuth();
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/v1/playlists',
      data: {'title': title, 'visibility': 'private'},
    );
    return response.data ?? {};
  }

  Future<Map<String, dynamic>> playlist(String id) async {
    await _attachAuth();
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/playlists/$id',
    );
    return response.data ?? {};
  }

  Future<Map<String, dynamic>> sharedPlaylist(String token) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/playlists/shared/$token',
    );
    return response.data ?? {};
  }

  Future<void> addPlaylistTrack(String playlistId, String trackId) async {
    await _attachAuth();
    await _dio.post(
      '/api/v1/playlists/$playlistId/tracks',
      data: {'trackId': trackId},
    );
  }

  Future<void> removePlaylistTrack(String playlistId, String trackId) async {
    await _attachAuth();
    await _dio.delete('/api/v1/playlists/$playlistId/tracks/$trackId');
  }

  Future<Map<String, dynamic>> reorderPlaylistTracks(
    String playlistId,
    List<String> trackIds,
  ) async {
    await _attachAuth();
    final response = await _dio.patch<Map<String, dynamic>>(
      '/api/v1/playlists/$playlistId/tracks',
      data: {'trackIds': trackIds},
    );
    return response.data ?? {};
  }

  Future<Map<String, dynamic>> updatePlaylist(
    String playlistId, {
    String? title,
    String? description,
  }) async {
    await _attachAuth();
    final response = await _dio.patch<Map<String, dynamic>>(
      '/api/v1/playlists/$playlistId',
      data: {?title: title, ?description: description},
    );
    return response.data ?? {};
  }

  Future<void> deletePlaylist(String playlistId) async {
    await _attachAuth();
    await _dio.delete('/api/v1/playlists/$playlistId');
  }

  Future<Map<String, dynamic>> sharePlaylist(String playlistId) async {
    await _attachAuth();
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/v1/playlists/$playlistId/share',
    );
    return response.data ?? {};
  }

  Future<void> revokePlaylistShares(String playlistId) async {
    await _attachAuth();
    await _dio.delete('/api/v1/playlists/$playlistId/shares');
  }

  Future<Map<String, dynamic>> forkPlaylist(String playlistId) async {
    await _attachAuth();
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/v1/playlists/$playlistId/fork',
    );
    return response.data ?? {};
  }

  Future<Map<String, dynamic>> forkSharedPlaylist(String token) async {
    await _attachAuth();
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/v1/playlists/shared/$token/fork',
    );
    return response.data ?? {};
  }

  Future<void> recordPlay(String trackId) async {
    try {
      await _attachAuth();
      await _dio.post(
        '/api/v1/library/plays',
        data: {'trackId': trackId, 'durationPlayedMs': 0, 'context': 'queue'},
      );
    } catch (_) {}
  }

  Future<List<Map<String, dynamic>>> providers() async {
    final response = await _dio.get<Map<String, dynamic>>('/api/v1/providers');
    final list = response.data?['providers'] as List<dynamic>? ?? [];
    return [
      for (final row in list)
        if (row is Map<String, dynamic>) row,
    ];
  }

  Future<Map<String, dynamic>> report({
    required String entityType,
    required String entityId,
    required String reason,
  }) async {
    await _attachAuth();
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/v1/reports',
      data: {'entityType': entityType, 'entityId': entityId, 'reason': reason},
    );
    return response.data ?? {};
  }

  Future<Map<String, dynamic>> me() async {
    await _attachAuth();
    final response = await _dio.get<Map<String, dynamic>>('/api/v1/users/me');
    return response.data ?? {};
  }

  Future<Map<String, dynamic>> preferences() async {
    await _attachAuth();
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/users/me/preferences',
    );
    return response.data ?? {};
  }

  Future<Map<String, dynamic>> savePreferences(
    Map<String, dynamic> body,
  ) async {
    await _attachAuth();
    final response = await _dio.put<Map<String, dynamic>>(
      '/api/v1/users/me/preferences',
      data: body,
    );
    return response.data ?? {};
  }

  Future<Map<String, dynamic>> completeOnboarding({bool skip = false}) async {
    await _attachAuth();
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/v1/onboarding/complete',
      data: {'skip': skip},
    );
    return response.data ?? {};
  }

  Future<List<Map<String, dynamic>>> onboardingArtists({String? query}) async {
    await _attachAuth();
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/onboarding/artists',
      queryParameters: {
        if (query != null && query.trim().isNotEmpty) 'q': query,
      },
    );
    return [
      for (final row in response.data?['artists'] as List<dynamic>? ?? [])
        if (row is Map<String, dynamic>) row,
    ];
  }

  Future<List<Map<String, dynamic>>> onboardingCategories({
    bool more = false,
  }) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/onboarding/categories',
      queryParameters: {if (more) 'more': 'true'},
    );
    return [
      for (final row in response.data?['categories'] as List<dynamic>? ?? [])
        if (row is Map<String, dynamic>) row,
    ];
  }

  Future<List<Map<String, dynamic>>> onboardingLanguages() async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/onboarding/languages',
    );
    return [
      for (final row in response.data?['languages'] as List<dynamic>? ?? [])
        if (row is Map<String, dynamic>) row,
    ];
  }

  Future<List<Map<String, dynamic>>> onboardingMoods() async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/onboarding/moods',
    );
    return [
      for (final row in response.data?['moods'] as List<dynamic>? ?? [])
        if (row is Map<String, dynamic>) row,
    ];
  }

  Future<Map<String, dynamic>> starterPack() async {
    await _attachAuth();
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/v1/recommendations/starter-pack',
    );
    return response.data ?? {};
  }
}
