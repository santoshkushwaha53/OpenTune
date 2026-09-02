import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../application/providers.dart';
import '../../data/download_store.dart';
import '../../data/offline_store.dart';
import '../../data/session_store.dart';
import '../../domain/track.dart';
import '../widgets/empty_state.dart';
import '../widgets/offline_banner.dart';
import '../widgets/track_tile.dart';
import 'playlist_screens.dart';

class LibraryScreen extends ConsumerWidget {
  const LibraryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final store = ref.watch(downloadStoreProvider);
    final downloads = store.items.values
        .where((item) => item.isCompleted)
        .toList();
    final session = ref.watch(sessionStoreProvider);
    final disconnected = ref.watch(offlineStoreProvider).offline;
    final library = ref.watch(libraryProvider);
    final playlists = library.maybeWhen(
      data: (data) => data['playlists'] as List<dynamic>? ?? [],
      orElse: () => <dynamic>[],
    );
    final favorites = library.maybeWhen(
      data: (data) => data['favorites'] as List<dynamic>? ?? [],
      orElse: () => <dynamic>[],
    );

    return Scaffold(
      appBar: AppBar(
        title: const Text('Library'),
        actions: [
          IconButton(
            icon: Icon(session.loggedIn ? Icons.logout : Icons.login),
            onPressed: () {
              if (session.loggedIn) {
                session.logout();
              } else {
                context.push('/login');
              }
            },
          ),
        ],
      ),
      body: ListView(
        children: [
          if (disconnected)
            const OfflineBanner(
              message: 'Offline mode — playing files already on this device.',
            ),
          ListTile(
            leading: const Icon(Icons.tune),
            title: const Text('Music preferences'),
            subtitle: const Text(
              'Artists, scenes, languages, and vibes. Existing downloads stay on this device.',
            ),
            onTap: () => session.loggedIn
                ? context.push('/settings/music-preferences')
                : context.push('/login'),
          ),
          ListTile(
            leading: const Icon(Icons.cloud_outlined),
            title: const Text('Catalog sources'),
            subtitle: const Text(
              'Provider health — metadata only, no audio from OpenTune',
            ),
            onTap: () => context.push('/catalog-sources'),
          ),
          ListTile(
            leading: const Icon(Icons.download_done),
            title: const Text('Downloads'),
            subtitle: Text('${downloads.length} on this device'),
            onTap: () => context.push('/downloads'),
          ),
          ListTile(
            leading: const Icon(Icons.favorite_outline),
            title: const Text('Favorites'),
            subtitle: Text(
              session.loggedIn
                  ? '${favorites.length} saved'
                  : 'Sign in to sync favorites',
            ),
            onTap: () => session.loggedIn
                ? context.push('/favorites')
                : context.push('/login'),
          ),
          ListTile(
            leading: const Icon(Icons.queue_music),
            title: const Text('Playlists'),
            subtitle: const Text(
              'References only — audio stays on the provider or this device',
            ),
            trailing: session.loggedIn
                ? IconButton(
                    icon: const Icon(Icons.add),
                    onPressed: () => showCreatePlaylistDialog(context, ref),
                  )
                : null,
            onTap: () => session.loggedIn
                ? context.push('/playlists')
                : context.push('/login'),
          ),
          if (downloads.isNotEmpty) ...[
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Text('Downloaded music'),
            ),
            for (final item in downloads)
              TrackTile(
                track: TrackSummary(
                  id: item.trackId,
                  title: item.title,
                  durationMs: item.durationMs ?? 0,
                  artworkUrl: item.artworkPath ?? item.artworkUrl,
                  artistName: item.artistName,
                  spdxId: item.license,
                  stream: true,
                  download: true,
                  attributionRequired:
                      item.attribution != null && item.attribution!.isNotEmpty,
                ),
              ),
          ],
          if (playlists.isNotEmpty)
            for (final raw in playlists.whereType<Map<String, dynamic>>())
              ListTile(
                leading: const Icon(Icons.playlist_play),
                title: Text(raw['title'] as String? ?? 'Playlist'),
                onTap: () => context.push('/playlist/${raw['id']}'),
              ),
          if (downloads.isEmpty && playlists.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 48),
              child: EmptyState(
                title: 'Nothing offline yet',
                message:
                    'Download a permitted track or sign in to manage playlists.',
              ),
            ),
        ],
      ),
    );
  }
}
