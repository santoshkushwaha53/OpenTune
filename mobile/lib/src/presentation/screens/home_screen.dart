import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../application/providers.dart';
import '../../data/download_store.dart';
import '../../domain/track.dart';
import '../theme/tokens.dart';
import '../widgets/empty_state.dart';
import '../widgets/loading_state.dart';
import '../widgets/offline_banner.dart';
import '../widgets/track_tile.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final home = ref.watch(homeProvider);
    return home.when(
      loading: () => const LoadingState(message: 'Loading home'),
      error: (error, stack) => const EmptyState(
        title: 'Could not load home',
        message:
            'Start the OpenTune API or use downloaded tracks from Library.',
      ),
      data: (data) {
        final offline = data['offline'] == true;
        final recents = TrackSummary.listFrom(
          data['recentlyPlayed'] ?? data['continueListening'],
        );
        final recommended = TrackSummary.listFrom(data['recommended']);
        final trending = TrackSummary.listFrom(data['trending']);
        final fresh = TrackSummary.listFrom(data['newOpenReleases']);
        final downloadable = TrackSummary.listFrom(data['downloadable']);
        final onDevice = ref.watch(downloadStoreProvider).libraryTracks();
        final empty =
            recommended.isEmpty &&
            trending.isEmpty &&
            recents.isEmpty &&
            onDevice.isEmpty;
        final genres = (data['genres'] as List<dynamic>? ?? [])
            .whereType<Map<String, dynamic>>()
            .map((row) => row['name'] as String? ?? '')
            .where((name) => name.isNotEmpty)
            .toList();
        final playlists = (data['communityPlaylists'] as List<dynamic>? ?? [])
            .whereType<Map<String, dynamic>>()
            .toList();

        return CustomScrollView(
          slivers: [
            SliverAppBar.large(
              title: Text(data['greeting'] as String? ?? 'OpenTune'),
            ),
            if (offline)
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.only(bottom: OpenTuneTokens.spaceSm),
                  child: OfflineBanner(),
                ),
              ),
            if (empty)
              const SliverFillRemaining(
                child: EmptyState(
                  title: 'No catalog yet',
                  message:
                      'Search Discover for open music. Audio always streams from the original provider.',
                ),
              )
            else ...[
              if (onDevice.isNotEmpty) _shelf('On this device', onDevice),
              if (recents.isNotEmpty) _shelf('Continue listening', recents),
              if (recommended.isNotEmpty) _shelf('For you', recommended),
              if (trending.isNotEmpty) _shelf('Trending', trending),
              if (fresh.isNotEmpty) _shelf('New open releases', fresh),
              if (downloadable.isNotEmpty)
                _shelf('Available to download', downloadable),
              if (genres.isNotEmpty)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      OpenTuneTokens.spaceLg,
                      OpenTuneTokens.spaceMd,
                      OpenTuneTokens.spaceLg,
                      OpenTuneTokens.spaceSm,
                    ),
                    child: Wrap(
                      spacing: 8,
                      children: [
                        for (final genre in genres)
                          ActionChip(
                            label: Text(genre),
                            onPressed: () {
                              ref.read(discoverQueryProvider.notifier).state =
                                  genre;
                              context.go('/discover');
                            },
                          ),
                      ],
                    ),
                  ),
                ),
              if (playlists.isNotEmpty)
                SliverList.list(
                  children: [
                    const _Heading('Community playlists'),
                    for (final playlist in playlists)
                      ListTile(
                        leading: const Icon(Icons.queue_music),
                        title: Text(playlist['title'] as String? ?? 'Playlist'),
                        subtitle: const Text(
                          'Track references only — audio stays on the provider',
                        ),
                        onTap: () =>
                            context.push('/playlist/${playlist['id']}'),
                      ),
                  ],
                ),
            ],
          ],
        );
      },
    );
  }

  static Widget _shelf(String title, List<TrackSummary> tracks) {
    return SliverList.list(
      children: [
        _Heading(title),
        for (final track in tracks.take(8)) TrackTile(track: track),
      ],
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        OpenTuneTokens.spaceLg,
        OpenTuneTokens.spaceMd,
        OpenTuneTokens.spaceLg,
        OpenTuneTokens.spaceSm,
      ),
      child: Text(text, style: Theme.of(context).textTheme.titleLarge),
    );
  }
}
