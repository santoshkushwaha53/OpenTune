import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/api_client.dart';
import '../data/offline_store.dart';
import '../data/session_store.dart';

final homeProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  ref.watch(sessionStoreProvider);
  ref.watch(offlineStoreProvider);
  final data = Map<String, dynamic>.from(
    await ref.read(apiClientProvider).home(),
  );
  if (ref.read(offlineStoreProvider).offline) {
    data['offline'] = true;
  }
  return data;
});

final libraryProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  ref.watch(offlineStoreProvider);
  final session = ref.watch(sessionStoreProvider);
  if (!session.loggedIn) {
    return {
      'favorites': <dynamic>[],
      'playlists': <dynamic>[],
      'recents': <dynamic>[],
      'needsAuth': true,
    };
  }
  return ref.read(apiClientProvider).library();
});

final discoverQueryProvider = StateProvider<String?>((ref) => null);

final catalogSourcesProvider = FutureProvider<List<Map<String, dynamic>>>((
  ref,
) async {
  ref.watch(offlineStoreProvider);
  return ref.read(apiClientProvider).providers();
});
